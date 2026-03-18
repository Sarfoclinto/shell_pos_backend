import { categoryRepository } from "../repositories/category.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";

// ── Serialiser ────────────────────────────────────────────────────────────────

const serialize = (row) => ({
  id: row.id,
  name: row.name,
  baseProductCount: parseInt(row.base_product_count ?? 0, 10),
  productCount: parseInt(row.product_count ?? 0, 10),
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? null,
});

// ── Service ───────────────────────────────────────────────────────────────────

export const categoryService = {
  async list(queryParams) {
    const { page, limit, offset } = paginate(queryParams);

    const { rows, total } = await categoryRepository.findAll({
      search: queryParams.search?.trim() || undefined,
      limit,
      offset,
    });

    return {
      categories: rows.map(serialize),
      pagination: { page, limit, total },
    };
  },

  async getById(id) {
    const category = await categoryRepository.findByIdWithCounts(id);
    if (!category) throw ApiError.notFound("Category not found");
    return serialize(category);
  },

  async create(name, createdBy) {
    const existing = await categoryRepository.findByName(name);
    if (existing)
      throw ApiError.conflict(`A category named "${name}" already exists`);

    const category = await categoryRepository.create(name, createdBy);
    return serialize({ ...category, base_product_count: 0, product_count: 0 });
  },

  async update(id, name, updatedBy) {
    const category = await categoryRepository.findByIdWithCounts(id);
    if (!category) throw ApiError.notFound("Category not found");

    if (name.toLowerCase() !== category.name.toLowerCase()) {
      const conflict = await categoryRepository.findByName(name, id);
      if (conflict)
        throw ApiError.conflict(`A category named "${name}" already exists`);
    }

    const updated = await categoryRepository.update(id, name, updatedBy);
    return serialize({
      ...updated,
      base_product_count: category.base_product_count,
      product_count: category.product_count,
    });
  },

  async remove(id, deletedBy) {
    const category = await categoryRepository.findByIdWithCounts(id);
    if (!category) throw ApiError.notFound("Category not found");

    const activeProducts = await categoryRepository.countActiveProducts(id);
    if (activeProducts > 0) {
      throw ApiError.badRequest(
        `Cannot delete category: ${activeProducts} product(s) are still assigned to it. ` +
          `Reassign or delete them first.`,
      );
    }

    await categoryRepository.softDelete(id, deletedBy);
  },
};
