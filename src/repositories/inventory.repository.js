import { BaseRepository } from './base.repository.js';
import { InventoryModel } from '../models/inventory.model.js';
import { query } from '../config/database.js';

class InventoryRepository extends BaseRepository {
  constructor() { super(InventoryModel.table); }

  async findByProductId(productId) {
    const { rows } = await query(
      `SELECT * FROM ${this.table} WHERE product_id = $1 LIMIT 1`,
      [productId]
    );
    return rows[0] || null;
  }

  async adjustQuantity(productId, delta, client = null) {
    const run = client ? (t, v) => client.query(t, v) : query;
    const { rows } = await run(
      `UPDATE ${this.table}
       SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
       WHERE product_id = $2
       RETURNING *`,
      [delta, productId]
    );
    return rows[0] || null;
  }

  async getLowStockItems() {
    const { rows } = await query(
      `SELECT i.*, p.name AS product_name, p.sku
       FROM ${this.table} i
       JOIN products p ON p.id = i.product_id
       WHERE i.quantity_on_hand <= i.reorder_level
         AND p.deleted_at IS NULL
       ORDER BY i.quantity_on_hand ASC`
    );
    return rows;
  }
}

export const inventoryRepository = new InventoryRepository();
