import { BaseRepository } from "./base.repository.js";
import { query } from "../config/database.js";

class StoreRepository extends BaseRepository {
  constructor() {
    super("stores");
  }

  /**
   * Paginated list with optional search and status filter.
   * Also returns a count of active users per store.
   */
  async findAll({ search, isActive, limit, offset }) {
    const conditions = ["s.deleted_at IS NULL"];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(
        `(s.name ILIKE $${i} OR s.code ILIKE $${i} OR s.city ILIKE $${i} OR s.region ILIKE $${i})`,
      );
      values.push(`%${search}%`);
      i++;
    }

    if (isActive !== undefined) {
      conditions.push(`s.is_active = $${i++}`);
      values.push(isActive);
    }

    const where = conditions.join(" AND ");

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM stores s WHERE ${where}`,
      values,
    );
    const total = parseInt(countRows[0].count, 10);

    const { rows } = await query(
      `SELECT
         s.*,
         COUNT(u.id) FILTER (WHERE u.deleted_at IS NULL AND u.is_active = TRUE) AS active_user_count
       FROM stores s
       LEFT JOIN users u ON u.store_id = s.id
       WHERE ${where}
       GROUP BY s.id
       ORDER BY s.name ASC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset],
    );

    return { rows, total };
  }

  /**
   * Single store with active user count.
   */
  async findByIdWithStats(id) {
    const { rows } = await query(
      `SELECT
         s.*,
         COUNT(u.id) FILTER (WHERE u.deleted_at IS NULL AND u.is_active = TRUE) AS active_user_count
       FROM stores s
       LEFT JOIN users u ON u.store_id = s.id
       WHERE s.id = $1 AND s.deleted_at IS NULL
       GROUP BY s.id`,
      [id],
    );
    return rows[0] || null;
  }

  /**
   * Find by code — used for uniqueness checks.
   */
  async findByCode(code, excludeId = null) {
    const conditions = ["code = $1", "deleted_at IS NULL"];
    const values = [code];

    if (excludeId) {
      conditions.push(`id != $2`);
      values.push(excludeId);
    }

    const { rows } = await query(
      `SELECT id FROM stores WHERE ${conditions.join(" AND ")} LIMIT 1`,
      values,
    );
    return rows[0] || null;
  }

  /**
   * Toggle is_active status.
   */
  async toggleStatus(id, updatedBy) {
    const { rows } = await query(
      `UPDATE stores
       SET is_active   = NOT is_active,
           updated_at  = NOW(),
           updated_by  = $2
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, updatedBy],
    );
    return rows[0] || null;
  }

  /**
   * Soft delete — also checks if store has active users before allowing.
   */
  async countActiveUsers(storeId) {
    const { rows } = await query(
      `SELECT COUNT(*) FROM users
       WHERE store_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [storeId],
    );
    return parseInt(rows[0].count, 10);
  }

  async softDelete(id, deletedBy) {
    const { rows } = await query(
      `UPDATE stores
       SET deleted_at = NOW(),
           updated_at = NOW(),
           updated_by = $2
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, deletedBy],
    );
    return rows[0] || null;
  }

  async create(data, createdBy) {
    const { rows } = await query(
      `INSERT INTO stores (code, name, address, region, city, contact, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
       RETURNING *`,
      [
        data.code,
        data.name,
        data.address ?? null,
        data.region ?? null,
        data.city ?? null,
        data.contact ?? null,
        createdBy,
      ],
    );
    return rows[0];
  }

  async update(id, data, updatedBy) {
    // Build dynamic SET clause from only the fields provided
    const fields = ["name", "code", "address", "region", "city", "contact"];
    const updates = [];
    const values = [];
    let i = 1;

    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${i++}`);
        values.push(data[field]);
      }
    }

    if (!updates.length) return this.findByIdWithStats(id);

    updates.push(`updated_at = NOW()`, `updated_by = $${i++}`);
    values.push(updatedBy, id);

    const { rows } = await query(
      `UPDATE stores
       SET ${updates.join(", ")}
       WHERE id = $${i} AND deleted_at IS NULL
       RETURNING *`,
      values,
    );
    return rows[0] || null;
  }
}

export const storeRepository = new StoreRepository();
