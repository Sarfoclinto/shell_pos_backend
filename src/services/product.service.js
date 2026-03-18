import { productRepository } from "../repositories/product.repository.js";
import { categoryRepository } from "../repositories/category.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate } from "../utils/pagination.js";
import { query, withTransaction } from "../config/database.js";

// ── Serialisers ───────────────────────────────────────────────────────────────

const serializeList = (row) => ({
  id: row.id,
  name: row.name,
  sku: row.sku,
  barcode: row.barcode ?? null,
  price: parseFloat(row.price),
  costPrice: row.cost_price ? parseFloat(row.cost_price) : null,
  type: row.type,
  isActive: row.is_active,
  imageUrl: row.image_url ?? null,
  variation: row.variation ?? null,
  categoryName: row.category_name ?? null,
  categoryId: row.category_id ?? null,
  baseProductId: row.base_product_id,
  baseName: row.base_name,
  variantId: row.variant_id ?? null,
  createdAt: row.created_at,
  // Only present when storeId filter is applied
  ...(row.stock_quantity !== undefined
    ? { stockQuantity: parseInt(row.stock_quantity, 10) }
    : {}),
});

const serializeDetail = (row) => ({
  ...serializeList(row),
  description: row.base_description ?? null,
  stock: Array.isArray(row.stock)
    ? row.stock
    : typeof row.stock === "string"
      ? JSON.parse(row.stock)
      : [],
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const validateCategoryExists = async (categoryId) => {
  const cat = await categoryRepository.findByIdWithCounts(categoryId);
  if (!cat) throw ApiError.badRequest("Category not found");
  return cat;
};

const validateBaseProductExists = async (baseProductId) => {
  const bp = await productRepository.findBaseProductById(baseProductId);
  if (!bp) throw ApiError.badRequest("Base product not found");
  return bp;
};

/**
 * Generate a unique SKU — retry up to 5 times on collision.
 */
const generateUniqueSku = async (productName, categoryName, variantLabel) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const sku = productRepository.generateSku(
      productName,
      categoryName,
      variantLabel,
    );
    const taken = await productRepository.isSkuTaken(sku);
    if (!taken) return sku;
  }
  throw ApiError.internal(
    "Could not generate a unique SKU after 5 attempts. Please try again.",
  );
};

// ── Service ───────────────────────────────────────────────────────────────────

export const productService = {
  // ── Variants ────────────────────────────────────────────────────────────────

  async listVariants() {
    const rows = await productRepository.findAllVariants();
    return rows.map((r) => ({
      id: r.id,
      variation: r.variation,
      createdAt: r.created_at,
    }));
  },

  async createVariant(variation, createdBy) {
    const existing = await productRepository.findVariantByName(variation);
    if (existing)
      throw ApiError.conflict(`A variant "${variation}" already exists`);

    const variant = await productRepository.createVariant(variation, createdBy);
    return {
      id: variant.id,
      variation: variant.variation,
      createdAt: variant.created_at,
    };
  },

  // ── Categories ───────────────────────────────────────────────────────────────
  // (thin pass-through — category service handles the logic)

  // ── Products ─────────────────────────────────────────────────────────────────

  async list(queryParams) {
    const { page, limit, offset } = paginate(queryParams);

    const isActive =
      queryParams.isActive === "true"
        ? true
        : queryParams.isActive === "false"
          ? false
          : undefined;

    const { rows, total } = await productRepository.findAll({
      search: queryParams.search?.trim() || undefined,
      categoryId: queryParams.categoryId || undefined,
      type: queryParams.type || undefined,
      isActive,
      baseProductId: queryParams.baseProductId || undefined,
      storeId: queryParams.storeId || undefined,
      limit,
      offset,
    });

    return {
      products: rows.map(serializeList),
      pagination: { page, limit, total },
    };
  },

  async getById(id) {
    const product = await productRepository.findByIdWithStock(id);
    if (!product) throw ApiError.notFound("Product not found");
    return serializeDetail(product);
  },

  async getByBarcode(barcode) {
    const product = await productRepository.findByBarcode(barcode);
    if (!product)
      throw ApiError.notFound(`No product found with barcode "${barcode}"`);
    return serializeDetail(
      await productRepository.findByIdWithStock(product.id),
    );
  },

  /**
   * Create a product (SKU variant).
   *
   * Flow:
   * 1. Validate baseProduct and category exist
   * 2. Resolve variant label for SKU generation
   * 3. Auto-generate unique SKU
   * 4. Check barcode uniqueness
   * 5. Insert product row
   * 6. Insert stock row(s) for each store provided in initialStock[]
   * All steps 5-6 run inside a transaction.
   */
  async create(data, createdBy) {
    const baseProduct = await validateBaseProductExists(data.baseProductId);

    let categoryName = "";
    if (data.categoryId) {
      const cat = await validateCategoryExists(data.categoryId);
      categoryName = cat.name;
    }

    let variantLabel = "";
    if (data.variantId) {
      const { rows } = await query(
        `SELECT variation FROM product_variants WHERE id = $1`,
        [data.variantId],
      );
      if (!rows[0]) throw ApiError.badRequest("Variant not found");
      variantLabel = rows[0].variation;
    }

    if (data.barcode) {
      const barcodeTaken = await productRepository.isBarcodeAndTaken(
        data.barcode,
      );
      if (barcodeTaken) {
        throw ApiError.conflict(
          `Barcode "${data.barcode}" is already assigned to another product`,
        );
      }
    }

    const sku = await generateUniqueSku(
      baseProduct.name,
      categoryName,
      variantLabel,
    );

    const productId = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO products
           (base_product_id, variant_id, category_id, name, sku, barcode,
            price, cost_price, type, is_active, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10)
         RETURNING id`,
        [
          data.baseProductId,
          data.variantId ?? null,
          data.categoryId ?? null,
          data.name,
          sku,
          data.barcode ?? null,
          data.price,
          data.costPrice ?? null,
          data.type ?? "inventory",
          createdBy,
        ],
      );
      const productId = rows[0].id;

      // Insert stock rows for provided stores
      if (data.initialStock?.length) {
        for (const { storeId, quantity } of data.initialStock) {
          await client.query(
            `INSERT INTO stock (product_id, store_id, quantity, created_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (product_id, store_id)
             DO UPDATE SET quantity = EXCLUDED.quantity`,
            [productId, storeId, quantity ?? 0, createdBy],
          );

          // Record stock movement for initial stock if quantity > 0
          if ((quantity ?? 0) > 0) {
            await client.query(
              `INSERT INTO stock_movements
                 (product_id, store_id, movement_type, quantity_change,
                  reference_type, reference_id, note, created_by)
               VALUES ($1, $2, 'purchase', $3, 'purchase_order', $4, $5, $6)`,
              [
                productId,
                storeId,
                quantity,
                productId, // use product id as a self-reference for initial stock
                "Initial stock on product creation",
                createdBy,
              ],
            );
          }
        }
      }

      return productId;
    });

    return this.getById(productId);
  },

  async update(id, data, updatedBy) {
    const product = await productRepository.findByIdWithStock(id);
    if (!product) throw ApiError.notFound("Product not found");

    if (data.categoryId && data.categoryId !== product.category_id) {
      await validateCategoryExists(data.categoryId);
    }

    if (data.barcode && data.barcode !== product.barcode) {
      const taken = await productRepository.isBarcodeAndTaken(data.barcode, id);
      if (taken) {
        throw ApiError.conflict(
          `Barcode "${data.barcode}" is already assigned to another product`,
        );
      }
    }

    const updated = await productRepository.update(id, data, updatedBy);
    return serializeDetail(updated);
  },

  async toggleStatus(id, updatedBy) {
    const product = await productRepository.findByIdWithStock(id);
    if (!product) throw ApiError.notFound("Product not found");

    const result = await productRepository.toggleStatus(id, updatedBy);
    return {
      id: result.id,
      isActive: result.is_active,
      message: `Product ${result.is_active ? "activated" : "deactivated"}`,
    };
  },

  async remove(id, deletedBy) {
    const product = await productRepository.findByIdWithStock(id);
    if (!product) throw ApiError.notFound("Product not found");

    await productRepository.softDelete(id, deletedBy);
  },
};
