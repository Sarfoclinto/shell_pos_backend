import { query } from "../config/database.js";

const defaultFrom = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
const defaultTo = () => new Date().toISOString();

class Report1Repository {
  // ══════════════════════════════════════════════════════════════════════════
  // SALES REPORT
  // ══════════════════════════════════════════════════════════════════════════

  async salesSummary({ storeId, userId, status, paymentMethod, from, to }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();
    const conds = [`s.created_at BETWEEN $1 AND $2`];
    const vals = [f, t];
    let i = 3;
    if (storeId) {
      conds.push(`s.store_id = $${i++}`);
      vals.push(storeId);
    }
    if (userId) {
      conds.push(`s.user_id  = $${i++}`);
      vals.push(userId);
    }
    if (status) {
      conds.push(`s.status   = $${i++}`);
      vals.push(status);
    }
    if (paymentMethod) {
      conds.push(`p.payment_method = $${i++}`);
      vals.push(paymentMethod);
    }

    const where = conds.join(" AND ");
    const { rows } = await query(
      `
      SELECT
        COALESCE(SUM(s.final_amount)    FILTER (WHERE s.status = 'completed'), 0) AS total_revenue,
        COUNT(s.id)                                                                AS total_transactions,
        COALESCE(SUM(s.final_amount)    FILTER (WHERE s.status = 'completed'), 0) AS completed_revenue,
        COUNT(s.id)                     FILTER (WHERE s.status = 'cancelled')     AS cancelled_count,
        COALESCE(AVG(s.final_amount)    FILTER (WHERE s.status = 'completed'), 0) AS avg_order_value,
        COALESCE(SUM(s.discount_amount) FILTER (WHERE s.status = 'completed'), 0) AS total_discount,
        COALESCE(SUM(s.tax_amount)      FILTER (WHERE s.status = 'completed'), 0) AS total_tax,
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'cash'         AND p.payment_status = 'paid'), 0) AS cash_revenue,
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'card'         AND p.payment_status = 'paid'), 0) AS card_revenue,
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'mobile_money' AND p.payment_status = 'paid'), 0) AS momo_revenue,
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'split'        AND p.payment_status = 'paid'), 0) AS split_revenue
      FROM sales s
      LEFT JOIN payments p ON p.sale_id = s.id
      WHERE ${where}`,
      vals,
    );
    return rows[0];
  }

  async salesRevenueByDay({ storeId, userId, status, from, to }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();
    const conds = [`s.status = 'completed'`, `s.created_at BETWEEN $1 AND $2`];
    const vals = [f, t];
    let i = 3;
    if (storeId) {
      conds.push(`s.store_id = $${i++}`);
      vals.push(storeId);
    }
    if (userId) {
      conds.push(`s.user_id  = $${i++}`);
      vals.push(userId);
    }
    const { rows } = await query(
      `
      SELECT DATE(s.created_at) AS date,
             COALESCE(SUM(s.final_amount),0) AS revenue,
             COUNT(s.id) AS transactions
      FROM sales s WHERE ${conds.join(" AND ")}
      GROUP BY DATE(s.created_at) ORDER BY date ASC`,
      vals,
    );
    return rows;
  }

  async salesByPaymentMethod({ storeId, from, to }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();
    const conds = [`s.status = 'completed'`, `s.created_at BETWEEN $1 AND $2`];
    const vals = [f, t];
    let i = 3;
    if (storeId) {
      conds.push(`s.store_id = $${i++}`);
      vals.push(storeId);
    }
    const { rows } = await query(
      `
      SELECT p.payment_method AS method,
             COALESCE(SUM(p.amount),0) AS amount, COUNT(p.id) AS count
      FROM payments p INNER JOIN sales s ON s.id = p.sale_id
      WHERE ${conds.join(" AND ")} AND p.payment_status = 'paid'
      GROUP BY p.payment_method ORDER BY amount DESC`,
      vals,
    );
    return rows;
  }

  async salesList({
    storeId,
    userId,
    status,
    paymentMethod,
    from,
    to,
    limit,
    offset,
  }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();
    const conds = [`s.created_at BETWEEN $1 AND $2`, `s.deleted_at IS NULL`];
    const vals = [f, t];
    let i = 3;
    if (storeId) {
      conds.push(`s.store_id = $${i++}`);
      vals.push(storeId);
    }
    if (userId) {
      conds.push(`s.user_id  = $${i++}`);
      vals.push(userId);
    }
    if (status) {
      conds.push(`s.status   = $${i++}`);
      vals.push(status);
    }
    if (paymentMethod) {
      conds.push(`p.payment_method = $${i++}`);
      vals.push(paymentMethod);
    }

    const where = conds.join(" AND ");
    const { rows: cr } = await query(
      `SELECT COUNT(DISTINCT s.id) FROM sales s LEFT JOIN payments p ON p.sale_id = s.id WHERE ${where}`,
      vals,
    );
    const total = parseInt(cr[0].count, 10);

    const { rows } = await query(
      `
      SELECT s.id, s.receipt_number, s.final_amount, s.discount_amount, s.tax_amount,
             s.status, s.created_at, p.payment_method,
             u.first_name, u.last_name,
             st.name AS store_name, st.code AS store_code,
             c.name AS customer_name, c.phone AS customer_phone
      FROM sales s
      INNER JOIN users  u  ON u.id  = s.user_id
      INNER JOIN stores st ON st.id = s.store_id
      LEFT  JOIN customers c  ON c.id  = s.customer_id
      LEFT  JOIN payments  p  ON p.sale_id = s.id
      WHERE ${where}
      ORDER BY s.created_at DESC
      LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset],
    );
    return { rows, total };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INVENTORY REPORT
  // ══════════════════════════════════════════════════════════════════════════

  async inventorySummary({ storeId, categoryId, type }) {
    const sf = storeId ? `AND s.store_id    = '${storeId}'` : "";
    const cf = categoryId ? `AND p.category_id = '${categoryId}'` : "";
    const tf = type ? `AND p.type        = '${type}'` : "";
    const { rows } = await query(`
      SELECT
        COUNT(DISTINCT p.id)                                                         AS total_skus,
        COALESCE(SUM(s.quantity),0)                                                  AS total_units,
        COALESCE(SUM(s.quantity * p.cost_price) FILTER (WHERE p.cost_price IS NOT NULL),0) AS total_stock_value,
        COUNT(DISTINCT s.product_id) FILTER (WHERE s.quantity > 0 AND s.quantity <= 10)    AS low_stock_count,
        COUNT(DISTINCT s.product_id) FILTER (WHERE s.quantity = 0)                         AS out_of_stock_count,
        COUNT(DISTINCT p.id) FILTER (WHERE p.type = 'inventory')                           AS inventory_type_count,
        COUNT(DISTINCT p.id) FILTER (WHERE p.type = 'non-inventory')                       AS non_inventory_count
      FROM products p
      LEFT JOIN stock s ON s.product_id = p.id ${sf}
      WHERE p.is_active = TRUE AND p.deleted_at IS NULL ${cf} ${tf}`);
    return rows[0];
  }

  async inventoryItems({ storeId, categoryId, lowStock, type, limit, offset }) {
    const conds = [`p.is_active = TRUE`, `p.deleted_at IS NULL`];
    const vals = [];
    let i = 1;
    if (storeId) {
      conds.push(`s.store_id    = $${i++}`);
      vals.push(storeId);
    }
    if (categoryId) {
      conds.push(`p.category_id = $${i++}`);
      vals.push(categoryId);
    }
    if (type) {
      conds.push(`p.type        = $${i++}`);
      vals.push(type);
    }
    if (lowStock === true || lowStock === "true")
      conds.push(`COALESCE(s.quantity,0) <= 10`);

    const where = conds.join(" AND ");
    const { rows: cr } = await query(
      `SELECT COUNT(DISTINCT p.id) FROM products p LEFT JOIN stock s ON s.product_id = p.id WHERE ${where}`,
      vals,
    );
    const total = parseInt(cr[0].count, 10);

    const { rows } = await query(
      `
      SELECT p.id AS product_id, p.name AS product_name, p.sku, p.barcode,
             p.type, p.cost_price, c.name AS category_name, pv.variation,
             st.id AS store_id, st.name AS store_name, st.code AS store_code,
             COALESCE(s.quantity,0) AS quantity, s.updated_at AS last_updated
      FROM products p
      LEFT JOIN categories      c  ON c.id  = p.category_id
      LEFT JOIN product_variants pv ON pv.id = p.variant_id
      LEFT JOIN stock           s  ON s.product_id = p.id
      LEFT JOIN stores          st ON st.id = s.store_id AND st.deleted_at IS NULL
      WHERE ${where}
      ORDER BY p.name ASC, st.name ASC
      LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset],
    );
    return { rows, total };
  }

  async inventoryByCategory({ storeId }) {
    const f = storeId ? `AND s.store_id = '${storeId}'` : "";
    const { rows } = await query(`
      SELECT
        COALESCE(c.name,'Uncategorised') AS category_name,
        COALESCE(SUM(s.quantity),0) AS total_units,
        COALESCE(SUM(s.quantity * p.cost_price) FILTER (WHERE p.cost_price IS NOT NULL),0) AS total_value,
        COUNT(DISTINCT p.id) AS sku_count
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN stock      s ON s.product_id = p.id ${f}
      WHERE p.is_active = TRUE AND p.deleted_at IS NULL
      GROUP BY c.name ORDER BY total_value DESC`);
    return rows;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CASHIER REPORT
  // ══════════════════════════════════════════════════════════════════════════

  async cashierStats({ storeId, userId, from, to }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();
    const conds = [`s.created_at BETWEEN $1 AND $2`];
    const vals = [f, t];
    let i = 3;
    if (storeId) {
      conds.push(`s.store_id = $${i++}`);
      vals.push(storeId);
    }
    if (userId) {
      conds.push(`s.user_id  = $${i++}`);
      vals.push(userId);
    }
    const where = conds.join(" AND ");

    const { rows } = await query(
      `
      SELECT
        u.id AS user_id, u.first_name, u.last_name,
        COUNT(s.id)                                             AS transactions,
        COUNT(s.id) FILTER (WHERE s.status = 'completed')      AS completed_transactions,
        COUNT(s.id) FILTER (WHERE s.status = 'cancelled')      AS cancelled_transactions,
        COALESCE(SUM(s.final_amount) FILTER (WHERE s.status = 'completed'),0) AS revenue,
        COALESCE(AVG(s.final_amount) FILTER (WHERE s.status = 'completed'),0) AS avg_order_value,
        MAX(s.created_at)                                       AS last_active_at,
        (SELECT COUNT(*) FROM shifts sh
          WHERE sh.user_id = u.id AND sh.status = 'closed'
            AND sh.opened_at BETWEEN $1 AND $2)                 AS shifts_worked,
        COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (sh.closed_at - sh.opened_at))/3600)
          FROM shifts sh
          WHERE sh.user_id = u.id AND sh.status = 'closed'
            AND sh.opened_at BETWEEN $1 AND $2),0)             AS total_shift_hours
      FROM users u INNER JOIN sales s ON s.user_id = u.id
      WHERE ${where}
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY revenue DESC`,
      vals,
    );
    return rows;
  }

  async cashierPaymentBreakdown({ storeId, userId, from, to }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();
    const conds = [`s.created_at BETWEEN $1 AND $2`, `s.status = 'completed'`];
    const vals = [f, t];
    let i = 3;
    if (storeId) {
      conds.push(`s.store_id = $${i++}`);
      vals.push(storeId);
    }
    if (userId) {
      conds.push(`s.user_id  = $${i++}`);
      vals.push(userId);
    }
    const where = conds.join(" AND ");

    const { rows } = await query(
      `
      SELECT s.user_id, p.payment_method AS method,
             COALESCE(SUM(p.amount),0) AS amount, COUNT(p.id) AS count
      FROM payments p INNER JOIN sales s ON s.id = p.sale_id
      WHERE ${where} AND p.payment_status = 'paid'
      GROUP BY s.user_id, p.payment_method`,
      vals,
    );
    return rows;
  }

  async cashierDailyByUser({ storeId, userId, from, to }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();
    const conds = [`s.status = 'completed'`, `s.created_at BETWEEN $1 AND $2`];
    const vals = [f, t];
    let i = 3;
    if (storeId) {
      conds.push(`s.store_id = $${i++}`);
      vals.push(storeId);
    }
    if (userId) {
      conds.push(`s.user_id  = $${i++}`);
      vals.push(userId);
    }
    const { rows } = await query(
      `
      SELECT DATE(s.created_at) AS date, s.user_id,
             COALESCE(SUM(s.final_amount),0) AS revenue
      FROM sales s WHERE ${conds.join(" AND ")}
      GROUP BY DATE(s.created_at), s.user_id ORDER BY date ASC`,
      vals,
    );
    return rows;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRODUCT REPORT
  // ══════════════════════════════════════════════════════════════════════════

  async productSummary({ storeId, categoryId, from, to }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();
    const conds = [`s.status = 'completed'`, `s.created_at BETWEEN $1 AND $2`];
    const vals = [f, t];
    let i = 3;
    if (storeId) {
      conds.push(`s.store_id    = $${i++}`);
      vals.push(storeId);
    }
    if (categoryId) {
      conds.push(`p.category_id = $${i++}`);
      vals.push(categoryId);
    }
    const { rows } = await query(
      `
      SELECT
        COUNT(DISTINCT si.product_id)                    AS total_products_sold,
        COALESCE(SUM(si.quantity),0)                     AS total_units_sold,
        COALESCE(SUM(si.total_price),0)                  AS total_revenue,
        COALESCE(AVG(si.total_price / NULLIF(si.quantity,0)),0) AS avg_revenue_per_product
      FROM sales_items si
      INNER JOIN sales    s  ON s.id  = si.sale_id
      INNER JOIN products p  ON p.id  = si.product_id
      WHERE ${conds.join(" AND ")}`,
      vals,
    );
    return rows[0];
  }

  async productList({ storeId, categoryId, from, to, sort, limit, offset }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();
    const conds = [`s.status = 'completed'`, `s.created_at BETWEEN $1 AND $2`];
    const vals = [f, t];
    let i = 3;
    if (storeId) {
      conds.push(`s.store_id    = $${i++}`);
      vals.push(storeId);
    }
    if (categoryId) {
      conds.push(`p.category_id = $${i++}`);
      vals.push(categoryId);
    }

    const sortMap = {
      revenue_desc: "revenue DESC",
      revenue_asc: "revenue ASC",
      quantity_desc: "units_sold DESC",
      quantity_asc: "units_sold ASC",
    };
    const orderBy = sortMap[sort] || "revenue DESC";

    const where = conds.join(" AND ");
    const { rows: cr } = await query(
      `SELECT COUNT(DISTINCT si.product_id) FROM sales_items si
       INNER JOIN sales s ON s.id = si.sale_id
       INNER JOIN products p ON p.id = si.product_id
       WHERE ${where}`,
      vals,
    );
    const total = parseInt(cr[0].count, 10);

    const { rows } = await query(
      `
      SELECT
        p.id AS product_id, p.name AS product_name, p.sku, p.type,
        c.name AS category_name, pv.variation,
        COALESCE(SUM(si.total_price),0)    AS revenue,
        COALESCE(SUM(si.quantity),0)       AS units_sold,
        COUNT(DISTINCT si.sale_id)         AS transactions,
        COALESCE(AVG(si.unit_price),0)     AS avg_unit_price,
        CASE WHEN p.type = 'inventory'
          THEN (SELECT COALESCE(SUM(st.quantity),0) FROM stock st
                WHERE st.product_id = p.id
                  ${storeId ? `AND st.store_id = '${storeId}'` : ""})
          ELSE NULL END                    AS current_stock
      FROM sales_items si
      INNER JOIN sales    s  ON s.id  = si.sale_id
      INNER JOIN products p  ON p.id  = si.product_id
      LEFT  JOIN categories c ON c.id = p.category_id
      LEFT  JOIN product_variants pv ON pv.id = p.variant_id
      WHERE ${where}
      GROUP BY p.id, p.name, p.sku, p.type, c.name, pv.variation
      ORDER BY ${orderBy}
      LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset],
    );
    return { rows, total };
  }

  async productByCategory({ storeId, from, to }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();
    const conds = [`s.status = 'completed'`, `s.created_at BETWEEN $1 AND $2`];
    const vals = [f, t];
    let i = 3;
    if (storeId) {
      conds.push(`s.store_id = $${i++}`);
      vals.push(storeId);
    }
    const { rows } = await query(
      `
      SELECT
        COALESCE(c.name,'Uncategorised') AS category_name,
        COALESCE(SUM(si.total_price),0)  AS revenue,
        COALESCE(SUM(si.quantity),0)     AS units_sold,
        COUNT(DISTINCT p.id)             AS product_count
      FROM sales_items si
      INNER JOIN sales    s ON s.id  = si.sale_id
      INNER JOIN products p ON p.id  = si.product_id
      LEFT  JOIN categories c ON c.id = p.category_id
      WHERE ${conds.join(" AND ")}
      GROUP BY c.name ORDER BY revenue DESC`,
      vals,
    );
    return rows;
  }

  // ── Keep legacy methods (still used by report.service.js) ──────────────────
  async salesSummaryLegacy({ from, to, storeId }) {
    return this.salesSummary({ from, to, storeId });
  }
}

export const report1Repository = new Report1Repository();
