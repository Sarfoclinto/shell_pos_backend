import { orderRepository } from '../repositories/order.repository.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';
import { withTransaction } from '../config/database.js';
import { ApiError } from '../utils/api-error.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { OrderModel } from '../models/order.model.js';

export const orderService = {
  async list(query) {
    const { page, limit, offset } = paginate(query);
    const [rows, total] = await Promise.all([
      orderRepository.findAll({ limit, offset }),
      orderRepository.count(),
    ]);
    return paginatedResponse(rows, total, page, limit);
  },

  async getById(id) {
    const order = await orderRepository.findWithDetails(id);
    if (!order) throw ApiError.notFound('Order not found');
    return order;
  },

  async create({ items, customer_id, cashier_id, discount_amount = 0, notes, payment }) {
    if (!items?.length) throw ApiError.badRequest('Order must have at least one item');

    return withTransaction(async (client) => {
      const order_number = await orderRepository.generateOrderNumber();

      let subtotal = 0;
      let tax_amount = 0;

      // Validate stock and compute totals
      for (const item of items) {
        const inv = await inventoryRepository.findByProductId(item.product_id);
        if (!inv || inv.quantity_on_hand < item.quantity) {
          throw ApiError.badRequest(`Insufficient stock for product ${item.product_id}`);
        }
        item.subtotal = item.unit_price * item.quantity - (item.discount || 0);
        item.tax_amount = item.subtotal * (item.tax_rate || 0);
        subtotal   += item.subtotal;
        tax_amount += item.tax_amount;
      }

      const total_amount = subtotal + tax_amount - discount_amount;

      // Create order
      const { rows: [order] } = await client.query(
        `INSERT INTO orders (order_number, customer_id, cashier_id, status,
                             subtotal, tax_amount, discount_amount, total_amount, notes)
         VALUES ($1,$2,$3,'completed',$4,$5,$6,$7,$8) RETURNING *`,
        [order_number, customer_id || null, cashier_id,
         subtotal, tax_amount, discount_amount, total_amount, notes || null]
      );

      // Insert order items and deduct inventory
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount, tax_amount, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [order.id, item.product_id, item.quantity, item.unit_price,
           item.discount || 0, item.tax_amount, item.subtotal]
        );
        await inventoryRepository.adjustQuantity(item.product_id, -item.quantity, client);
      }

      // Record payment
      if (payment) {
        await client.query(
          `INSERT INTO payments (order_id, method, amount, reference)
           VALUES ($1,$2,$3,$4)`,
          [order.id, payment.method, payment.amount, payment.reference || null]
        );
      }

      return orderRepository.findWithDetails(order.id);
    });
  },

  async cancel(id, cashierId) {
    const order = await orderRepository.findById(id);
    if (!order) throw ApiError.notFound('Order not found');
    if (order.status === OrderModel.statuses.CANCELLED) {
      throw ApiError.badRequest('Order is already cancelled');
    }
    if (order.status === OrderModel.statuses.REFUNDED) {
      throw ApiError.badRequest('Refunded orders cannot be cancelled');
    }
    return orderRepository.update(id, { status: 'cancelled' });
  },
};
