import { BaseRepository } from "./base.repository.js";
import { query } from "../config/database.js";

class CategoryRepository extends BaseRepository {
  constructor() {
    super("categories");
  }

  async findAll({ search, limit, offset }) {
    const conditions = ["c.deleted_at IS NULL"];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(`c.name ILIKE $${i++}`);
      values.push(`%${search}%`);
    }

    const where = conditions.join(" AND ");

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM categories c WHERE ${where}`,
      values,
    );
    const total = parseInt(countRows[0].count, 10);

    const { rows } = await query(
      `SELECT
         c.*,
         COUNT(bp.id) FILTER (WHERE bp.deleted_at IS NULL) AS base_product_count,
         COUNT(p.id)  FILTER (WHERE p.deleted_at IS NULL)  AS product_count
       FROM categories c
       LEFT JOIN base_products bp ON bp.category_id = c.id
       LEFT JOIN products      p  ON p.category_id  = c.id
       WHERE ${where}
       GROUP BY c.id
       ORDER BY c.name ASC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset],
    );

    return { rows, total };
  }

  async findByIdWithCounts(id) {
    const { rows } = await query(
      `SELECT
         c.*,
         COUNT(bp.id) FILTER (WHERE bp.deleted_at IS NULL) AS base_product_count,
         COUNT(p.id)  FILTER (WHERE p.deleted_at IS NULL)  AS product_count
       FROM categories c
       LEFT JOIN base_products bp ON bp.category_id = c.id
       LEFT JOIN products      p  ON p.category_id  = c.id
       WHERE c.id = $1 AND c.deleted_at IS NULL
       GROUP BY c.id`,
      [id],
    );
    return rows[0] || null;
  }

  async findByName(name, excludeId = null) {
    const conditions = [`LOWER(name) = LOWER($1)`, `deleted_at IS NULL`];
    const values = [name];
    if (excludeId) {
      conditions.push(`id != $2`);
      values.push(excludeId);
    }

    const { rows } = await query(
      `SELECT id FROM categories WHERE ${conditions.join(" AND ")} LIMIT 1`,
      values,
    );
    return rows[0] || null;
  }

  async countActiveProducts(categoryId) {
    const { rows } = await query(
      `SELECT COUNT(*) FROM products
       WHERE category_id = $1 AND deleted_at IS NULL`,
      [categoryId],
    );
    return parseInt(rows[0].count, 10);
  }

  async create(name, createdBy) {
    const { rows } = await query(
      `INSERT INTO categories (name, created_by) VALUES ($1, $2) RETURNING *`,
      [name, createdBy],
    );
    return rows[0];
  }

  async update(id, name, updatedBy) {
    const { rows } = await query(
      `UPDATE categories
       SET name = $1, updated_at = NOW(), updated_by = $2
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [name, updatedBy, id],
    );
    return rows[0] || null;
  }

  async softDelete(id, deletedBy) {
    const { rows } = await query(
      `UPDATE categories
       SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id, deletedBy],
    );
    return rows[0] || null;
  }
}

export const categoryRepository = new CategoryRepository();
