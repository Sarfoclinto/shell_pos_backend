import { BaseRepository } from "./base.repository.js";
import { query } from "../config/database.js";

class CustomerRepository extends BaseRepository {
  constructor() {
    super("customers");
  }

  async findAll({ search, limit, offset }) {
    const conditions = ["deleted_at IS NULL"];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(
        `(name ILIKE $${i} OR phone ILIKE $${i} OR email ILIKE $${i})`,
      );
      values.push(`%${search}%`);
      i++;
    }

    const where = conditions.join(" AND ");

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM customers WHERE ${where}`,
      values,
    );
    const total = parseInt(countRows[0].count, 10);

    const { rows } = await query(
      `SELECT * FROM customers
       WHERE ${where}
       ORDER BY name ASC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset],
    );

    return { rows, total };
  }

  async findByIdWithHistory(id) {
    // Customer record
    const { rows } = await query(
      `SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!rows[0]) return null;

    // Last 5 sales for quick history preview
    const { rows: salesRows } = await query(
      `SELECT
         s.id, s.receipt_number, s.final_amount,
         s.status, s.created_at,
         st.name AS store_name
       FROM sales s
       JOIN stores st ON st.id = s.store_id
       WHERE s.customer_id = $1
       ORDER BY s.created_at DESC
       LIMIT 5`,
      [id],
    );

    // Lifetime stats
    const { rows: statsRows } = await query(
      `SELECT
         COUNT(*)                                             AS total_transactions,
         COALESCE(SUM(final_amount)
           FILTER (WHERE status = 'completed'), 0)           AS lifetime_spend,
         MAX(created_at)                                      AS last_purchase_at
       FROM sales
       WHERE customer_id = $1 AND status = 'completed'`,
      [id],
    );

    return { ...rows[0], recentSales: salesRows, stats: statsRows[0] };
  }

  async findByPhone(phone, excludeId = null) {
    const conditions = [`phone = $1`, `deleted_at IS NULL`];
    const values = [phone];
    if (excludeId) {
      conditions.push(`id != $2`);
      values.push(excludeId);
    }

    const { rows } = await query(
      `SELECT * FROM customers WHERE ${conditions.join(" AND ")} LIMIT 1`,
      values,
    );
    return rows[0] || null;
  }

  async findByEmail(email, excludeId = null) {
    const conditions = [`email = $1`, `deleted_at IS NULL`];
    const values = [email];
    if (excludeId) {
      conditions.push(`id != $2`);
      values.push(excludeId);
    }

    const { rows } = await query(
      `SELECT id FROM customers WHERE ${conditions.join(" AND ")} LIMIT 1`,
      values,
    );
    return rows[0] || null;
  }

  async create(data, createdBy) {
    const { rows } = await query(
      `INSERT INTO customers
         (name, phone, email, address, region, city, loyalty_points, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,0,$7)
       RETURNING *`,
      [
        data.name,
        data.phone,
        data.email ?? null,
        data.address ?? null,
        data.region ?? null,
        data.city ?? null,
        createdBy,
      ],
    );
    return rows[0];
  }

  async update(id, data, updatedBy) {
    const fieldMap = {
      name: "name",
      phone: "phone",
      email: "email",
      address: "address",
      region: "region",
      city: "city",
    };

    const updates = [];
    const values = [];
    let i = 1;

    for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
      if (data[jsKey] !== undefined) {
        updates.push(`${dbCol} = $${i++}`);
        values.push(data[jsKey]);
      }
    }

    if (!updates.length) return this.findByIdWithHistory(id);

    updates.push(`updated_at = NOW()`, `updated_by = $${i++}`);
    values.push(updatedBy, id);

    await query(
      `UPDATE customers SET ${updates.join(", ")}
       WHERE id = $${i} AND deleted_at IS NULL`,
      values,
    );
    return this.findByIdWithHistory(id);
  }

  async addLoyaltyPoints(id, points, client = null) {
    const run = client ? (t, v) => client.query(t, v) : (t, v) => query(t, v);

    const { rows } = await run(
      `UPDATE customers
       SET loyalty_points = loyalty_points + $1, updated_at = NOW()
       WHERE id = $2
       RETURNING loyalty_points`,
      [points, id],
    );
    return rows[0]?.loyalty_points ?? 0;
  }

  async softDelete(id, deletedBy) {
    const { rows } = await query(
      `UPDATE customers
       SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id, deletedBy],
    );
    return rows[0] || null;
  }
}

export const customerRepository = new CustomerRepository();
