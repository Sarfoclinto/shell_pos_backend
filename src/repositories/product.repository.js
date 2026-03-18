import { BaseRepository } from './base.repository.js';
import { ProductModel } from '../models/product.model.js';
import { query } from '../config/database.js';

class ProductRepository extends BaseRepository {
  constructor() {
    super(ProductModel.table);
  }

  async findBySku(sku) {
    const { rows } = await query(
      `SELECT * FROM ${this.table} WHERE sku = $1 AND deleted_at IS NULL LIMIT 1`,
      [sku]
    );
    return rows[0] || null;
  }

  async findByBarcode(barcode) {
    const { rows } = await query(
      `SELECT p.*, i.quantity_on_hand
       FROM ${this.table} p
       LEFT JOIN inventory i ON i.product_id = p.id
       WHERE p.barcode = $1 AND p.deleted_at IS NULL LIMIT 1`,
      [barcode]
    );
    return rows[0] || null;
  }

  async searchProducts({ search, categoryId, isActive, limit, offset }) {
    const conditions = ['p.deleted_at IS NULL'];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(`(p.name ILIKE $${i} OR p.sku ILIKE $${i} OR p.barcode ILIKE $${i})`);
      values.push(`%${search}%`);
      i++;
    }
    if (categoryId) { conditions.push(`p.category_id = $${i++}`); values.push(categoryId); }
    if (isActive !== undefined) { conditions.push(`p.is_active = $${i++}`); values.push(isActive); }

    const where = conditions.join(' AND ');

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM products p WHERE ${where}`,
      values
    );
    const total = parseInt(countRows[0].count, 10);

    const { rows } = await query(
      `SELECT p.*, c.name AS category_name, i.quantity_on_hand
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN inventory  i ON i.product_id = p.id
       WHERE ${where}
       ORDER BY p.name ASC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    return { rows, total };
  }
}

export const productRepository = new ProductRepository();
