import { BaseRepository } from "./base.repository.js";
import { query } from "../config/database.js";

class ProductRepository extends BaseRepository {
  constructor() {
    super("products");
  }

  // ── Variants ────────────────────────────────────────────────────────────────

  async findAllVariants() {
    const { rows } = await query(
      `SELECT id, variation, created_at FROM product_variants ORDER BY variation ASC`,
    );
    return rows;
  }

  async findVariantByName(variation) {
    const { rows } = await query(
      `SELECT id FROM product_variants WHERE LOWER(variation) = LOWER($1) LIMIT 1`,
      [variation],
    );
    return rows[0] || null;
  }

  async createVariant(variation, createdBy) {
    const { rows } = await query(
      `INSERT INTO product_variants (variation, created_by)
       VALUES ($1, $2) RETURNING *`,
      [variation, createdBy],
    );
    return rows[0];
  }

  // ── Base products ───────────────────────────────────────────────────────────

  async findBaseProductById(id) {
    const { rows } = await query(
      `SELECT bp.*, c.name AS category_name
       FROM base_products bp
       LEFT JOIN categories c ON c.id = bp.category_id
       WHERE bp.id = $1 AND bp.deleted_at IS NULL`,
      [id],
    );
    return rows[0] || null;
  }

  async createBaseProduct(data, createdBy) {
    const { rows } = await query(
      `INSERT INTO base_products (name, description, category_id, image_url, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        data.name,
        data.description ?? null,
        data.categoryId ?? null,
        data.imageUrl ?? null,
        createdBy,
      ],
    );
    return rows[0];
  }

  // ── SKU generation ──────────────────────────────────────────────────────────

  /**
   * Generates a SKU from the product name, category name, and variant label.
   * Format: {PROD_INITIALS}-{CAT_INITIALS}-{VARIANT_INITIALS}-{4-digit-random}
   * Example: "Coca-Cola 500ml" / "Beverages" / "500ml" → CC-BV-5M-4821
   */
  generateSku(productName, categoryName, variantLabel) {
    const initials = (str) =>
      (str || "")
        .split(/[\s\-\/]+/)
        .filter(Boolean)
        .map((w) => w[0].toUpperCase())
        .join("");

    const prodPart = initials(productName).slice(0, 4) || "XX";
    const catPart = initials(categoryName).slice(0, 3) || "XX";
    const variantPart = initials(variantLabel).slice(0, 3) || "XX";
    const rand = String(Math.floor(1000 + Math.random() * 9000));

    return `${prodPart}-${catPart}-${variantPart}-${rand}`;
  }

  async isSkuTaken(sku, excludeId = null) {
    const conditions = [`sku = $1`, `deleted_at IS NULL`];
    const values = [sku];
    if (excludeId) {
      conditions.push(`id != $2`);
      values.push(excludeId);
    }

    const { rows } = await query(
      `SELECT id FROM products WHERE ${conditions.join(" AND ")} LIMIT 1`,
      values,
    );
    return !!rows[0];
  }

  async isBarcodeAndTaken(barcode, excludeId = null) {
    if (!barcode) return false;
    const conditions = [`barcode = $1`, `deleted_at IS NULL`];
    const values = [barcode];
    if (excludeId) {
      conditions.push(`id != $2`);
      values.push(excludeId);
    }

    const { rows } = await query(
      `SELECT id FROM products WHERE ${conditions.join(" AND ")} LIMIT 1`,
      values,
    );
    return !!rows[0];
  }

  // ── Product reads ───────────────────────────────────────────────────────────

  /**
   * Full product detail with base product info, variant, category,
   * and stock per store.
   */
  async findByIdWithStock(id) {
    const { rows } = await query(
      `SELECT
         p.*,
         bp.name        AS base_name,
         bp.description AS base_description,
         bp.image_url,
         pv.variation,
         c.name         AS category_name,
         COALESCE(
           json_agg(
             json_build_object(
               'storeId',  s.id,
               'storeName',s.name,
               'storeCode',s.code,
               'quantity', COALESCE(st.quantity, 0)
             )
           ) FILTER (WHERE s.id IS NOT NULL),
           '[]'
         ) AS stock
       FROM products p
       INNER JOIN base_products   bp ON bp.id = p.base_product_id
       LEFT  JOIN product_variants pv ON pv.id = p.variant_id
       LEFT  JOIN categories       c  ON c.id  = p.category_id
       LEFT  JOIN stores           s  ON s.deleted_at IS NULL AND s.is_active = TRUE
       LEFT  JOIN stock            st ON st.product_id = p.id AND st.store_id = s.id
       WHERE p.id = $1 AND p.deleted_at IS NULL
       GROUP BY p.id, bp.name, bp.description, bp.image_url, pv.variation, c.name`,
      [id],
    );
    return rows[0] || null;
  }

  async findByBarcode(barcode) {
    const { rows } = await query(
      `SELECT
         p.*,
         bp.name        AS base_name,
         bp.image_url,
         pv.variation,
         c.name         AS category_name
       FROM products p
       INNER JOIN base_products   bp ON bp.id = p.base_product_id
       LEFT  JOIN product_variants pv ON pv.id = p.variant_id
       LEFT  JOIN categories       c  ON c.id  = p.category_id
       WHERE p.barcode = $1 AND p.deleted_at IS NULL
       LIMIT 1`,
      [barcode],
    );
    return rows[0] || null;
  }

  /**
   * Paginated product list with stock for a specific store (optional).
   */
  async findAll({
    search,
    categoryId,
    type,
    isActive,
    baseProductId,
    storeId,
    limit,
    offset,
  }) {
    const conditions = ["p.deleted_at IS NULL"];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(
        `(p.name ILIKE $${i} OR p.sku ILIKE $${i} OR p.barcode ILIKE $${i})`,
      );
      values.push(`%${search}%`);
      i++;
    }
    if (categoryId) {
      conditions.push(`p.category_id    = $${i++}`);
      values.push(categoryId);
    }
    if (type) {
      conditions.push(`p.type           = $${i++}`);
      values.push(type);
    }
    if (baseProductId) {
      conditions.push(`p.base_product_id= $${i++}`);
      values.push(baseProductId);
    }
    if (isActive !== undefined) {
      conditions.push(`p.is_active = $${i++}`);
      values.push(isActive);
    }

    const where = conditions.join(" AND ");

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM products p WHERE ${where}`,
      values,
    );
    const total = parseInt(countRows[0].count, 10);

    // If storeId is given, include that store's stock quantity
    const stockJoin = storeId
      ? `LEFT JOIN stock st ON st.product_id = p.id AND st.store_id = $${i++}`
      : "";
    const stockSelect = storeId
      ? `, COALESCE(st.quantity, 0) AS stock_quantity`
      : ``;
    if (storeId) values.push(storeId);

    const { rows } = await query(
      `SELECT
         p.id, p.name, p.sku, p.barcode, p.price, p.cost_price,
         p.type, p.is_active, p.created_at,
         p.base_product_id, p.variant_id, p.category_id,
         bp.name        AS base_name,
         bp.image_url,
         pv.variation,
         c.name         AS category_name
         ${stockSelect}
       FROM products p
       INNER JOIN base_products    bp ON bp.id = p.base_product_id
       LEFT  JOIN product_variants pv ON pv.id = p.variant_id
       LEFT  JOIN categories       c  ON c.id  = p.category_id
       ${stockJoin}
       WHERE ${where}
       ORDER BY p.name ASC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset],
    );

    return { rows, total };
  }

  // ── Product writes ──────────────────────────────────────────────────────────

  async createProduct(data, createdBy) {
    const { rows } = await query(
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
        data.sku,
        data.barcode ?? null,
        data.price,
        data.costPrice ?? null,
        data.type ?? "inventory",
        createdBy,
      ],
    );
    return rows[0].id;
  }

  /**
   * Insert a stock row for a product+store combination.
   * Called inside a transaction during product creation.
   */
  async upsertStock(productId, storeId, quantity, createdBy) {
    await query(
      `INSERT INTO stock (product_id, store_id, quantity, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id, store_id)
       DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
      [productId, storeId, quantity, createdBy],
    );
  }

  async update(id, data, updatedBy) {
    const fieldMap = {
      name: "name",
      price: "price",
      costPrice: "cost_price",
      barcode: "barcode",
      type: "type",
      variantId: "variant_id",
      categoryId: "category_id",
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

    if (!updates.length) return this.findByIdWithStock(id);

    updates.push(`updated_at = NOW()`, `updated_by = $${i++}`);
    values.push(updatedBy, id);

    await query(
      `UPDATE products
       SET ${updates.join(", ")}
       WHERE id = $${i} AND deleted_at IS NULL`,
      values,
    );
    return this.findByIdWithStock(id);
  }

  async toggleStatus(id, updatedBy) {
    const { rows } = await query(
      `UPDATE products
       SET is_active = NOT is_active,
           updated_at = NOW(),
           updated_by = $2
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, is_active`,
      [id, updatedBy],
    );
    return rows[0] || null;
  }

  async softDelete(id, deletedBy) {
    const { rows } = await query(
      `UPDATE products
       SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2, is_active = FALSE
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id, deletedBy],
    );
    return rows[0] || null;
  }
}

export const productRepository = new ProductRepository();
