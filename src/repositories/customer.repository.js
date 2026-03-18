import { BaseRepository } from './base.repository.js';
import { CustomerModel } from '../models/customer.model.js';
import { query } from '../config/database.js';

class CustomerRepository extends BaseRepository {
  constructor() { super(CustomerModel.table); }

  async findByEmail(email) {
    const { rows } = await query(
      `SELECT * FROM ${this.table} WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  }

  async findByPhone(phone) {
    const { rows } = await query(
      `SELECT * FROM ${this.table} WHERE phone = $1 AND deleted_at IS NULL LIMIT 1`,
      [phone]
    );
    return rows[0] || null;
  }

  async search({ search, limit, offset }) {
    const values = [`%${search || ''}%`];
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM ${this.table}
       WHERE deleted_at IS NULL AND (name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)`,
      values
    );
    const { rows } = await query(
      `SELECT * FROM ${this.table}
       WHERE deleted_at IS NULL AND (name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
       ORDER BY name ASC LIMIT $2 OFFSET $3`,
      [...values, limit, offset]
    );
    return { rows, total: parseInt(countRows[0].count, 10) };
  }
}

export const customerRepository = new CustomerRepository();
