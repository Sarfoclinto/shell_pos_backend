import { query } from "../config/database.js";

/**
 * All report queries live here.
 * Every method is read-only — no INSERT, UPDATE, or DELETE.
 *
 * Filters default to a sensible range when not supplied:
 *   from → 30 days ago
 *   to   → now
 */

const defaultFrom = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
};
const defaultTo = () => new Date().toISOString();

class ReportRepository {
  // ── Sales Summary ───────────────────────────────────────────────────────────

  async salesSummary({ from, to, storeId }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();

    const conds = [`s.status = 'completed'`, `s.created_at BETWEEN $1 AND $2`];
    const vals = [f, t];
    let i = 3;
    if (storeId) {
      conds.push(`s.store_id = $${i++}`);
      vals.push(storeId);
    }

    const where = conds.join(" AND ");

    const { rows } = await query(
      `SELECT
         COUNT(s.id)                        AS total_orders,
         COALESCE(SUM(s.total_amount),    0) AS gross_revenue,
         COALESCE(SUM(s.discount_amount), 0) AS total_discounts,
         COALESCE(SUM(s.tax_amount),      0) AS total_tax,
         COALESCE(SUM(s.final_amount),    0) AS net_revenue,
         COALESCE(AVG(s.final_amount),    0) AS avg_order_value,
         COUNT(DISTINCT s.customer_id)       AS unique_customers,
         COUNT(DISTINCT s.user_id)           AS active_cashiers
       FROM sales s
       WHERE ${where}`,
      vals,
    );
    return { ...rows[0], from: f, to: t };
  }

  // ── Sales by Day ────────────────────────────────────────────────────────────

  async salesByDay({ from, to, storeId }) {
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
      `SELECT
         DATE(s.created_at)             AS date,
         COUNT(s.id)                    AS total_orders,
         COALESCE(SUM(s.final_amount),0) AS net_revenue,
         COALESCE(SUM(s.discount_amount),0) AS total_discounts
       FROM sales s
       WHERE ${conds.join(" AND ")}
       GROUP BY DATE(s.created_at)
       ORDER BY date ASC`,
      vals,
    );
    return rows;
  }

  // ── Sales by Payment Method ─────────────────────────────────────────────────

  async salesByPaymentMethod({ from, to, storeId }) {
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
      `SELECT
         p.payment_method                        AS method,
         COUNT(p.id)                             AS transaction_count,
         COALESCE(SUM(p.amount), 0)              AS total_amount
       FROM payments p
       INNER JOIN sales s ON s.id = p.sale_id
       WHERE ${conds.join(" AND ")}
         AND p.payment_status = 'paid'
       GROUP BY p.payment_method
       ORDER BY total_amount DESC`,
      vals,
    );
    return rows;
  }

  // ── Top Products ────────────────────────────────────────────────────────────

  async topProducts({ from, to, storeId, limit }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();
    const lim = limit || 10;

    const conds = [`s.status = 'completed'`, `s.created_at BETWEEN $1 AND $2`];
    const vals = [f, t];
    let i = 3;
    if (storeId) {
      conds.push(`s.store_id = $${i++}`);
      vals.push(storeId);
    }

    const { rows } = await query(
      `SELECT
         p.id                              AS product_id,
         p.name                            AS product_name,
         p.sku,
         c.name                            AS category_name,
         SUM(si.quantity)                  AS total_qty_sold,
         COALESCE(SUM(si.total_price), 0)  AS total_revenue,
         COUNT(DISTINCT s.id)              AS order_count
       FROM sales_items si
       INNER JOIN sales    s  ON s.id  = si.sale_id
       INNER JOIN products p  ON p.id  = si.product_id
       LEFT  JOIN categories c ON c.id  = p.category_id
       WHERE ${conds.join(" AND ")}
       GROUP BY p.id, p.name, p.sku, c.name
       ORDER BY total_revenue DESC
       LIMIT $${i}`,
      [...vals, lim],
    );
    return rows;
  }

  // ── Top Customers ───────────────────────────────────────────────────────────

  async topCustomers({ from, to, storeId, limit }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();
    const lim = limit || 10;

    const conds = [
      `s.status = 'completed'`,
      `s.created_at BETWEEN $1 AND $2`,
      `s.customer_id IS NOT NULL`,
    ];
    const vals = [f, t];
    let i = 3;
    if (storeId) {
      conds.push(`s.store_id = $${i++}`);
      vals.push(storeId);
    }

    const { rows } = await query(
      `SELECT
         c.id                              AS customer_id,
         c.name                            AS customer_name,
         c.phone,
         c.loyalty_points,
         COUNT(s.id)                       AS total_orders,
         COALESCE(SUM(s.final_amount), 0)  AS lifetime_spend,
         MAX(s.created_at)                 AS last_purchase_at
       FROM sales s
       INNER JOIN customers c ON c.id = s.customer_id
       WHERE ${conds.join(" AND ")}
       GROUP BY c.id, c.name, c.phone, c.loyalty_points
       ORDER BY lifetime_spend DESC
       LIMIT $${i}`,
      [...vals, lim],
    );
    return rows;
  }

  // ── Stock Levels ────────────────────────────────────────────────────────────

  async stockLevels({ storeId, categoryId, limit, offset }) {
    const conds = [`p.deleted_at IS NULL`, `p.is_active = TRUE`];
    const vals = [];
    let i = 1;

    if (storeId) {
      conds.push(`st.id = $${i++}`);
      vals.push(storeId);
    }
    if (categoryId) {
      conds.push(`p.category_id = $${i++}`);
      vals.push(categoryId);
    }

    const where = conds.join(" AND ");

    const { rows: countRows } = await query(
      `SELECT COUNT(DISTINCT p.id) FROM products p
       LEFT JOIN stock s ON s.product_id = p.id
       LEFT JOIN stores st ON st.id = s.store_id
       WHERE ${where}`,
      vals,
    );
    const total = parseInt(countRows[0].count, 10);

    const { rows } = await query(
      `SELECT
         p.id                AS product_id,
         p.name              AS product_name,
         p.sku,
         p.type,
         c.name              AS category_name,
         pv.variation,
         COALESCE(
           json_agg(
             json_build_object(
               'storeId',   st.id,
               'storeName', st.name,
               'storeCode', st.code,
               'quantity',  COALESCE(s.quantity, 0)
             ) ORDER BY st.name
           ) FILTER (WHERE st.id IS NOT NULL),
           '[]'
         )                   AS stock_by_store,
         COALESCE(SUM(s.quantity), 0) AS total_quantity
       FROM products p
       LEFT JOIN categories    c  ON c.id  = p.category_id
       LEFT JOIN product_variants pv ON pv.id = p.variant_id
       LEFT JOIN stock         s  ON s.product_id = p.id
       LEFT JOIN stores        st ON st.id = s.store_id AND st.deleted_at IS NULL
       WHERE ${where}
       GROUP BY p.id, p.name, p.sku, p.type, c.name, pv.variation
       ORDER BY p.name ASC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset],
    );

    return { rows, total };
  }

  // ── Low Stock ───────────────────────────────────────────────────────────────
  // Products where quantity_on_hand ≤ reorder_level.
  // We use a fixed reorder_level of 10 since our schema
  // stores reorder_level on the stock table via the old inventory table.
  // For now we surface products with total stock ≤ 10.

  async lowStock({ storeId }) {
    const conds = [
      `p.deleted_at IS NULL`,
      `p.is_active = TRUE`,
      `p.type = 'inventory'`,
    ];
    const vals = [];
    let i = 1;

    if (storeId) {
      conds.push(`s.store_id = $${i++}`);
      vals.push(storeId);
    } else {
      conds.push(`s.store_id IS NOT NULL`);
    }

    const { rows } = await query(
      `SELECT
         p.id           AS product_id,
         p.name         AS product_name,
         p.sku,
         c.name         AS category_name,
         st.id          AS store_id,
         st.name        AS store_name,
         st.code        AS store_code,
         s.quantity     AS current_quantity,
         10             AS reorder_level
       FROM products p
       INNER JOIN stock  s  ON s.product_id = p.id
       INNER JOIN stores st ON st.id = s.store_id AND st.deleted_at IS NULL
       LEFT  JOIN categories c ON c.id = p.category_id
       WHERE ${conds.join(" AND ")}
         AND s.quantity <= 10
       ORDER BY s.quantity ASC, p.name ASC`,
      vals,
    );
    return rows;
  }

  // ── Stock Movement Log ──────────────────────────────────────────────────────

  async stockMovementLog({
    storeId,
    productId,
    movementType,
    from,
    to,
    limit,
    offset,
  }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();

    const conds = [`sm.created_at BETWEEN $1 AND $2`];
    const vals = [f, t];
    let i = 3;

    if (storeId) {
      conds.push(`sm.store_id      = $${i++}`);
      vals.push(storeId);
    }
    if (productId) {
      conds.push(`sm.product_id    = $${i++}`);
      vals.push(productId);
    }
    if (movementType) {
      conds.push(`sm.movement_type = $${i++}`);
      vals.push(movementType);
    }

    const where = conds.join(" AND ");

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM stock_movements sm WHERE ${where}`,
      vals,
    );
    const total = parseInt(countRows[0].count, 10);

    const { rows } = await query(
      `SELECT
         sm.id,
         sm.movement_type,
         sm.quantity_change,
         sm.reference_type,
         sm.reference_id,
         sm.note,
         sm.created_at,
         p.name   AS product_name,
         p.sku    AS product_sku,
         st.name  AS store_name,
         st.code  AS store_code,
         u.first_name,
         u.last_name
       FROM stock_movements sm
       INNER JOIN products p  ON p.id  = sm.product_id
       INNER JOIN stores   st ON st.id = sm.store_id
       LEFT  JOIN users    u  ON u.id  = sm.created_by
       WHERE ${where}
       ORDER BY sm.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, limit, offset],
    );

    return { rows, total };
  }

  // ── Shift Summary ───────────────────────────────────────────────────────────

  async shiftSummary({ storeId, userId, from, to }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();

    const conds = [`sh.opened_at BETWEEN $1 AND $2`];
    const vals = [f, t];
    let i = 3;

    if (storeId) {
      conds.push(`sh.store_id = $${i++}`);
      vals.push(storeId);
    }
    if (userId) {
      conds.push(`sh.user_id  = $${i++}`);
      vals.push(userId);
    }

    const where = conds.join(" AND ");

    // Aggregate stats across all matching shifts
    const { rows: summary } = await query(
      `SELECT
         COUNT(sh.id)                                           AS total_shifts,
         COUNT(sh.id) FILTER (WHERE sh.status = 'open')        AS open_shifts,
         COUNT(sh.id) FILTER (WHERE sh.status = 'closed')      AS closed_shifts,
         COALESCE(SUM(sh.opening_float), 0)                    AS total_opening_float,
         COALESCE(SUM(sh.closing_cash)
           FILTER (WHERE sh.status = 'closed'), 0)             AS total_closing_cash,
         COALESCE(SUM(sh.expected_cash)
           FILTER (WHERE sh.status = 'closed'), 0)             AS total_expected_cash,
         COALESCE(SUM(sh.difference)
           FILTER (WHERE sh.status = 'closed'), 0)             AS total_difference
       FROM shifts sh
       WHERE ${where}`,
      vals,
    );

    // Per-shift detail rows
    const { rows: shifts } = await query(
      `SELECT
         sh.id, sh.status, sh.opened_at, sh.closed_at,
         sh.opening_float, sh.closing_cash, sh.expected_cash, sh.difference,
         u.first_name, u.last_name,
         st.name  AS store_name,
         st.code  AS store_code,
         COUNT(s.id) FILTER (WHERE s.status = 'completed') AS completed_sales,
         COALESCE(SUM(s.final_amount)
           FILTER (WHERE s.status = 'completed'), 0)        AS shift_revenue
       FROM shifts sh
       INNER JOIN users  u  ON u.id  = sh.user_id
       INNER JOIN stores st ON st.id = sh.store_id
       LEFT  JOIN sales  s  ON s.shift_id = sh.id
       WHERE ${where}
       GROUP BY sh.id, u.first_name, u.last_name, st.name, st.code
       ORDER BY sh.opened_at DESC`,
      vals,
    );

    return { summary: summary[0], shifts };
  }

  // ── Purchase Orders Summary ─────────────────────────────────────────────────

  async purchaseOrdersSummary({ storeId, supplierId, from, to }) {
    const f = from || defaultFrom();
    const t = to || defaultTo();

    const conds = [`po.order_date BETWEEN $1 AND $2`];
    const vals = [f, t];
    let i = 3;

    if (storeId) {
      conds.push(`po.store_id    = $${i++}`);
      vals.push(storeId);
    }
    if (supplierId) {
      conds.push(`po.supplier_id = $${i++}`);
      vals.push(supplierId);
    }

    const where = conds.join(" AND ");

    const { rows: summary } = await query(
      `SELECT
         COUNT(po.id)                                              AS total_orders,
         COUNT(po.id) FILTER (WHERE po.status = 'pending')        AS pending,
         COUNT(po.id) FILTER (WHERE po.status = 'ordered')        AS ordered,
         COUNT(po.id) FILTER (WHERE po.status = 'received')       AS received,
         COUNT(po.id) FILTER (WHERE po.status = 'cancelled')      AS cancelled,
         COALESCE(SUM(po.total_amount)
           FILTER (WHERE po.status != 'cancelled'), 0)            AS total_spend
       FROM purchase_orders po
       WHERE ${where}`,
      vals,
    );

    const { rows: bySupplier } = await query(
      `SELECT
         sp.id                                                    AS supplier_id,
         sp.name                                                  AS supplier_name,
         COUNT(po.id)                                             AS order_count,
         COALESCE(SUM(po.total_amount)
           FILTER (WHERE po.status != 'cancelled'), 0)           AS total_spend
       FROM purchase_orders po
       INNER JOIN suppliers sp ON sp.id = po.supplier_id
       WHERE ${where}
       GROUP BY sp.id, sp.name
       ORDER BY total_spend DESC`,
      vals,
    );

    return { summary: summary[0], bySupplier };
  }
}

export const reportRepository = new ReportRepository();
