import { query } from "../config/database.js";

/**
 * All dashboard queries.
 * Every method is read-only — SELECT only.
 * Queries are intentionally separate (not one giant JOIN) for
 * clarity, maintainability, and independent caching later.
 */

// ── Date helpers ───────────────────────────────────────────────────────────────

const now = () => new Date();
const startOfDay = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
const startOfWeek = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
const startOfMonth = () =>
  new Date(now().getFullYear(), now().getMonth(), 1).toISOString();
const startOfLastMonth = () =>
  new Date(now().getFullYear(), now().getMonth() - 1, 1).toISOString();
const endOfLastMonth = () =>
  new Date(now().getFullYear(), now().getMonth(), 0, 23, 59, 59).toISOString();
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

class DashboardRepository {
  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN DASHBOARD QUERIES
  // ══════════════════════════════════════════════════════════════════════════

  async adminRevenue(storeId) {
    const filter = storeId ? `AND s.store_id = '${storeId}'` : "";

    const { rows } = await query(
      `
      SELECT
        COALESCE(SUM(final_amount), 0)                                           AS total,
        COALESCE(SUM(final_amount) FILTER (WHERE s.created_at >= $1), 0)         AS today,
        COALESCE(SUM(final_amount) FILTER (WHERE s.created_at >= $2), 0)         AS this_week,
        COALESCE(SUM(final_amount) FILTER (WHERE s.created_at >= $3), 0)         AS this_month,
        COALESCE(SUM(final_amount) FILTER (
          WHERE s.created_at >= $4 AND s.created_at <= $5), 0)                   AS last_month
      FROM sales s
      WHERE s.status = 'completed' ${filter}`,
      [
        startOfDay(),
        startOfWeek(),
        startOfMonth(),
        startOfLastMonth(),
        endOfLastMonth(),
      ],
    );
    return rows[0];
  }

  async adminTransactions(storeId) {
    const filter = storeId ? `AND store_id = '${storeId}'` : "";

    const { rows } = await query(
      `
      SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE created_at >= $1)         AS today,
        COUNT(*) FILTER (WHERE status = 'completed')     AS completed,
        COUNT(*) FILTER (WHERE status = 'pending')       AS pending,
        COUNT(*) FILTER (WHERE status = 'cancelled')     AS cancelled
      FROM sales WHERE 1=1 ${filter}`,
      [startOfDay()],
    );
    return rows[0];
  }

  async adminInventory(storeId) {
    const stockFilter = storeId ? `AND s.store_id = '${storeId}'` : "";

    const { rows } = await query(`
      SELECT
        COUNT(DISTINCT p.id)                                              AS total_skus,
        COUNT(DISTINCT s.product_id)
          FILTER (WHERE s.quantity > 0 AND s.quantity <= 10)             AS low_stock_count,
        COUNT(DISTINCT s.product_id)
          FILTER (WHERE s.quantity = 0)                                  AS out_of_stock_count,
        COALESCE(
          SUM(s.quantity * p.cost_price)
            FILTER (WHERE p.cost_price IS NOT NULL),
          0
        )                                                                AS total_stock_value
      FROM products p
      LEFT JOIN stock s ON s.product_id = p.id ${stockFilter}
      WHERE p.is_active = TRUE AND p.deleted_at IS NULL`);
    return rows[0];
  }

  async adminCustomers(storeId, from) {
    // customers are not store-scoped in schema, but sales are
    // "newThisPeriod" = customers who made their first purchase in period at this store
    const { rows } = await query(
      `
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE created_at >= $1)             AS new_this_period
      FROM customers
      WHERE deleted_at IS NULL`,
      [from || daysAgo(30)],
    );
    return rows[0];
  }

  async adminUsers(storeId) {
    const filter = storeId ? `AND store_id = '${storeId}'` : "";

    const { rows } = await query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE is_active = TRUE AND deleted_at IS NULL ${filter}) AS total,
        (SELECT COUNT(*) FROM shifts sh WHERE sh.status = 'open'
          ${storeId ? `AND sh.store_id = '${storeId}'` : ""}) AS active_shifts`);
    return rows[0];
  }

  async adminSuppliers() {
    const { rows } = await query(`
      SELECT
        (SELECT COUNT(*) FROM suppliers WHERE is_active = TRUE AND deleted_at IS NULL) AS total,
        (SELECT COUNT(*) FROM purchase_orders WHERE status IN ('pending', 'ordered'))  AS pending_orders`);
    return rows[0];
  }

  async adminRevenueByDay(storeId) {
    const filter = storeId ? `AND store_id = '${storeId}'` : "";

    const { rows } = await query(
      `
      SELECT
        DATE(created_at)              AS date,
        COALESCE(SUM(final_amount),0) AS revenue,
        COUNT(*)                      AS transactions
      FROM sales
      WHERE status = 'completed'
        AND created_at >= $1
        ${filter}
      GROUP BY DATE(created_at)
      ORDER BY date ASC`,
      [daysAgo(30)],
    );
    return rows;
  }

  async adminSalesByPaymentMethod(storeId) {
    const filter = storeId ? `AND s.store_id = '${storeId}'` : "";

    const { rows } = await query(`
      SELECT
        p.payment_method        AS method,
        COALESCE(SUM(p.amount), 0) AS amount,
        COUNT(p.id)             AS count
      FROM payments p
      INNER JOIN sales s ON s.id = p.sale_id
      WHERE s.status = 'completed'
        AND p.payment_status = 'paid'
        ${filter}
      GROUP BY p.payment_method
      ORDER BY amount DESC`);
    return rows;
  }

  async adminSalesByStore() {
    const { rows } = await query(`
      SELECT
        st.id                         AS store_id,
        st.name                       AS store_name,
        st.code                       AS store_code,
        COALESCE(SUM(s.final_amount), 0) AS revenue,
        COUNT(s.id)                   AS transactions
      FROM stores st
      LEFT JOIN sales s ON s.store_id = st.id AND s.status = 'completed'
      WHERE st.deleted_at IS NULL
      GROUP BY st.id, st.name, st.code
      ORDER BY revenue DESC`);
    return rows;
  }

  async adminTopProducts(storeId) {
    const filter = storeId ? `AND s.store_id = '${storeId}'` : "";

    const { rows } = await query(`
      SELECT
        p.id                            AS product_id,
        p.name                          AS product_name,
        p.sku,
        COALESCE(SUM(si.total_price),0) AS revenue,
        COALESCE(SUM(si.quantity),0)    AS quantity_sold
      FROM sales_items si
      INNER JOIN products p ON p.id = si.product_id
      INNER JOIN sales    s ON s.id = si.sale_id
      WHERE s.status = 'completed' ${filter}
      GROUP BY p.id, p.name, p.sku
      ORDER BY revenue DESC
      LIMIT 10`);
    return rows;
  }

  async adminRecentSales(storeId) {
    const filter = storeId ? `AND s.store_id = '${storeId}'` : "";

    const { rows } = await query(`
      SELECT
        s.id, s.receipt_number, s.final_amount, s.status,
        s.created_at,
        p.payment_method,
        u.first_name AS cashier_first, u.last_name AS cashier_last,
        st.name AS store_name, st.code AS store_code,
        c.name AS customer_name
      FROM sales s
      INNER JOIN users  u  ON u.id  = s.user_id
      INNER JOIN stores st ON st.id = s.store_id
      LEFT  JOIN customers c  ON c.id  = s.customer_id
      LEFT  JOIN payments  p  ON p.sale_id = s.id
      WHERE s.deleted_at IS NULL ${filter}
      ORDER BY s.created_at DESC
      LIMIT 8`);
    return rows;
  }

  async adminOpenShifts(storeId) {
    const filter = storeId ? `AND sh.store_id = '${storeId}'` : "";

    const { rows } = await query(`
      SELECT
        sh.id, sh.opened_at, sh.opening_float,
        u.first_name, u.last_name,
        st.name AS store_name, st.code AS store_code,
        COUNT(s.id) FILTER (WHERE s.status = 'completed') AS completed_transactions,
        COALESCE(SUM(s.final_amount) FILTER (WHERE s.status = 'completed'), 0) AS total_revenue
      FROM shifts sh
      INNER JOIN users  u  ON u.id  = sh.user_id
      INNER JOIN stores st ON st.id = sh.store_id
      LEFT  JOIN sales  s  ON s.shift_id = sh.id
      WHERE sh.status = 'open' ${filter}
      GROUP BY sh.id, u.first_name, u.last_name, st.name, st.code
      ORDER BY sh.opened_at ASC`);
    return rows;
  }

  async adminAlerts(storeId) {
    const storeFilter = storeId ? `AND store_id = '${storeId}'` : "";

    const { rows } = await query(`
      SELECT
        (SELECT COUNT(*) FROM inventory_adjustments
          WHERE status = 'pending' ${storeFilter})                              AS pending_adjustments,
        (SELECT COUNT(*) FROM stock_transfers
          WHERE status = 'pending'
            ${
              storeId
                ? `AND (from_store_id = '${storeId}' OR to_store_id = '${storeId}')`
                : ""
            })                                                             AS pending_transfers,
        (SELECT COUNT(*) FROM purchase_orders
          WHERE status IN ('pending','ordered') ${storeFilter})                 AS pending_purchase_orders,
        (SELECT COUNT(*) FROM shifts
          WHERE status = 'open'
            AND opened_at < NOW() - INTERVAL '12 hours' ${storeFilter})        AS stale_shifts`);
    return rows[0];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CASHIER DASHBOARD QUERIES
  // ══════════════════════════════════════════════════════════════════════════

  async cashierCurrentShift(userId, storeId) {
    const { rows } = await query(
      `
      SELECT
        sh.id, sh.opened_at, sh.opening_float, sh.status,
        EXTRACT(EPOCH FROM (NOW() - sh.opened_at)) / 60           AS duration_minutes,
        COUNT(s.id) FILTER (WHERE s.status = 'completed')         AS completed_transactions,
        COALESCE(SUM(s.final_amount)
          FILTER (WHERE s.status = 'completed'), 0)               AS total_revenue,
        COALESCE(sh.expected_cash, sh.opening_float +
          COALESCE(SUM(p.amount)
            FILTER (WHERE p.payment_method = 'cash'
              AND p.payment_status = 'paid'), 0))                  AS expected_cash,
        COALESCE(SUM(p.amount)
          FILTER (WHERE p.payment_method = 'cash'
            AND p.payment_status = 'paid'), 0)                     AS cash_sales,
        COALESCE(SUM(p.amount)
          FILTER (WHERE p.payment_method = 'card'
            AND p.payment_status = 'paid'), 0)                     AS card_sales,
        COALESCE(SUM(p.amount)
          FILTER (WHERE p.payment_method = 'mobile_money'
            AND p.payment_status = 'paid'), 0)                     AS momo_sales,
        COALESCE(SUM(p.amount)
          FILTER (WHERE p.payment_method = 'split'
            AND p.payment_status = 'paid'), 0)                     AS split_sales
      FROM shifts sh
      LEFT JOIN sales    s  ON s.shift_id = sh.id
      LEFT JOIN payments p  ON p.sale_id  = s.id
      WHERE sh.user_id  = $1
        AND sh.store_id = $2
        AND sh.status   = 'open'
      GROUP BY sh.id
      LIMIT 1`,
      [userId, storeId],
    );
    return rows[0] || null;
  }

  async cashierTodayStats(userId) {
    const { rows } = await query(
      `
      SELECT
        COALESCE(SUM(s.final_amount) FILTER (WHERE s.status = 'completed'), 0)  AS revenue,
        COUNT(s.id)                                                             AS transactions,
        COUNT(s.id) FILTER (WHERE s.status = 'completed')                       AS completed_count,
        COUNT(s.id) FILTER (WHERE s.status = 'cancelled')                       AS cancelled_count,
        COALESCE(AVG(s.final_amount) FILTER (WHERE s.status = 'completed'), 0)  AS avg_order_value,
        MODE() WITHIN GROUP
          (ORDER BY p.payment_method)     AS top_payment_method
      FROM sales s
      LEFT JOIN payments p ON p.sale_id = s.id AND p.payment_status = 'paid' AND s.status = 'completed'
      WHERE s.user_id    = $1
        AND s.created_at >= $2`,
      [userId, startOfDay()],
    );
    return rows[0];
  }

  async cashierShiftRevenueByHour(shiftId) {
    if (!shiftId) return [];

    const { rows } = await query(
      `
      SELECT
        TO_CHAR(DATE_TRUNC('hour', s.created_at), 'HH24:00') AS hour,
        COALESCE(SUM(s.final_amount), 0)                      AS revenue,
        COUNT(s.id)                                           AS count
      FROM sales s
      WHERE s.shift_id  = $1
        AND s.status    = 'completed'
      GROUP BY DATE_TRUNC('hour', s.created_at)
      ORDER BY DATE_TRUNC('hour', s.created_at) ASC`,
      [shiftId],
    );
    return rows;
  }

  async cashierRecentSales(userId) {
    const { rows } = await query(
      `
      SELECT
        s.id, s.receipt_number, s.final_amount, s.status, s.created_at,
        p.payment_method,
        c.name AS customer_name
      FROM sales s
      LEFT JOIN payments  p ON p.sale_id = s.id
      LEFT JOIN customers c ON c.id      = s.customer_id
      WHERE s.user_id     = $1
        AND s.deleted_at IS NULL
      ORDER BY s.created_at DESC
      LIMIT 8`,
      [userId],
    );
    return rows;
  }

  async cashierShiftPaymentBreakdown(shiftId) {
    if (!shiftId) return [];

    const { rows } = await query(
      `
      SELECT
        p.payment_method        AS method,
        COALESCE(SUM(p.amount), 0) AS amount,
        COUNT(p.id)             AS count
      FROM payments p
      INNER JOIN sales s ON s.id = p.sale_id
      WHERE s.shift_id       = $1
        AND s.status         = 'completed'
        AND p.payment_status = 'paid'
      GROUP BY p.payment_method
      ORDER BY amount DESC`,
      [shiftId],
    );
    return rows;
  }

  async cashierAllTimeStats(userId) {
    const { rows } = await query(
      `
      SELECT
        COALESCE(SUM(s.final_amount), 0)    AS total_revenue,
        COUNT(s.id)                         AS total_transactions,
        (SELECT COUNT(*) FROM shifts
          WHERE user_id = $1
            AND status  = 'closed')         AS shifts_completed
      FROM sales s
      WHERE s.user_id  = $1
        AND s.status   = 'completed'`,
      [userId],
    );
    return rows[0];
  }
}

export const dashboardRepository = new DashboardRepository();

import { query as _q } from "../config/database.js";

const _now = () => new Date();
const _startDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
const _startWeek = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
const _startMonth = () =>
  new Date(_now().getFullYear(), _now().getMonth(), 1).toISOString();
const _startLast = () =>
  new Date(_now().getFullYear(), _now().getMonth() - 1, 1).toISOString();
const _endLast = () =>
  new Date(
    _now().getFullYear(),
    _now().getMonth(),
    0,
    23,
    59,
    59,
  ).toISOString();

dashboardRepository.managerRevenue = async (storeId) => {
  const f = storeId ? `AND s.store_id = '${storeId}'` : "";
  const { rows } = await _q(
    `
    SELECT
      COALESCE(SUM(final_amount),0)                                        AS total,
      COALESCE(SUM(final_amount) FILTER (WHERE s.created_at >= $1),0)     AS today,
      COALESCE(SUM(final_amount) FILTER (WHERE s.created_at >= $2),0)     AS this_week,
      COALESCE(SUM(final_amount) FILTER (WHERE s.created_at >= $3),0)     AS this_month,
      COALESCE(SUM(final_amount) FILTER (
        WHERE s.created_at >= $4 AND s.created_at <= $5),0)               AS last_month
    FROM sales s WHERE s.status = 'completed' ${f}`,
    [_startDay(), _startWeek(), _startMonth(), _startLast(), _endLast()],
  );
  return rows[0];
};

dashboardRepository.managerTransactions = async (storeId) => {
  const f = storeId ? `AND store_id = '${storeId}'` : "";
  const { rows } = await _q(
    `
    SELECT
      COUNT(*)                                        AS total,
      COUNT(*) FILTER (WHERE created_at >= $1)       AS today,
      COUNT(*) FILTER (WHERE status = 'completed')   AS completed,
      COUNT(*) FILTER (WHERE status = 'pending')     AS pending,
      COUNT(*) FILTER (WHERE status = 'cancelled')   AS cancelled
    FROM sales WHERE 1=1 ${f}`,
    [_startDay()],
  );
  return rows[0];
};

dashboardRepository.managerInventory = async (storeId) => {
  const f = storeId ? `AND s.store_id = '${storeId}'` : "";
  const { rows } = await _q(`
    SELECT
      COUNT(DISTINCT p.id)                                                AS total_skus,
      COUNT(DISTINCT s.product_id) FILTER (WHERE s.quantity > 0 AND s.quantity <= 10) AS low_stock_count,
      COUNT(DISTINCT s.product_id) FILTER (WHERE s.quantity = 0)        AS out_of_stock_count
    FROM products p
    LEFT JOIN stock s ON s.product_id = p.id ${f}
    WHERE p.is_active = TRUE AND p.deleted_at IS NULL`);
  return rows[0];
};

dashboardRepository.managerShifts = async (storeId) => {
  const f = storeId ? `AND store_id = '${storeId}'` : "";
  const { rows } = await _q(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'open')                            AS active_now,
      COUNT(*) FILTER (WHERE status = 'open' AND opened_at < NOW() - INTERVAL '12 hours') AS stale_count
    FROM shifts WHERE 1=1 ${f}`);
  return rows[0];
};

dashboardRepository.managerRevenueByDay = async (storeId, from) => {
  const f = storeId ? `AND store_id = '${storeId}'` : "";
  const { rows } = await _q(
    `
    SELECT DATE(created_at) AS date,
           COALESCE(SUM(final_amount),0) AS revenue,
           COUNT(*) AS transactions
    FROM sales
    WHERE status = 'completed' AND created_at >= $1 ${f}
    GROUP BY DATE(created_at) ORDER BY date ASC`,
    [from],
  );
  return rows;
};

dashboardRepository.managerSalesByPaymentMethod = async (storeId, from, to) => {
  const f = storeId ? `AND s.store_id = '${storeId}'` : "";
  const { rows } = await _q(
    `
    SELECT p.payment_method AS method,
           COALESCE(SUM(p.amount),0) AS amount,
           COUNT(p.id) AS count
    FROM payments p
    INNER JOIN sales s ON s.id = p.sale_id
    WHERE s.status = 'completed' AND p.payment_status = 'paid'
      AND s.created_at BETWEEN $1 AND $2 ${f}
    GROUP BY p.payment_method ORDER BY amount DESC`,
    [from, to],
  );
  return rows;
};

dashboardRepository.managerCashierSummary = async (storeId, from, to) => {
  const f = storeId ? `AND s.store_id = '${storeId}'` : "";
  const { rows } = await _q(
    `
    SELECT
      u.id AS user_id, u.first_name, u.last_name,
      COUNT(s.id) AS transactions,
      COALESCE(SUM(s.final_amount),0) AS revenue,
      COALESCE(AVG(s.final_amount),0) AS avg_order_value
    FROM users u
    INNER JOIN sales s ON s.user_id = u.id
    WHERE s.status = 'completed' AND s.created_at BETWEEN $1 AND $2 ${f}
    GROUP BY u.id, u.first_name, u.last_name
    ORDER BY revenue DESC LIMIT 10`,
    [from, to],
  );
  return rows;
};

dashboardRepository.managerLowStockAlerts = async (storeId) => {
  const f = storeId ? `AND st.id = '${storeId}'` : "";
  const { rows } = await _q(`
    SELECT p.id AS product_id, p.name AS product_name, p.sku,
           s.quantity, st.name AS store_name, st.code AS store_code
    FROM stock s
    INNER JOIN products p ON p.id  = s.product_id
    INNER JOIN stores  st ON st.id = s.store_id
    WHERE s.quantity <= 10 AND p.is_active = TRUE
      AND p.deleted_at IS NULL AND p.type = 'inventory' ${f}
    ORDER BY s.quantity ASC LIMIT 10`);
  return rows;
};

dashboardRepository.managerRecentSales = async (storeId) => {
  const f = storeId ? `AND s.store_id = '${storeId}'` : "";
  const { rows } = await _q(`
    SELECT s.id, s.receipt_number, s.final_amount, s.status, s.created_at,
           p.payment_method,
           u.first_name AS cashier_first, u.last_name AS cashier_last,
           st.name AS store_name, st.code AS store_code,
           c.name AS customer_name
    FROM sales s
    INNER JOIN users  u  ON u.id  = s.user_id
    INNER JOIN stores st ON st.id = s.store_id
    LEFT  JOIN customers c  ON c.id  = s.customer_id
    LEFT  JOIN payments  p  ON p.sale_id = s.id
    WHERE s.deleted_at IS NULL ${f}
    ORDER BY s.created_at DESC LIMIT 8`);
  return rows;
};
