import { baseProductRepository } from "../repositories/base-product.repository.js";
import { categoryRepository } from "../repositories/category.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";

// ── Serialisers ───────────────────────────────────────────────────────────────

const serializeList = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description ?? null,
  imageUrl: row.image_url ?? null,
  categoryId: row.category_id ?? null,
  categoryName: row.category_name ?? null,
  variantCount: parseInt(row.variant_count ?? 0, 10),
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? null,
});

const serializeDetail = (row) => ({
  ...serializeList(row),
  // Override variantCount with accurate count from variants array
  variantCount: row.variants?.length ?? 0,
  variants: (row.variants ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    sku: v.sku,
    barcode: v.barcode ?? null,
    price: parseFloat(v.price),
    costPrice: v.cost_price ? parseFloat(v.cost_price) : null,
    type: v.type,
    isActive: v.is_active,
    variation: v.variation ?? null,
  })),
});

// ── Service ───────────────────────────────────────────────────────────────────

export const baseProductService = {
  async list(queryParams) {
    const { page, limit, offset } = paginate(queryParams);

    const { rows, total } = await baseProductRepository.findAll({
      search: queryParams.search?.trim() || undefined,
      categoryId: queryParams.categoryId || undefined,
      limit,
      offset,
    });

    return {
      baseProducts: rows.map(serializeList),
      pagination: { page, limit, total },
    };
  },

  async getById(id) {
    const bp = await baseProductRepository.findByIdWithVariants(id);
    if (!bp) throw ApiError.notFound("Base product not found");
    return serializeDetail(bp);
  },

  async create(data, createdBy) {
    // Name uniqueness check
    const existing = await baseProductRepository.findByName(data.name);
    if (existing) {
      throw ApiError.conflict(
        `A base product named "${data.name}" already exists`,
      );
    }

    // Validate category if provided
    if (data.categoryId) {
      const cat = await categoryRepository.findByIdWithCounts(data.categoryId);
      if (!cat) throw ApiError.badRequest("Category not found");
    }

    const bp = await baseProductRepository.create(data, createdBy);
    return serializeDetail({ ...bp, variants: [] });
  },

  async update(id, data, updatedBy) {
    const bp = await baseProductRepository.findByIdWithVariants(id);
    if (!bp) throw ApiError.notFound("Base product not found");

    // Check name uniqueness if name is changing
    if (data.name && data.name.toLowerCase() !== bp.name.toLowerCase()) {
      const conflict = await baseProductRepository.findByName(data.name, id);
      if (conflict) {
        throw ApiError.conflict(
          `A base product named "${data.name}" already exists`,
        );
      }
    }

    // Validate new category if provided
    if (data.categoryId && data.categoryId !== bp.category_id) {
      const cat = await categoryRepository.findByIdWithCounts(data.categoryId);
      if (!cat) throw ApiError.badRequest("Category not found");
    }

    const updated = await baseProductRepository.update(id, data, updatedBy);
    return serializeDetail(updated);
  },

  async remove(id, deletedBy) {
    const bp = await baseProductRepository.findByIdWithVariants(id);
    if (!bp) throw ApiError.notFound("Base product not found");

    // Block deletion if active variants exist
    const activeVariants = await baseProductRepository.countActiveVariants(id);
    if (activeVariants > 0) {
      throw ApiError.badRequest(
        `Cannot delete base product: ${activeVariants} variant(s) are still linked to it. ` +
          `Delete or reassign them first.`,
      );
    }

    await baseProductRepository.softDelete(id, deletedBy);
  },
};
