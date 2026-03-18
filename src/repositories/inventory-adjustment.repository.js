import { query } from "../config/database.js";

class InventoryAdjustmentRepository {
  async generateAdjustmentNumber() {
    const now = new Date();
    const ts = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const dayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
    const { rows } = await query(
      `SELECT COUNT(*) FROM inventory_adjustments WHERE created_at >= $1`,
      [dayStart],
    );
    const seq = String(parseInt(rows[0].count, 10) + 1).padStart(4, "0");
    return `IA-${ts}-${seq}`;
  }

  async findAll({ storeId, status, from, to, limit, offset }) {
    const conds = [];
    const vals = [];
    let i = 1;
    if (storeId) {
      conds.push(`ia.store_id = $${i++}`);
      vals.push(storeId);
    }
    if (status) {
      conds.push(`ia.status   = $${i++}`);
      vals.push(status);
    }
    if (from) {
      conds.push(`ia.created_at >= $${i++}`);
      vals.push(from);
    }
    if (to) {
      conds.push(`ia.created_at <= $${i++}`);
      vals.push(to);
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const { rows: cr } = await query(
      `SELECT COUNT(*) FROM inventory_adjustments ia ${where}`,
      vals,
    );
    const total = parseInt(cr[0].count, 10);

    const { rows } = await query(
      `SELECT ia.*, st.name AS store_name, u.first_name, u.last_name,
              COUNT(iai.id) AS item_count
       FROM inventory_adjustments ia
       JOIN stores st ON st.id = ia.store_id
       JOIN users  u  ON u.id  = ia.user_id
       LEFT JOIN inventory_adjustment_items iai ON iai.inventory_adjustment_id = ia.id
       ${where} GROUP BY ia.id, st.name, u.first_name, u.last_name
       ORDER BY ia.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset],
    );
    return { rows, total };
  }

  async findByIdWithItems(id) {
    const { rows } = await query(
      `SELECT ia.*, st.name AS store_name, u.first_name, u.last_name,
              COALESCE(json_agg(json_build_object(
                'id',               iai.id,
                'productId',        iai.product_id,
                'productName',      p.name,
                'sku',              p.sku,
                'systemQuantity',   iai.system_quantity,
                'adjustedQuantity', iai.adjusted_quantity,
                'difference',       iai.difference
              ) ORDER BY iai.id) FILTER (WHERE iai.id IS NOT NULL), '[]') AS items
       FROM inventory_adjustments ia
       JOIN stores st ON st.id = ia.store_id
       JOIN users  u  ON u.id  = ia.user_id
       LEFT JOIN inventory_adjustment_items iai ON iai.inventory_adjustment_id = ia.id
       LEFT JOIN products p ON p.id = iai.product_id
       WHERE ia.id = $1
       GROUP BY ia.id, st.name, u.first_name, u.last_name`,
      [id],
    );
    return rows[0] || null;
  }

  async create(reason, notes, storeId, userId, adjustmentType, createdBy) {
    const adjNumber = await this.generateAdjustmentNumber();
    const { rows } = await query(
      `INSERT INTO inventory_adjustments
         (adjustment_number, store_id, user_id, adjustment_type, reason, notes, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING id`,
      [
        adjNumber,
        storeId,
        userId,
        adjustmentType,
        reason,
        notes ?? null,
        createdBy,
      ],
    );
    return rows[0].id;
  }

  async createItems(adjustmentId, items, createdBy) {
    for (const item of items) {
      await query(
        `INSERT INTO inventory_adjustment_items
           (inventory_adjustment_id, product_id, system_quantity, adjusted_quantity, difference, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          adjustmentId,
          item.productId,
          item.systemQuantity,
          item.adjustedQuantity,
          item.adjustedQuantity - item.systemQuantity,
          createdBy,
        ],
      );
    }
  }

  async approve(id, approvedBy, notes) {
    const { rows } = await query(
      `UPDATE inventory_adjustments
       SET status = 'approved', approved_by = $2, approved_at = NOW(),
           updated_at = NOW(), updated_by = $2,
           notes = CASE WHEN $3 IS NOT NULL THEN COALESCE(notes,'') || ' | ' || $3 ELSE notes END
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id, approvedBy, notes ?? null],
    );
    return rows[0] || null;
  }

  async reject(id, rejectedBy, notes) {
    const { rows } = await query(
      `UPDATE inventory_adjustments
       SET status = 'rejected', updated_at = NOW(), updated_by = $2,
           notes = COALESCE(notes,'') || ' | Rejection: ' || $3
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id, rejectedBy, notes],
    );
    return rows[0] || null;
  }
}

export const inventoryAdjustmentRepository =
  new InventoryAdjustmentRepository();
