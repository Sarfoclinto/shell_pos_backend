import { inventoryRepository } from "../repositories/inventory.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";

// ── Serialisers ───────────────────────────────────────────────────────────────

const serializeRow = (row) => ({
  productId: row.product_id,
  productName: row.product_name ?? row.name,
  sku: row.sku,
  barcode: row.barcode ?? null,
  type: row.type,
  isActive: row.is_active,
  categoryName: row.category_name ?? null,
  variation: row.variation ?? null,
  baseName: row.base_name ?? null,
  store: row.store_id
    ? {
        id: row.store_id,
        name: row.store_name,
        code: row.store_code,
      }
    : null,
  quantity: parseInt(row.quantity ?? 0, 10),
  lastUpdated: row.last_updated ?? null,
});

const serializeStoreStock = (row) => ({
  storeId: row.store_id,
  storeName: row.store_name,
  storeCode: row.store_code,
  quantity: parseInt(row.quantity ?? 0, 10),
  lastUpdated: row.last_updated ?? null,
});

const serializeProductStock = (row) => ({
  id: row.id,
  name: row.name,
  sku: row.sku,
  barcode: row.barcode ?? null,
  type: row.type,
  isActive: row.is_active,
  price: parseFloat(row.price),
  costPrice: row.cost_price ? parseFloat(row.cost_price) : null,
  categoryName: row.category_name ?? null,
  variation: row.variation ?? null,
  baseName: row.base_name ?? null,
});

// ── Service ───────────────────────────────────────────────────────────────────

export const inventoryService = {
  async list(queryParams) {
    const { page, limit, offset } = paginate(queryParams);

    const { rows, total } = await inventoryRepository.findAll({
      storeId: queryParams.storeId || undefined,
      categoryId: queryParams.categoryId || undefined,
      search: queryParams.search?.trim() || undefined,
      lowStock: queryParams.lowStock,
      type: queryParams.type || undefined,
      limit,
      offset,
    });

    return {
      inventory: rows.map(serializeRow),
      pagination: { page, limit, total },
    };
  },

  async getByProduct(productId) {
    const result = await inventoryRepository.findByProduct(productId);
    if (!result) throw ApiError.notFound("Product not found");

    return {
      product: serializeProductStock(result.product),
      stockByStore: result.stockByStore.map(serializeStoreStock),
      totalQuantity: result.stockByStore.reduce(
        (sum, s) => sum + parseInt(s.quantity ?? 0, 10),
        0,
      ),
    };
  },

  async getByProductAndStore(productId, storeId) {
    const row = await inventoryRepository.findByProductAndStore(
      productId,
      storeId,
    );
    if (!row) throw ApiError.notFound("Product or store not found");
    return serializeRow(row);
  },

  async adjust(productId, storeId, { quantity, type, note }, userId) {
    // Verify product exists and is inventory-type
    const existing = await inventoryRepository.findByProductAndStore(
      productId,
      storeId,
    );
    if (!existing) throw ApiError.notFound("Product or store not found");

    if (existing.type === "non-inventory") {
      throw ApiError.badRequest(
        "Stock cannot be adjusted for non-inventory products (services or digital items)",
      );
    }

    if (type === "subtract" && quantity > existing.quantity) {
      throw ApiError.badRequest(
        `Cannot subtract ${quantity} — current stock is only ${existing.quantity}`,
      );
    }

    const updated = await inventoryRepository.adjustStock(
      productId,
      storeId,
      quantity,
      type,
      note,
      userId,
    );

    return serializeRow(updated);
  },
};
