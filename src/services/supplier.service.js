import { supplierRepository } from "../repositories/supplier.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";

const serialize = (row) => ({
  id: row.id,
  name: row.name,
  contactPerson: row.contact_person ?? null,
  phone: row.phone,
  email: row.email ?? null,
  address: row.address ?? null,
  region: row.region ?? null,
  city: row.city ?? null,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? null,
});

export const supplierService = {
  async list(queryParams) {
    const { page, limit, offset } = paginate(queryParams);
    const isActive =
      queryParams.isActive === "true"
        ? true
        : queryParams.isActive === "false"
          ? false
          : undefined;
    const { rows, total } = await supplierRepository.findAll({
      search: queryParams.search?.trim() || undefined,
      isActive,
      limit,
      offset,
    });
    return {
      suppliers: rows.map(serialize),
      pagination: { page, limit, total },
    };
  },

  async getById(id) {
    const s = await supplierRepository.findById(id);
    if (!s) throw ApiError.notFound("Supplier not found");
    return serialize(s);
  },

  async create(data, createdBy) {
    const phoneConflict = await supplierRepository.findByPhone(data.phone);
    if (phoneConflict)
      throw ApiError.conflict(
        "A supplier with this phone number already exists",
      );
    if (data.email) {
      const emailConflict = await supplierRepository.findByEmail(data.email);
      if (emailConflict)
        throw ApiError.conflict("A supplier with this email already exists");
    }
    const supplier = await supplierRepository.create(data, createdBy);
    return serialize(supplier);
  },

  async update(id, data, updatedBy) {
    const supplier = await supplierRepository.findById(id);
    if (!supplier) throw ApiError.notFound("Supplier not found");
    if (data.phone && data.phone !== supplier.phone) {
      const c = await supplierRepository.findByPhone(data.phone, id);
      if (c)
        throw ApiError.conflict(
          "A supplier with this phone number already exists",
        );
    }
    if (data.email && data.email !== supplier.email) {
      const c = await supplierRepository.findByEmail(data.email, id);
      if (c)
        throw ApiError.conflict("A supplier with this email already exists");
    }
    const updated = await supplierRepository.update(id, data, updatedBy);
    return serialize(updated);
  },

  async toggleStatus(id, updatedBy) {
    const supplier = await supplierRepository.findById(id);
    if (!supplier) throw ApiError.notFound("Supplier not found");
    const result = await supplierRepository.toggleStatus(id, updatedBy);
    return { id: result.id, isActive: result.is_active };
  },

  async remove(id, deletedBy) {
    const supplier = await supplierRepository.findById(id);
    if (!supplier) throw ApiError.notFound("Supplier not found");
    await supplierRepository.softDelete(id, deletedBy);
  },
};
