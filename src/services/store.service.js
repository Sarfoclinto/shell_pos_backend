import { storeRepository } from "../repositories/store.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";

// ── Serialiser ────────────────────────────────────────────────────────────────

const serialize = (row) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  address: row.address ?? null,
  region: row.region ?? null,
  city: row.city ?? null,
  contact: row.contact ?? null,
  isActive: row.is_active,
  activeUserCount: parseInt(row.active_user_count ?? 0, 10),
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? null,
});

// ── Service ───────────────────────────────────────────────────────────────────

export const storeService = {
  async list(queryParams) {
    const { page, limit, offset } = paginate(queryParams);

    const isActive =
      queryParams.isActive === "true"
        ? true
        : queryParams.isActive === "false"
          ? false
          : undefined;

    const { rows, total } = await storeRepository.findAll({
      search: queryParams.search?.trim() || undefined,
      isActive,
      limit,
      offset,
    });

    return {
      stores: rows.map(serialize),
      pagination: { page, limit, total },
    };
  },

  async getById(id) {
    const store = await storeRepository.findByIdWithStats(id);
    if (!store) throw ApiError.notFound("Store not found");
    return serialize(store);
  },

  async create(data, createdBy) {
    // Code uniqueness check
    const existing = await storeRepository.findByCode(data.code);
    if (existing) {
      throw ApiError.conflict(
        `A store with code "${data.code}" already exists`,
      );
    }

    const store = await storeRepository.create(data, createdBy);
    return serialize({ ...store, active_user_count: 0 });
  },

  async update(id, data, updatedBy) {
    const store = await storeRepository.findByIdWithStats(id);
    if (!store) throw ApiError.notFound("Store not found");

    // If code is changing, check it's not taken by another store
    if (data.code && data.code !== store.code) {
      const conflict = await storeRepository.findByCode(data.code, id);
      if (conflict) {
        throw ApiError.conflict(
          `A store with code "${data.code}" already exists`,
        );
      }
    }

    const updated = await storeRepository.update(id, data, updatedBy);
    return serialize({
      ...updated,
      active_user_count: store.active_user_count,
    });
  },

  async toggleStatus(id, updatedBy) {
    const store = await storeRepository.findByIdWithStats(id);
    if (!store) throw ApiError.notFound("Store not found");

    // Prevent deactivating a store that still has active users
    if (store.is_active) {
      const activeUsers = await storeRepository.countActiveUsers(id);
      if (activeUsers > 0) {
        throw ApiError.badRequest(
          `Cannot deactivate store: ${activeUsers} active user(s) are still assigned to it. ` +
            `Reassign or deactivate them first.`,
        );
      }
    }

    const updated = await storeRepository.toggleStatus(id, updatedBy);
    return serialize({
      ...updated,
      active_user_count: store.active_user_count,
    });
  },

  async remove(id, deletedBy) {
    const store = await storeRepository.findByIdWithStats(id);
    if (!store) throw ApiError.notFound("Store not found");

    // Block deletion if users are still assigned
    const activeUsers = await storeRepository.countActiveUsers(id);
    if (activeUsers > 0) {
      throw ApiError.badRequest(
        `Cannot delete store: ${activeUsers} active user(s) are still assigned to it. ` +
          `Reassign or deactivate them first.`,
      );
    }

    await storeRepository.softDelete(id, deletedBy);
  },
};
