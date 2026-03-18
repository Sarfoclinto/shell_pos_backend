import { stockTransferRepository } from "../repositories/stock-transfer.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";
import { withTransaction } from "../config/database.js";
import { query } from "../config/database.js";

const serializeList = (row) => ({
  id: row.id,
  transferNumber: row.transfer_number,
  status: row.status,
  totalQuantity: row.total_quantity,
  notes: row.notes ?? null,
  itemCount: parseInt(row.item_count ?? 0, 10),
  fromStore: { name: row.from_store_name },
  toStore: { name: row.to_store_name },
  initiatedBy: { firstName: row.first_name, lastName: row.last_name },
  createdAt: row.created_at,
});

const serializeDetail = (row) => {
  const items =
    typeof row.items === "string" ? JSON.parse(row.items) : (row.items ?? []);
  return {
    ...serializeList(row),
    fromStoreId: row.from_store_id,
    toStoreId: row.to_store_id,
    approvedBy: row.approver_first_name
      ? { firstName: row.approver_first_name, lastName: row.approver_last_name }
      : null,
    approvedAt: row.approved_at ?? null,
    items: items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      quantity: i.quantity,
    })),
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
      await stockTransferRepository.approve(id, approvedBy, notes);

      // Deduct from source store immediately on approval
      for (const item of items) {
        await client.query(
          `UPDATE stock SET quantity = quantity - $1, updated_at = NOW(), updated_by = $3
           WHERE product_id = $2 AND store_id = $4`,
          [item.quantity, item.productId, approvedBy, transfer.from_store_id],
        );
        await client.query(
          `INSERT INTO stock_movements
             (product_id, store_id, movement_type, quantity_change, reference_type, reference_id, note, created_by)
           VALUES ($1,$2,'transfer_out',$3,'transfer',$4,$5,$6)`,
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
      await stockTransferRepository.complete(id, completedBy);

      // Credit destination store on completion
      for (const item of items) {
        await client.query(
          `INSERT INTO stock (product_id, store_id, quantity, created_by)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (product_id, store_id)
           DO UPDATE SET quantity = stock.quantity + $3, updated_at = NOW(), updated_by = $4`,
          [item.productId, transfer.to_store_id, item.quantity, completedBy],
        );
        await client.query(
          `INSERT INTO stock_movements
             (product_id, store_id, movement_type, quantity_change, reference_type, reference_id, note, created_by)
           VALUES ($1,$2,'transfer_in',$3,'transfer',$4,$5,$6)`,
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
