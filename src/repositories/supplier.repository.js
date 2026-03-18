import { BaseRepository } from "./base.repository.js";
import { query } from "../config/database.js";

class SupplierRepository extends BaseRepository {
  constructor() {
    super("suppliers");
  }

  async findAll({ search, isActive, limit, offset }) {
    const conditions = ["deleted_at IS NULL"];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(
        `(name ILIKE $${i} OR phone ILIKE $${i} OR email ILIKE $${i} OR contact_person ILIKE $${i})`,
      );
      values.push(`%${search}%`);
      i++;
    }
    if (isActive !== undefined) {
      conditions.push(`is_active = $${i++}`);
      values.push(isActive);
    }

    const where = conditions.join(" AND ");
    const { rows: cr } = await query(
      `SELECT COUNT(*) FROM suppliers WHERE ${where}`,
      values,
    );
    const total = parseInt(cr[0].count, 10);

    const { rows } = await query(
      `SELECT * FROM suppliers WHERE ${where} ORDER BY name ASC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset],
    );
    return { rows, total };
  }

  async findByPhone(phone, excludeId = null) {
    const conds = [`phone = $1`, `deleted_at IS NULL`];
    const vals = [phone];
    if (excludeId) {
      conds.push(`id != $2`);
      vals.push(excludeId);
    }
    const { rows } = await query(
      `SELECT id FROM suppliers WHERE ${conds.join(" AND ")} LIMIT 1`,
      vals,
    );
    return rows[0] || null;
  }

  async findByEmail(email, excludeId = null) {
    const conds = [`email = $1`, `deleted_at IS NULL`];
    const vals = [email];
    if (excludeId) {
      conds.push(`id != $2`);
      vals.push(excludeId);
    }
    const { rows } = await query(
      `SELECT id FROM suppliers WHERE ${conds.join(" AND ")} LIMIT 1`,
      vals,
    );
    return rows[0] || null;
  }

  async create(data, createdBy) {
    const { rows } = await query(
      `INSERT INTO suppliers (name, contact_person, phone, email, address, region, city, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8) RETURNING *`,
      [
        data.name,
        data.contactPerson ?? null,
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
      contactPerson: "contact_person",
      phone: "phone",
      email: "email",
      address: "address",
      region: "region",
      city: "city",
      isActive: "is_active",
    };
    const updates = [];
    const values = [];
    let i = 1;
    for (const [k, col] of Object.entries(fieldMap)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${i++}`);
        values.push(data[k]);
      }
    }
    if (!updates.length) return this.findById(id);
    updates.push(`updated_at = NOW()`, `updated_by = $${i++}`);
    values.push(updatedBy, id);
    const { rows } = await query(
      `UPDATE suppliers SET ${updates.join(", ")} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values,
    );
    return rows[0] || null;
  }

  async toggleStatus(id, updatedBy) {
    const { rows } = await query(
      `UPDATE suppliers SET is_active = NOT is_active, updated_at = NOW(), updated_by = $2
       WHERE id = $1 AND deleted_at IS NULL RETURNING id, is_active`,
      [id, updatedBy],
    );
    return rows[0] || null;
  }

  async softDelete(id, deletedBy) {
    const { rows } = await query(
      `UPDATE suppliers SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id, deletedBy],
    );
    return rows[0] || null;
  }
}

export const supplierRepository = new SupplierRepository();
