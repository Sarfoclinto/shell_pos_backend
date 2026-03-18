// import { inventoryRepository } from '../repositories/inventory.repository.js';
import { productRepository } from '../repositories/product.repository.js';
import { withTransaction } from '../config/database.js';
import { ApiError } from '../utils/api-error.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';

export const productService = {
  async list(query) {
    const { page, limit, offset } = paginate(query);
    const { rows, total } = await productRepository.searchProducts({
      search:     query.search,
      categoryId: query.category_id,
      isActive:   query.is_active !== undefined ? query.is_active === 'true' : undefined,
      limit,
      offset,
    });
    return paginatedResponse(rows, total, page, limit);
  },

  async getById(id) {
    const product = await productRepository.findById(id);
    if (!product) throw ApiError.notFound('Product not found');
    return product;
  },

  async create(data) {
    if (data.sku) {
      const existing = await productRepository.findBySku(data.sku);
      if (existing) throw ApiError.conflict(`SKU "${data.sku}" already exists`);
    }

    return withTransaction(async (client) => {
      const product = await productRepository.create(data);
      // Auto-create an inventory record for every new product
      await client.query(
        `INSERT INTO inventory (product_id, quantity_on_hand, reorder_level, reorder_quantity)
         VALUES ($1, $2, $3, $4)`,
        [product.id, data.initial_stock || 0, data.reorder_level || 10, data.reorder_quantity || 50]
      );
      return product;
    });
  },

  async update(id, data) {
    const product = await productRepository.findById(id);
    if (!product) throw ApiError.notFound('Product not found');
    return productRepository.update(id, data);
  },

  async remove(id) {
    const product = await productRepository.findById(id);
    if (!product) throw ApiError.notFound('Product not found');
    return productRepository.softDelete(id);
  },
};
