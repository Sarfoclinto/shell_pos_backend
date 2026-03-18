import { query } from "../config/database.js";

class SaleRepository {
  /**
   * Full sale detail — items, payments, split breakdown.
   */
  async findByIdWithDetails(id) {
    const { rows } = await query(
      `SELECT
         s.*,
         u.first_name      AS cashier_first_name,
         u.last_name       AS cashier_last_name,
         st.name           AS store_name,
         st.code           AS store_code,
         c.name            AS customer_name,
         c.phone           AS customer_phone,
         sh.opened_at      AS shift_opened_at,

         -- Items
         COALESCE(
           json_agg(
             json_build_object(
               'id',         si.id,
               'productId',  si.product_id,
               'productName',p.name,
               'sku',        p.sku,
               'quantity',   si.quantity,
               'unitPrice',  si.unit_price,
               'totalPrice', si.total_price
             )
             ORDER BY si.id
           ) FILTER (WHERE si.id IS NOT NULL),
           '[]'
         ) AS items,

         -- Payments
         COALESCE(
           json_agg(
             DISTINCT jsonb_build_object(
               'id',              pay.id,
               'method',          pay.payment_method,
               'amount',          pay.amount,
               'status',          pay.payment_status,
               'referenceNumber', pay.reference_number,
               'paidAt',          pay.paid_at
             )
           ) FILTER (WHERE pay.id IS NOT NULL),
           '[]'
         ) AS payments

       FROM sales s
       INNER JOIN users    u  ON u.id  = s.user_id
       INNER JOIN stores   st ON st.id = s.store_id
       INNER JOIN shifts   sh ON sh.id = s.shift_id
       LEFT  JOIN customers c  ON c.id  = s.customer_id
       LEFT  JOIN sales_items si ON si.sale_id = s.id
       LEFT  JOIN products    p  ON p.id = si.product_id
       LEFT  JOIN payments   pay ON pay.sale_id = s.id
       WHERE s.id = $1
       GROUP BY s.id, u.first_name, u.last_name,
                st.name, st.code, c.name, c.phone, sh.opened_at`,
      [id],
    );

    if (!rows[0]) return null;

    // Attach split breakdown to any split payment
    const sale = rows[0];
    const payments =
      typeof sale.payments === "string"
        ? JSON.parse(sale.payments)
        : sale.payments;

    for (const payment of payments) {
      if (payment.method === "split") {
        const { rows: splits } = await query(
          `SELECT method, amount, reference_number AS "referenceNumber"
           FROM payment_splits WHERE payment_id = $1`,
          [payment.id],
        );
        payment.splits = splits;
      }
    }

    return { ...sale, payments };
  }

  async findByReceiptNumber(receiptNumber) {
    const { rows } = await query(
      `SELECT id FROM sales WHERE receipt_number = $1 LIMIT 1`,
      [receiptNumber],
    );
    if (!rows[0]) return null;
    return this.findByIdWithDetails(rows[0].id);
  }

  /**
   * Paginated list — lighter query, no items/payments nested.
   */
  async findAll({
    storeId,
    shiftId,
    userId,
    customerId,
    status,
    from,
    to,
    limit,
    offset,
  }) {
    const conditions = ["s.deleted_at IS NULL"];
    const values = [];
    let i = 1;

    if (storeId) {
      conditions.push(`s.store_id    = $${i++}`);
      values.push(storeId);
    }
    if (shiftId) {
      conditions.push(`s.shift_id    = $${i++}`);
      values.push(shiftId);
    }
    if (userId) {
      conditions.push(`s.user_id     = $${i++}`);
      values.push(userId);
    }
    if (customerId) {
      conditions.push(`s.customer_id = $${i++}`);
      values.push(customerId);
    }
    if (status) {
      conditions.push(`s.status      = $${i++}`);
      values.push(status);
    }
    if (from) {
      conditions.push(`s.created_at >= $${i++}`);
      values.push(from);
    }
    if (to) {
      conditions.push(`s.created_at <= $${i++}`);
      values.push(to);
    }

    const where = conditions.join(" AND ");

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM sales s WHERE ${where}`,
      values,
    );
    const total = parseInt(countRows[0].count, 10);

    const { rows } = await query(
      `SELECT
         s.id, s.receipt_number, s.status,
         s.total_amount, s.discount_amount, s.tax_amount, s.final_amount,
         s.created_at,
         u.first_name  AS cashier_first_name,
         u.last_name   AS cashier_last_name,
         st.name       AS store_name,
         st.code       AS store_code,
         c.name        AS customer_name,
         c.phone       AS customer_phone,
         pay.payment_method,
         pay.payment_status
       FROM sales s
       INNER JOIN users    u   ON u.id   = s.user_id
       INNER JOIN stores   st  ON st.id  = s.store_id
       LEFT  JOIN customers c  ON c.id   = s.customer_id
       LEFT  JOIN payments  pay ON pay.sale_id = s.id
       WHERE ${where}
       ORDER BY s.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset],
    );

    return { rows, total };
  }

  /**
   * Generate receipt number.
   * Format: {STORE_CODE}-{YYYYMMDDHHmmss}-{XXXX sequential per store per day}
   */
  async generateReceiptNumber(storeCode) {
    const now = new Date();
    const datePart = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const dayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();

    const { rows } = await query(
      `SELECT COUNT(*) FROM sales s
       JOIN stores st ON st.id = s.store_id
       WHERE st.code = $1 AND s.created_at >= $2`,
      [storeCode, dayStart],
    );

    const seq = String(parseInt(rows[0].count, 10) + 1).padStart(4, "0");
    return `${storeCode}-${datePart}-${seq}`;
  }
}

export const saleRepository = new SaleRepository();
