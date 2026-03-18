import { query, withTransaction } from '../config/database.js';

/**
 * Base repository — provides generic CRUD helpers.
 * All domain repositories extend this class.
 */
export class BaseRepository {
  constructor(tableName) {
    this.table = tableName;
    this.query = query;
    this.withTransaction = withTransaction;
  }

  async findById(id) {
    const { rows } = await this.query(
      `SELECT * FROM ${this.table} WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  }

  async findOne(conditions = {}) {
    const keys = Object.keys(conditions);
    if (!keys.length) return null;

    const whereClause = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
    const values = Object.values(conditions);

    const { rows } = await this.query(
      `SELECT * FROM ${this.table} WHERE ${whereClause} AND deleted_at IS NULL LIMIT 1`,
      values
    );
    return rows[0] || null;
  }

  async findAll({ limit = 20, offset = 0, orderBy = 'created_at', order = 'DESC' } = {}) {
    const { rows } = await this.query(
      `SELECT * FROM ${this.table} WHERE deleted_at IS NULL
       ORDER BY ${orderBy} ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  }

  async count(conditions = {}) {
    const keys = Object.keys(conditions);
    let sql = `SELECT COUNT(*) FROM ${this.table} WHERE deleted_at IS NULL`;
    const values = [];

    if (keys.length) {
      const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
      sql += ` AND ${where}`;
      values.push(...Object.values(conditions));
    }

    const { rows } = await this.query(sql, values);
    return parseInt(rows[0].count, 10);
  }

  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');

    const { rows } = await this.query(
      `INSERT INTO ${this.table} (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return rows[0];
  }

  async update(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');

    const { rows } = await this.query(
      `UPDATE ${this.table} SET ${setClause}, updated_at = NOW()
       WHERE id = $${keys.length + 1} AND deleted_at IS NULL RETURNING *`,
      [...values, id]
    );
    return rows[0] || null;
  }

  async softDelete(id) {
    const { rows } = await this.query(
      `UPDATE ${this.table} SET deleted_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] || null;
  }

  async hardDelete(id) {
    const { rows } = await this.query(
      `DELETE FROM ${this.table} WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] || null;
  }
}
