import { BaseRepository } from "./base.repository.js";
import { query } from "../config/database.js";

class UserRepository extends BaseRepository {
  constructor() {
    super("users");
  }

  /**
   * Find a user by email OR phone (for login — we accept both).
   * Returns the full row including password_hash.
   */
  async findByEmailOrPhone(identifier) {
    const { rows } = await query(
      `SELECT
      u.*,

      -- Role
      r.id              AS role_id,
      r.name            AS role_name,
      r.dashboard_type,

      -- Store
      s.name            AS store_name,
      s.code            AS store_code,

      -- Permissions (merged role + user)
      COALESCE(
        json_agg(DISTINCT c.code) FILTER (WHERE c.code IS NOT NULL),
        '[]'
      ) AS permissions

    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    LEFT JOIN stores s ON s.id = u.store_id

    -- Role permissions
    LEFT JOIN role_control_mapping rcm ON rcm.role_id = r.id

    -- User overrides
    LEFT JOIN user_control_mapping ucm ON ucm.user_id = u.id

    -- Controls (combine both sources)
    LEFT JOIN controls c ON c.id = rcm.control_id OR c.id = ucm.control_id

    WHERE (u.email = $1 OR u.phone = $1)
      AND u.deleted_at IS NULL

    GROUP BY u.id, r.id, s.id
    LIMIT 1`,
      [identifier],
    );
    return rows[0] || null;
  }

  /**
   * Find a user by id — safe public fields only (no password_hash).
   */
  async findByIdSafe(id) {
    const { rows } = await query(
      `
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      u.phone,
      u.address,
      u.region,
      u.city,
      u.store_id,
      u.is_active,
      u.last_login_at,
      u.created_at,

      -- Role
      r.id              AS role_id,
      r.name            AS role_name,
      r.dashboard_type,

      -- Store
      s.name            AS store_name,
      s.code            AS store_code,

      -- Permissions
      COALESCE(
        json_agg(DISTINCT c.code) FILTER (WHERE c.code IS NOT NULL),
        '[]'
      ) AS permissions

    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    LEFT JOIN stores s ON s.id = u.store_id

    -- Merge role + user permissions
    LEFT JOIN (
      SELECT role_id, control_id FROM role_control_mapping
      UNION
      SELECT u.role_id, ucm.control_id
      FROM users u
      JOIN user_control_mapping ucm ON ucm.user_id = u.id
    ) perms ON perms.role_id = r.id

    LEFT JOIN controls c ON c.id = perms.control_id

    WHERE u.id = $1
      AND u.deleted_at IS NULL

    GROUP BY u.id, r.id, s.id
    LIMIT 1
    `,
      [id],
    );

    return rows[0] || null;
  }

  async updateLastLogin(id) {
    await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [id]);
  }

  async updatePassword(id, passwordHash) {
    await query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, id],
    );
  }

  /**
   * Paginated list with filters.
   */
  async findAll({ search, storeId, roleId, isActive, limit, offset }) {
    const conditions = ["u.deleted_at IS NULL"];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(
        `(u.first_name ILIKE $${i} OR u.last_name ILIKE $${i}
          OR u.email ILIKE $${i} OR u.phone ILIKE $${i})`,
      );
      values.push(`%${search}%`);
      i++;
    }
    if (storeId) {
      conditions.push(`u.store_id = $${i++}`);
      values.push(storeId);
    }
    if (roleId) {
      conditions.push(`u.role_id  = $${i++}`);
      values.push(roleId);
    }
    if (isActive !== undefined) {
      conditions.push(`u.is_active = $${i++}`);
      values.push(isActive);
    }

    const where = conditions.join(" AND ");

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM users u WHERE ${where}`,
      values,
    );
    const total = parseInt(countRows[0].count, 10);

    const { rows } = await query(
      `SELECT
         u.id, u.first_name, u.last_name, u.email, u.phone,
         u.address, u.region, u.city,
         u.store_id, u.is_active, u.last_login_at, u.created_at,
         r.id   AS role_id,
         r.name AS role_name,
         r.dashboard_type,
         s.name AS store_name,
         s.code AS store_code
       FROM users u
       INNER JOIN roles  r ON r.id = u.role_id
       LEFT  JOIN stores s ON s.id = u.store_id
       WHERE ${where}
       ORDER BY u.first_name ASC, u.last_name ASC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset],
    );

    return { rows, total };
  }

  // ── Write queries ───────────────────────────────────────────────────────────

  async checkPhoneExists(phone, excludeId = null) {
    const conditions = [`phone = $1`, `deleted_at IS NULL`];
    const values = [phone];
    if (excludeId) {
      conditions.push(`id != $2`);
      values.push(excludeId);
    }
    const { rows } = await query(
      `SELECT id FROM users WHERE ${conditions.join(" AND ")} LIMIT 1`,
      values,
    );
    return rows[0] || null;
  }

  async checkEmailExists(email, excludeId = null) {
    const conditions = [`email = $1`, `deleted_at IS NULL`];
    const values = [email];
    if (excludeId) {
      conditions.push(`id != $2`);
      values.push(excludeId);
    }
    const { rows } = await query(
      `SELECT id FROM users WHERE ${conditions.join(" AND ")} LIMIT 1`,
      values,
    );
    return rows[0] || null;
  }

  async create(data, createdBy) {
    const { rows } = await query(
      `INSERT INTO users
         (first_name, last_name, phone, email, password_hash,
          role_id, store_id, address, region, city, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11)
       RETURNING id`,
      [
        data.firstName,
        data.lastName,
        data.phone,
        data.email ?? null,
        data.passwordHash,
        data.roleId,
        data.storeId ?? null,
        data.address ?? null,
        data.region ?? null,
        data.city ?? null,
        createdBy,
      ],
    );
    return rows[0].id;
  }

  async update(id, data, updatedBy) {
    const fieldMap = {
      firstName: "first_name",
      lastName: "last_name",
      phone: "phone",
      email: "email",
      roleId: "role_id",
      storeId: "store_id",
      address: "address",
      region: "region",
      city: "city",
      isActive: "is_active",
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

    if (!updates.length) return this.findByIdSafe(id);

    updates.push(`updated_at = NOW()`, `updated_by = $${i++}`);
    values.push(updatedBy, id);

    await query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${i} AND deleted_at IS NULL`,
      values,
    );
    return this.findByIdSafe(id);
  }

  async softDelete(id, deletedBy) {
    const { rows } = await query(
      `UPDATE users
       SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2, is_active = FALSE
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id, deletedBy],
    );
    return rows[0] || null;
  }

  // ── Per-user control overrides ──────────────────────────────────────────────

  async getUserControls(userId) {
    // Role-level controls (inherited from the user's role)
    const { rows: roleControls } = await query(
      `SELECT c.id, c.code, c.name
       FROM controls c
       INNER JOIN role_control_mapping rcm ON rcm.control_id = c.id
       INNER JOIN users u ON u.role_id = rcm.role_id
       WHERE u.id = $1
       ORDER BY c.code`,
      [userId]
    );
 
    // User-level controls (granted directly to this user)
    const { rows: userControls } = await query(
      `SELECT c.id, c.code, c.name
       FROM controls c
       INNER JOIN user_control_mapping ucm ON ucm.control_id = c.id
       WHERE ucm.user_id = $1
       ORDER BY c.code`,
      [userId]
    );
 
    return { roleControls, userControls };
  }

  async replaceUserControls(userId, controlIds, grantedBy) {
    // Delete existing, insert new — in a single round-trip via transaction
    await query(`DELETE FROM user_control_mapping WHERE user_id = $1`, [
      userId,
    ]);

    if (!controlIds.length) return;

    const valuePlaceholders = controlIds
      .map((_, idx) => `($1, $${idx + 2}, $${controlIds.length + 2})`)
      .join(", ");

    await query(
      `INSERT INTO user_control_mapping (user_id, control_id, created_by)
       VALUES ${valuePlaceholders}
       ON CONFLICT (user_id, control_id) DO NOTHING`,
      [userId, ...controlIds, grantedBy],
    );
  }

  async toggleUserStatus(id, updatedBy) {
    const { rows } = await query(
      `UPDATE users
       SET is_active  = NOT is_active,
           updated_at = NOW(),
           updated_by = $2
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, is_active`,
      [id, updatedBy],
    );
    return rows[0] || null;
  }
}

export const userRepository = new UserRepository();
