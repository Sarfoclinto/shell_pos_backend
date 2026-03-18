import { BaseRepository } from './base.repository.js';
import { OrderModel } from '../models/order.model.js';
import { query } from '../config/database.js';

class OrderRepository extends BaseRepository {
  constructor() { super(OrderModel.table); }

  async findWithDetails(id) {
    const { rows } = await query(
      `SELECT o.*,
              c.name  AS customer_name,
              c.email AS customer_email,
              u.name  AS cashier_name,
              json_agg(
                json_build_object(
                  'id',         oi.id,
                  'product_id', oi.product_id,
                  'name',       p.name,
                  'sku',        p.sku,
                  'quantity',   oi.quantity,
                  'unit_price', oi.unit_price,
                  'discount',   oi.discount,
                  'tax_amount', oi.tax_amount,
                  'subtotal',   oi.subtotal
                )
              ) AS items
       FROM orders o
       LEFT JOIN customers  c  ON c.id = o.customer_id
       LEFT JOIN users      u  ON u.id = o.cashier_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products   p  ON p.id = oi.product_id
       WHERE o.id = $1 AND o.deleted_at IS NULL
       GROUP BY o.id, c.name, c.email, u.name`,
      [id]
    );
    return rows[0] || null;
  }

  async generateOrderNumber() {
    const date = new Date();
    const prefix = `ORD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const { rows } = await query(
      `SELECT COUNT(*) FROM orders WHERE order_number LIKE $1`,
      [`${prefix}%`]
    );
    const seq = String(parseInt(rows[0].count, 10) + 1).padStart(4, '0');
    return `${prefix}-${seq}`;
  }
}

export const orderRepository = new OrderRepository();
