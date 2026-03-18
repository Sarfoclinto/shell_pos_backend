import { query } from "../config/database.js";

class SalesReturnRepository {
  async generateReturnNumber() {
    const now = new Date();
    const ts = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const dayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
    const { rows } = await query(
      `SELECT COUNT(*) FROM sales_returns WHERE created_at >= $1`,
      [dayStart],
    );
    const seq = String(parseInt(rows[0].count, 10) + 1).padStart(4, "0");
    return `SR-${ts}-${seq}`;
  }

  async findAll({ storeId, status, from, to, limit, offset }) {
    const conds = [];
    const vals = [];
    let i = 1;
    if (storeId) {
      conds.push(`sr.store_id = $${i++}`);
      vals.push(storeId);
    }
    if (status) {
      conds.push(`sr.status   = $${i++}`);
      vals.push(status);
    }
    if (from) {
      conds.push(`sr.created_at >= $${i++}`);
      vals.push(from);
    }
    if (to) {
      conds.push(`sr.created_at <= $${i++}`);
      vals.push(to);
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const { rows: cr } = await query(
      `SELECT COUNT(*) FROM sales_returns sr ${where}`,
      vals,
    );
    const total = parseInt(cr[0].count, 10);

    const { rows } = await query(
      `SELECT sr.*, s.receipt_number, st.name AS store_name,
              u.first_name, u.last_name, c.name AS customer_name
       FROM sales_returns sr
       JOIN sales   s  ON s.id  = sr.sale_id
       JOIN stores  st ON st.id = sr.store_id
       JOIN users   u  ON u.id  = sr.user_id
       LEFT JOIN customers c ON c.id = sr.customer_id
       ${where} ORDER BY sr.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset],
    );
    return { rows, total };
  }

  async findByIdWithItems(id) {
    const { rows } = await query(
      `SELECT sr.*, s.receipt_number, st.name AS store_name,
              u.first_name, u.last_name, c.name AS customer_name, c.phone AS customer_phone,
              COALESCE(json_agg(json_build_object(
                'id',         sri.id,
                'productId',  sri.product_id,
                'productName',p.name,
                'sku',        p.sku,
                'quantity',   sri.quantity,
                'unitPrice',  sri.unit_price,
                'totalPrice', sri.total_price
              ) ORDER BY sri.id) FILTER (WHERE sri.id IS NOT NULL), '[]') AS items
       FROM sales_returns sr
       JOIN sales   s  ON s.id  = sr.sale_id
       JOIN stores  st ON st.id = sr.store_id
       JOIN users   u  ON u.id  = sr.user_id
       LEFT JOIN customers c ON c.id = sr.customer_id
       LEFT JOIN sales_return_items sri ON sri.sales_return_id = sr.id
       LEFT JOIN products p ON p.id = sri.product_id
       WHERE sr.id = $1
       GROUP BY sr.id, s.receipt_number, st.name, u.first_name, u.last_name,
                c.name, c.phone`,
      [id],
    );
    return rows[0] || null;
  }

  async create(data, storeId, userId, createdBy) {
    const returnNumber = await this.generateReturnNumber();
    const { rows } = await query(
      `INSERT INTO sales_returns
         (return_number, sale_id, store_id, user_id, customer_id, reason,
          total_amount, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8) RETURNING id`,
      [
        returnNumber,
        data.saleId,
        storeId,
        userId,
        data.customerId ?? null,
        data.reason ?? null,
        data.totalAmount,
        createdBy,
      ],
    );
    return rows[0].id;
  }

  async createItems(salesReturnId, items, createdBy) {
    for (const item of items) {
      await query(
        `INSERT INTO sales_return_items (sales_return_id, product_id, quantity, unit_price, total_price, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          salesReturnId,
          item.productId,
          item.quantity,
          item.unitPrice,
          item.quantity * item.unitPrice,
          createdBy,
        ],
      );
    }
  }

  async updateStatus(id, status, updatedBy, notes = null) {
    const { rows } = await query(
      `UPDATE sales_returns
       SET status = $2, updated_at = NOW(), updated_by = $3,
           reason = CASE WHEN $4 IS NOT NULL THEN
                      COALESCE(reason, '') || ' | Note: ' || $4
                    ELSE reason END
       WHERE id = $1 RETURNING *`,
      [id, status, updatedBy, notes],
    );
    return rows[0] || null;
  }
}

export const salesReturnRepository = new SalesReturnRepository();
