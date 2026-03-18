import { query } from "../config/database.js";

class StockTransferRepository {
  async generateTransferNumber() {
    const now = new Date();
    const ts = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const dayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
    const { rows } = await query(
      `SELECT COUNT(*) FROM stock_transfers WHERE created_at >= $1`,
      [dayStart],
    );
    const seq = String(parseInt(rows[0].count, 10) + 1).padStart(4, "0");
    return `ST-${ts}-${seq}`;
  }

  async findAll({ storeId, status, from, to, limit, offset }) {
    const conds = [];
    const vals = [];
    let i = 1;
    // storeId matches either from or to store
    if (storeId) {
      conds.push(`(st.from_store_id = $${i} OR st.to_store_id = $${i})`);
      vals.push(storeId);
      i++;
    }
    if (status) {
      conds.push(`st.status = $${i++}`);
      vals.push(status);
    }
    if (from) {
      conds.push(`st.created_at >= $${i++}`);
      vals.push(from);
    }
    if (to) {
      conds.push(`st.created_at <= $${i++}`);
      vals.push(to);
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const { rows: cr } = await query(
      `SELECT COUNT(*) FROM stock_transfers st ${where}`,
      vals,
    );
    const total = parseInt(cr[0].count, 10);

    const { rows } = await query(
      `SELECT st.*, fs.name AS from_store_name, ts2.name AS to_store_name,
              u.first_name, u.last_name,
              COUNT(sti.id) AS item_count
       FROM stock_transfers st
       JOIN stores fs  ON fs.id  = st.from_store_id
       JOIN stores ts2 ON ts2.id = st.to_store_id
       JOIN users  u   ON u.id   = st.user_id
       LEFT JOIN stock_transfer_items sti ON sti.stock_transfer_id = st.id
       ${where} GROUP BY st.id, fs.name, ts2.name, u.first_name, u.last_name
       ORDER BY st.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset],
    );
    return { rows, total };
  }

  async findByIdWithItems(id) {
    const { rows } = await query(
      `SELECT st.*, fs.name AS from_store_name, ts2.name AS to_store_name,
              u.first_name, u.last_name,
              ab.first_name AS approver_first_name, ab.last_name AS approver_last_name,
              COALESCE(json_agg(json_build_object(
                'id',        sti.id,
                'productId', sti.product_id,
                'productName',p.name,
                'sku',       p.sku,
                'quantity',  sti.quantity
              ) ORDER BY sti.id) FILTER (WHERE sti.id IS NOT NULL), '[]') AS items
       FROM stock_transfers st
       JOIN stores fs   ON fs.id  = st.from_store_id
       JOIN stores ts2  ON ts2.id = st.to_store_id
       JOIN users  u    ON u.id   = st.user_id
       LEFT JOIN users  ab  ON ab.id = st.approved_by
       LEFT JOIN stock_transfer_items sti ON sti.stock_transfer_id = st.id
       LEFT JOIN products p ON p.id = sti.product_id
       WHERE st.id = $1
       GROUP BY st.id, fs.name, ts2.name, u.first_name, u.last_name,
                ab.first_name, ab.last_name`,
      [id],
    );
    return rows[0] || null;
  }

  async create(data, fromStoreId, userId, createdBy) {
    const transferNumber = await this.generateTransferNumber();
    const totalQty = data.items.reduce((s, i) => s + i.quantity, 0);
    const { rows } = await query(
      `INSERT INTO stock_transfers
         (transfer_number, from_store_id, to_store_id, user_id, status,
          total_quantity, notes, created_by)
       VALUES ($1,$2,$3,$4,'pending',$5,$6,$7) RETURNING id`,
      [
        transferNumber,
        fromStoreId,
        data.toStoreId,
        userId,
        totalQty,
        data.notes ?? null,
        createdBy,
      ],
    );
    return rows[0].id;
  }

  async createItems(transferId, items, createdBy) {
    for (const item of items) {
      await query(
        `INSERT INTO stock_transfer_items (stock_transfer_id, product_id, quantity, created_by)
         VALUES ($1,$2,$3,$4)`,
        [transferId, item.productId, item.quantity, createdBy],
      );
    }
  }

  async approve(id, approvedBy, notes) {
    const { rows } = await query(
      `UPDATE stock_transfers
       SET status = 'in_transit', approved_by = $2, approved_at = NOW(),
           updated_at = NOW(), updated_by = $2,
           notes = CASE WHEN $3 IS NOT NULL THEN COALESCE(notes,'') || ' | ' || $3 ELSE notes END
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id, approvedBy, notes ?? null],
    );
    return rows[0] || null;
  }

  async complete(id, completedBy) {
    const { rows } = await query(
      `UPDATE stock_transfers
       SET status = 'completed', updated_at = NOW(), updated_by = $2
       WHERE id = $1 AND status = 'in_transit'
       RETURNING *`,
      [id, completedBy],
    );
    return rows[0] || null;
  }

  async cancel(id, cancelledBy, notes) {
    const { rows } = await query(
      `UPDATE stock_transfers
       SET status = 'cancelled', updated_at = NOW(), updated_by = $2,
           notes = COALESCE(notes,'') || ' | Cancellation: ' || $3
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id, cancelledBy, notes ?? "No reason provided"],
    );
    return rows[0] || null;
  }
}

export const stockTransferRepository = new StockTransferRepository();
