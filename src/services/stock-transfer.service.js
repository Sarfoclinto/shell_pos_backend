import { stockTransferRepository } from "../repositories/stock-transfer.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";
import { withTransaction } from "../config/database.js";
import { query } from "../config/database.js";

const serializeItems = (raw) => {
  const items = typeof raw === "string" ? JSON.parse(raw) : (raw ?? []);
  return items.map((i) => ({
    id: i.id,
    productId: i.productId,
    productName: i.productName,
    sku: i.sku,
    quantity: i.quantity,
  }));
};

const serializeList = (row) => ({
  id: row.id,
  transferNumber: row.transfer_number,
  status: row.status,
  totalQuantity: parseInt(row.total_quantity, 10),
  notes: row.notes ?? null,
  approvedAt: row.approved_at ?? null,
  createdAt: row.created_at,
  fromStore: {
    id: row.from_store_id,
    name: row.from_store_name,
    code: row.from_store_code,
  },

  toStore: {
    id: row.to_store_id,
    name: row.to_store_name,
    code: row.to_store_code,
  },

  initiatedByUser: {
    id: row.initiated_by_id,
    firstName: row.first_name,
    lastName: row.last_name,
  },

  approvedByUser: row.approved_by_id
    ? {
        id: row.approved_by_id,
        firstName: row.approved_first_name,
        lastName: row.approved_last_name,
      }
    : null,

  items: serializeItems(row.items),
});

const serializeDetail = (row) => {
  const base = serializeList(row);

  return {
    ...base,

    // only add fields that are NOT already in serializeList
    fromStoreId: row.from_store_id,
    toStoreId: row.to_store_id,
  };
};

export const stockTransferService = {
  async list(queryParams) {
    const { page, limit, offset } = paginate(queryParams);
    const { rows, total } = await stockTransferRepository.findAll({
      storeId: queryParams.storeId || undefined,
      status: queryParams.status || undefined,
      from: queryParams.from || undefined,
      to: queryParams.to || undefined,
      limit,
      offset,
    });
    return {
      transfers: rows.map(serializeList),
      pagination: { page, limit, total },
    };
  },

  async getById(id) {
    const t = await stockTransferRepository.findByIdWithItems(id);
    if (!t) throw ApiError.notFound("Stock transfer not found");
    return serializeDetail(t);
  },

  async create(data, fromStoreId, userId, createdBy) {
    if (data.toStoreId === fromStoreId) {
      throw ApiError.badRequest("Cannot transfer stock to the same store");
    }

    // Validate destination store exists
    const { rows: storeRows } = await query(
      `SELECT id FROM stores WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE`,
      [data.toStoreId],
    );
    if (!storeRows[0])
      throw ApiError.badRequest("Destination store not found or inactive");

    // Check stock availability for each item at the source store
    for (const item of data.items) {
      const { rows } = await query(
        `SELECT COALESCE(s.quantity, 0) AS qty, p.name
         FROM products p
         LEFT JOIN stock s ON s.product_id = p.id AND s.store_id = $2
         WHERE p.id = $1 AND p.deleted_at IS NULL AND p.type = 'inventory'`,
        [item.productId, fromStoreId],
      );
      if (!rows[0])
        throw ApiError.badRequest(
          `Product "${item.productId}" not found or is not an inventory product`,
        );
      if (rows[0].qty < item.quantity) {
        throw ApiError.badRequest(
          `Insufficient stock for "${rows[0].name}". Available: ${rows[0].qty}, requested: ${item.quantity}`,
        );
      }
    }

    const transferId = await withTransaction(async (client) => {
      const id = await stockTransferRepository.create(
        data,
        fromStoreId,
        userId,
        createdBy,
      );
      await stockTransferRepository.createItems(id, data.items, createdBy);
      return id;
    });

    return this.getById(transferId);
  },

  async approve(id, approvedBy, notes) {
    const transfer = await stockTransferRepository.findByIdWithItems(id);
    if (!transfer) throw ApiError.notFound("Stock transfer not found");
    if (transfer.status !== "pending") {
      throw ApiError.badRequest(
        `Cannot approve a transfer with status "${transfer.status}"`,
      );
    }
    if (transfer.user_id === approvedBy) {
      throw ApiError.forbidden("You cannot approve your own stock transfer");
    }

    const items =
      typeof transfer.items === "string"
        ? JSON.parse(transfer.items)
        : (transfer.items ?? []);

    await withTransaction(async (client) => {
      // 1. Update transfer status
      const { rows } = await client.query(
        `UPDATE stock_transfers
       SET status = 'in_transit',
           approved_by = $2::uuid,
           approved_at = NOW(),
           updated_at = NOW(),
           updated_by = $2::uuid,
           notes = CASE 
                     WHEN $3::text IS NOT NULL 
                     THEN COALESCE(notes,'') || ' | ' || $3::text 
                     ELSE notes 
                   END
       WHERE id = $1::uuid 
         AND status = 'pending'
       RETURNING *`,
        [id, approvedBy, notes ?? null],
      );

      if (!rows[0]) {
        throw ApiError.badRequest("Transfer could not be approved");
      }

      // 2. Deduct stock safely
      for (const item of items) {
        const result = await client.query(
          `UPDATE stock
         SET quantity = quantity - $1,
             updated_at = NOW(),
             updated_by = $3::uuid
         WHERE product_id = $2::uuid
           AND store_id = $4::uuid
           AND quantity >= $1
         RETURNING quantity`,
          [item.quantity, item.productId, approvedBy, transfer.from_store_id],
        );

        // CRITICAL: Prevent negative stock
        if (result.rowCount === 0) {
          throw ApiError.badRequest(
            `Insufficient stock for product ${item.productName}`,
          );
        }

        // 3. Record movement (TRANSFER_OUT)
        await client.query(
          `INSERT INTO stock_movements
          (product_id, store_id, movement_type, quantity_change, reference_type, reference_id, note, created_by)
         VALUES (
           $1::uuid,
           $2::uuid,
           'transfer_out',
           $3,
           'transfer',
           $4::uuid,
           $5,
           $6::uuid
         )`,
          [
            item.productId,
            transfer.from_store_id,
            -item.quantity,
            id,
            `Transfer out ${transfer.transfer_number}`,
            approvedBy,
          ],
        );
      }
    });

    return this.getById(id);
  },

  async complete(id, completedBy) {
    const transfer = await stockTransferRepository.findByIdWithItems(id);

    if (!transfer) throw ApiError.notFound("Stock transfer not found");

    if (transfer.status !== "in_transit") {
      throw ApiError.badRequest(
        `Cannot complete a transfer with status "${transfer.status}"`,
      );
    }

    const items =
      typeof transfer.items === "string"
        ? JSON.parse(transfer.items)
        : (transfer.items ?? []);

    await withTransaction(async (client) => {
      // 1. Update transfer safely (prevents double completion)
      const { rows } = await client.query(
        `UPDATE stock_transfers
       SET status = 'completed',
           updated_at = NOW(),
           updated_by = $2::uuid
       WHERE id = $1::uuid
         AND status = 'in_transit'
       RETURNING *`,
        [id, completedBy],
      );

      if (!rows[0]) {
        throw ApiError.badRequest(
          "Transfer could not be completed (maybe already processed)",
        );
      }

      // ✅ 2. Credit destination store
      for (const item of items) {
        // UPSERT stock safely
        await client.query(
          `INSERT INTO stock (product_id, store_id, quantity, created_at, created_by)
         VALUES ($1::uuid, $2::uuid, $3, NOW(), $4::uuid)
         ON CONFLICT (product_id, store_id)
         DO UPDATE SET 
           quantity = stock.quantity + EXCLUDED.quantity,
           updated_at = NOW(),
           updated_by = EXCLUDED.created_by`,
          [item.productId, transfer.to_store_id, item.quantity, completedBy],
        );

        // ✅ 3. Record movement (TRANSFER_IN)
        await client.query(
          `INSERT INTO stock_movements
          (product_id, store_id, movement_type, quantity_change, reference_type, reference_id, note, created_by)
         VALUES (
           $1::uuid,
           $2::uuid,
           'transfer_in',
           $3,
           'transfer',
           $4::uuid,
           $5,
           $6::uuid
         )`,
          [
            item.productId,
            transfer.to_store_id,
            item.quantity,
            id,
            `Transfer in ${transfer.transfer_number}`,
            completedBy,
          ],
        );
      }
    });

    return this.getById(id);
  },

  async cancel(id, cancelledBy, notes) {
    const transfer = await stockTransferRepository.findByIdWithItems(id);
    if (!transfer) throw ApiError.notFound("Stock transfer not found");
    if (transfer.status !== "pending") {
      throw ApiError.badRequest("Only pending transfers can be cancelled");
    }
    await stockTransferRepository.cancel(id, cancelledBy, notes);
    return this.getById(id);
  },
};
