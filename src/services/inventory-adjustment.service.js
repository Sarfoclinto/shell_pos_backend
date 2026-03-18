import { inventoryAdjustmentRepository } from "../repositories/inventory-adjustment.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";
import { withTransaction } from "../config/database.js";
import { query } from "../config/database.js";

const serializeList = (row) => ({
  id: row.id,
  adjustmentNumber: row.adjustment_number,
  adjustmentType: row.adjustment_type,
  reason: row.reason,
  notes: row.notes ?? null,
  status: row.status,
  itemCount: parseInt(row.item_count ?? 0, 10),
  store: { name: row.store_name },
  initiatedBy: { firstName: row.first_name, lastName: row.last_name },
  createdAt: row.created_at,
});

const serializeDetail = (row) => {
  const items =
    typeof row.items === "string" ? JSON.parse(row.items) : (row.items ?? []);
  return {
    ...serializeList(row),
    items: items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      systemQuantity: i.systemQuantity,
      adjustedQuantity: i.adjustedQuantity,
      difference: i.difference,
    })),
  };
};

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
    if (adj.user_id === approvedBy) {
      throw ApiError.forbidden(
        "You cannot approve your own inventory adjustment",
      );
    }

    const items =
      typeof adj.items === "string" ? JSON.parse(adj.items) : (adj.items ?? []);

    await withTransaction(async (client) => {
      await inventoryAdjustmentRepository.approve(id, approvedBy, notes);

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
