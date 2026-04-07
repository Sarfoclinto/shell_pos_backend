import bcrypt from "bcryptjs";
import { userRepository } from "../repositories/user.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";
import { query } from "../config/database.js";
// import { storeRepository } from "../repositories/store.repository.js";

// ── Serialiser ────────────────────────────────────────────────────────────────

const serialize = (row) => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  fullName: `${row.first_name} ${row.last_name}`,
  email: row.email ?? null,
  phone: row.phone,
  address: row.address ?? null,
  region: row.region ?? null,
  city: row.city ?? null,
  img: row.img ?? null,
  isActive: row.is_active,
  lastLoginAt: row.last_login_at ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? null,
  role: {
    id: row.role_id,
    name: row.role_name,
    dashboardType: row.dashboard_type,
  },
  store: row.store_id
    ? {
        id: row.store_id,
        name: row.store_name,
        code: row.store_code,
      }
    : null,
  // user_controls only present on single-user fetches (findByIdSafe)
  ...(row.user_controls !== undefined
    ? {
        controls: Array.isArray(row.user_controls)
          ? row.user_controls
          : JSON.parse(row.user_controls),
      }
    : {}),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const validateRoleExists = async (roleId) => {
  const { rows } = await query(`SELECT id FROM roles WHERE id = $1`, [roleId]);
  if (!rows.length) throw ApiError.badRequest("Role not found");
};

const validateStoreExists = async (storeId) => {
  const { rows } = await query(
    `SELECT id FROM stores WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE`,
    [storeId],
  );
  if (!rows.length) throw ApiError.badRequest("Store not found or is inactive");
};

// ── Service ───────────────────────────────────────────────────────────────────

export const userService = {
  async list(queryParams) {
    const { page, limit, offset } = paginate(queryParams);

    const isActive =
      queryParams.isActive === "true"
        ? true
        : queryParams.isActive === "false"
          ? false
          : undefined;

    const { rows, total } = await userRepository.findAll({
      search: queryParams.search?.trim() || undefined,
      storeId: queryParams.storeId || undefined,
      roleId: queryParams.roleId || undefined,
      isActive,
      limit,
      offset,
    });

    return {
      users: rows.map(serialize),
      pagination: { page, limit, total },
    };
  },

  async getById(id) {
    const user = await userRepository.findByIdSafe(id);
    if (!user) throw ApiError.notFound("User not found");
    return serialize(user);
  },

  async create(data, createdBy) {
    // Validate role and store exist
    await validateRoleExists(data.roleId);
    if (data.storeId) await validateStoreExists(data.storeId);

    // Uniqueness checks
    const phoneConflict = await userRepository.checkPhoneExists(data.phone);
    if (phoneConflict)
      throw ApiError.conflict("A user with this phone number already exists");

    if (data.email) {
      const emailConflict = await userRepository.checkEmailExists(data.email);
      if (emailConflict)
        throw ApiError.conflict("A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const userId = await userRepository.create(
      { ...data, passwordHash },
      createdBy,
    );

    return this.getById(userId);
  },

  async update(id, data, updatedBy) {
    const user = await userRepository.findByIdSafe(id);
    if (!user) throw ApiError.notFound("User not found");

    // Prevent a user from changing their own role or store assignment
    if (id === updatedBy && (data.roleId || data.storeId !== undefined)) {
      throw ApiError.forbidden(
        "You cannot change your own role or store assignment",
      );
    }

    if (data.roleId && data.roleId !== user.role_id)
      await validateRoleExists(data.roleId);
    if (data.storeId && data.storeId !== user.store_id)
      await validateStoreExists(data.storeId);

    if (data.phone && data.phone !== user.phone) {
      const conflict = await userRepository.checkPhoneExists(data.phone, id);
      if (conflict)
        throw ApiError.conflict("A user with this phone number already exists");
    }

    if (data.email && data.email !== user.email) {
      const conflict = await userRepository.checkEmailExists(data.email, id);
      if (conflict)
        throw ApiError.conflict("A user with this email already exists");
    }

    const updated = await userRepository.update(id, data, updatedBy);
    return serialize(updated);
  },

  async toggleStatus(id, updatedBy) {
    // Prevent self-deactivation
    if (id === updatedBy) {
      throw ApiError.forbidden("You cannot change your own account status");
    }

    const user = await userRepository.findByIdSafe(id);
    if (!user) throw ApiError.notFound("User not found");

    const result = await userRepository.toggleUserStatus(id, updatedBy);
    const action = result.is_active ? "activated" : "deactivated";

    return {
      id: result.id,
      isActive: result.is_active,
      message: `User ${action}`,
    };
  },

  async resetPassword(id, newPassword, currentPassword, updatedBy) {
    const user = await userRepository.findByIdSafe(id);
    if (!user) throw ApiError.notFound("User not found");

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) throw ApiError.unauthorized("Invalid current password");

    // Prevent admins from resetting their own password through this route
    // (use change-password on /auth instead)
    if (id === updatedBy) {
      throw ApiError.forbidden(
        "Use the /auth/change-password endpoint to change your own password",
      );
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await userRepository.updatePassword(id, hash);
  },

  async remove(id, deletedBy) {
    if (id === deletedBy) {
      throw ApiError.forbidden("You cannot delete your own account");
    }

    const user = await userRepository.findByIdSafe(id);
    if (!user) throw ApiError.notFound("User not found");

    await userRepository.softDelete(id, deletedBy);
  },

  // ── Per-user control overrides ──────────────────────────────────────────────

  /**
   * Returns { roleControls, userControls } for a user.
   * roleControls — inherited from the user's role
   * userControls — granted directly to this user (overrides / extras)
   */
  async getControls(userId) {
    const user = await userRepository.findByIdSafe(userId);
    if (!user) throw ApiError.notFound("User not found");
    return userRepository.getUserControls(userId);
  },

  async replaceControls(userId, controlIds, grantedBy) {
    const user = await userRepository.findByIdSafe(userId);
    if (!user) throw ApiError.notFound("User not found");

    // Validate that all provided control IDs actually exist
    if (controlIds.length) {
      const { rows } = await query(
        `SELECT COUNT(*) FROM controls WHERE id = ANY($1::uuid[])`,
        [controlIds],
      );
      if (parseInt(rows[0].count, 10) !== controlIds.length) {
        throw ApiError.badRequest("One or more control IDs are invalid");
      }
    }

    await userRepository.replaceUserControls(userId, controlIds, grantedBy);
    return userRepository.getUserControls(userId);
  },
};
