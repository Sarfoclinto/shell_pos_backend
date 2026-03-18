import { query } from '../config/database.js';

export const reportService = {
  async salesSummary({ from, to }) {
    const { rows } = await query(
      `SELECT
         COUNT(*)                          AS total_orders,
         SUM(total_amount)                 AS total_revenue,
         SUM(tax_amount)                   AS total_tax,
         SUM(discount_amount)              AS total_discounts,
         AVG(total_amount)                 AS avg_order_value,
         COUNT(DISTINCT customer_id)       AS unique_customers
       FROM orders
       WHERE status = 'completed'
         AND created_at BETWEEN $1 AND $2`,
      [from, to]
    );
    return rows[0];
  },

  async topProducts({ from, to, limit = 10 }) {
    const { rows } = await query(
      `SELECT
         p.id, p.name, p.sku,
         SUM(oi.quantity)           AS total_sold,
         SUM(oi.subtotal)           AS total_revenue
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN orders   o ON o.id = oi.order_id
       WHERE o.status = 'completed'
         AND o.created_at BETWEEN $1 AND $2
       GROUP BY p.id, p.name, p.sku
       ORDER BY total_revenue DESC
       LIMIT $3`,
      [from, to, limit]
    );
    return rows;
  },

  async dailySales({ from, to }) {
    const { rows } = await query(
      `SELECT
         DATE(created_at)      AS date,
         COUNT(*)              AS total_orders,
         SUM(total_amount)     AS total_revenue
       FROM orders
       WHERE status = 'completed'
         AND created_at BETWEEN $1 AND $2
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [from, to]
    );
    return rows;
  },
};
