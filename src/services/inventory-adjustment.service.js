import { inventoryAdjustmentRepository } from "../repositories/inventory-adjustment.repository.js";
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
    systemQuantity: parseInt(i.systemQuantity, 10),
    adjustedQuantity: parseInt(i.adjustedQuantity, 10),
    difference: parseInt(i.difference, 10),
  }));
};

const serializeList = (row) => ({
  id: row.id,
  createdAt: row.created_at,

  adjustmentNumber: row.adjustment_number,
  adjustmentType: row.adjustment_type,
  reason: row.reason,
  notes: row.notes ?? null,
  status: row.status,
  approvedAt: row.approved_at ?? null,

  store: {
    id: row.store_id,
    name: row.store_name,
    code: row.store_code,
  },

  createdByUser: {
    id: row.created_by_id,
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

  // ✅ NOW INCLUDED IN LIST
  items: serializeItems(row.items),
});

const serializeDetail = (row) => ({
  ...serializeList(row), // no duplication anymore
});

export const inventoryAdjustmentService = {
  async list(queryParams) {
    const { page, limit, offset } = paginate(queryParams);

    const { rows, total } = await inventoryAdjustmentRepository.findAll({
      storeId: queryParams.storeId || undefined,
      status: queryParams.status || undefined,
      from: queryParams.from || undefined,
      to: queryParams.to || undefined,
      limit,
      offset,
    });

    return {
      adjustments: rows.map(serializeList),
      pagination: { page, limit, total },
    };
  },

  async getById(id) {
    const adj = await inventoryAdjustmentRepository.findByIdWithItems(id);
    if (!adj) throw ApiError.notFound("Inventory adjustment not found");
    return serializeDetail(adj);
  },

  async create(data, storeId, userId, createdBy) {
    // For each item, look up current system quantity and determine adjustment type
    const enrichedItems = [];
    let hasPositive = false;
    let hasNegative = false;

    for (const item of data.items) {
      const { rows } = await query(
        `SELECT COALESCE(s.quantity, 0) AS qty
         FROM products p
         LEFT JOIN stock s ON s.product_id = p.id AND s.store_id = $2
         WHERE p.id = $1 AND p.deleted_at IS NULL`,
        [item.productId, storeId],
      );
      if (!rows[0])
        throw ApiError.badRequest(`Product "${item.productId}" not found`);

      const systemQty = parseInt(rows[0].qty, 10);
      const diff = item.adjustedQuantity - systemQty;
      if (diff > 0) hasPositive = true;
      if (diff < 0) hasNegative = true;

      enrichedItems.push({
        ...item,
        systemQuantity: systemQty,
        difference: diff,
      });
    }

    // Determine overall adjustment type
    const adjustmentType =
      hasPositive && hasNegative
        ? "positive"
        : hasNegative
          ? "negative"
          : "positive";

    const adjId = await withTransaction(async (client) => {
      const id = await inventoryAdjustmentRepository.create(
        data.reason,
        data.notes,
        storeId,
        userId,
        adjustmentType,
        createdBy,
      );
      await inventoryAdjustmentRepository.createItems(
        id,
        enrichedItems,
        createdBy,
      );
      return id;
    });

    return this.getById(adjId);
  },

  async approve(id, approvedBy, notes) {
    const adj = await inventoryAdjustmentRepository.findByIdWithItems(id);
    if (!adj) throw ApiError.notFound("Inventory adjustment not found");
    if (adj.status !== "pending") {
      throw ApiError.badRequest(
        `Cannot approve an adjustment with status "${adj.status}"`,
      );
    }

    // Self-approval not allowed
    // if (adj.user_id === approvedBy) {
    //   throw ApiError.forbidden(
    //     "You cannot approve your own inventory adjustment",
    //   );
    // }

    const items =
      typeof adj.items === "string" ? JSON.parse(adj.items) : (adj.items ?? []);

    await withTransaction(async (client) => {
      // await inventoryAdjustmentRepository.approve(id, approvedBy, notes);

      const { rows } = await client.query(
        `UPDATE inventory_adjustments
       SET status = 'approved', approved_by = $2::uuid, approved_at = NOW(),
           updated_at = NOW(), updated_by = $2::uuid,
           notes = CASE WHEN $3::text IS NOT NULL THEN COALESCE(notes,'') || ' | ' || $3::text ELSE notes END
       WHERE id = $1::uuid AND status = 'pending'
       RETURNING *`,
        [id, approvedBy, notes ?? null],
      );
      if (!rows[0]) {
        throw ApiError.badRequest("Adjustment could not be approved");
      }

      for (const item of items) {
        if (item.difference === 0) continue;

        // Set stock to the adjusted quantity
        await client.query(
          `INSERT INTO stock (product_id, store_id, quantity, created_by)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (product_id, store_id)
           DO UPDATE SET quantity = $3, updated_at = NOW(), updated_by = $4`,
          [item.productId, adj.store_id, item.adjustedQuantity, approvedBy],
        );

        await client.query(
          `INSERT INTO stock_movements
             (product_id, store_id, movement_type, quantity_change, reference_type, reference_id, note, created_by)
           VALUES ($1,$2,'adjustment',$3,'adjustment',$4,$5,$6)`,
          [
            item.productId,
            adj.store_id,
            item.difference,
            id,
            `Adjustment ${adj.adjustment_number}`,
            approvedBy,
          ],
        );
      }
    });

    return this.getById(id);
  },

  async reject(id, rejectedBy, notes) {
    const adj = await inventoryAdjustmentRepository.findByIdWithItems(id);
    if (!adj) throw ApiError.notFound("Inventory adjustment not found");
    if (adj.status !== "pending") {
      throw ApiError.badRequest(
        `Cannot reject an adjustment with status "${adj.status}"`,
      );
    }
    await inventoryAdjustmentRepository.reject(id, rejectedBy, notes);
    return this.getById(id);
  },
};
