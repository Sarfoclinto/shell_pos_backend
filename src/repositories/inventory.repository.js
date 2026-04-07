import { query } from "../config/database.js";

class InventoryRepository {
  /**
   * Paginated stock list across all products and stores.
   * One row per product+store combination.
   */
  async findAll({
    storeId,
    categoryId,
    search,
    lowStock,
    type,
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
    if (storeId) {
      conditions.push(`s.store_id    = $${i++}`);
      values.push(storeId);
    }
    if (categoryId) {
      conditions.push(`p.category_id = $${i++}`);
      values.push(categoryId);
    }
    if (type) {
      conditions.push(`p.type        = $${i++}`);
      values.push(type);
    }
    if (lowStock === true || lowStock === "true") {
      conditions.push(`COALESCE(s.quantity, 0) <= 10`);
    }

    const where = conditions.join(" AND ");

    // Count distinct product+store pairs
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM products p
       LEFT JOIN stock s ON s.product_id = p.id
       LEFT JOIN stores st ON st.id = s.store_id AND st.deleted_at IS NULL
       WHERE ${where}`,
      values,
    );
    const total = parseInt(countRows[0].count, 10);

    const { rows } = await query(
      `SELECT
         p.id           AS product_id,
         p.name         AS product_name,
         p.sku,
         p.barcode,
         p.type,
         p.is_active,
         p.price,
         c.name         AS category_name,
         pv.variation,
         bp.name        AS base_name,
         bp.image_url,
         bp.id          AS base_id,
         st.id          AS store_id,
         st.name        AS store_name,
         st.code        AS store_code,
         COALESCE(s.quantity, 0) AS quantity,
         s.updated_at   AS last_updated
       FROM products p
       LEFT JOIN categories      c   ON c.id   = p.category_id
       LEFT JOIN product_variants pv  ON pv.id  = p.variant_id
       LEFT JOIN base_products   bp  ON bp.id  = p.base_product_id
       LEFT JOIN stock           s   ON s.product_id = p.id
       LEFT JOIN stores          st  ON st.id  = s.store_id AND st.deleted_at IS NULL
       WHERE ${where}
       ORDER BY p.name ASC, st.name ASC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset],
    );

    return { rows, total };
  }

  /**
   * Stock for a single product across every active store.
   */
  async findByProduct(productId) {
    const { rows: productRows } = await query(
      `SELECT
         p.id, p.name, p.sku, p.barcode, p.type, p.is_active,
         p.price, p.cost_price,
         c.name     AS category_name,
         pv.variation,
         bp.name    AS base_name,
         bp.image_url
       FROM products p
       LEFT JOIN categories      c  ON c.id  = p.category_id
       LEFT JOIN product_variants pv ON pv.id = p.variant_id
       LEFT JOIN base_products   bp ON bp.id  = p.base_product_id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [productId],
    );
    if (!productRows[0]) return null;

    const { rows: stockRows } = await query(
      `SELECT
         st.id    AS store_id,
         st.name  AS store_name,
         st.code  AS store_code,
         COALESCE(s.quantity, 0) AS quantity,
         s.updated_at AS last_updated
       FROM stores st
       LEFT JOIN stock s ON s.store_id = st.id AND s.product_id = $1
       WHERE st.deleted_at IS NULL AND st.is_active = TRUE
       ORDER BY st.name ASC`,
      [productId],
    );

    return { product: productRows[0], stockByStore: stockRows };
  }

  /**
   * Stock for a single product at a single store.
   */
  async findByProductAndStore(productId, storeId) {
    const { rows } = await query(
      `SELECT
         p.id, p.name, p.sku, p.barcode, p.type, p.is_active,
         p.price, p.cost_price,
         c.name     AS category_name,
         pv.variation,
         st.id      AS store_id,
         st.name    AS store_name,
         st.code    AS store_code,
         COALESCE(s.quantity, 0) AS quantity,
         s.updated_at AS last_updated
       FROM products p
       LEFT JOIN categories      c  ON c.id  = p.category_id
       LEFT JOIN product_variants pv ON pv.id = p.variant_id
       LEFT JOIN stores          st ON st.id  = $2 AND st.deleted_at IS NULL
       LEFT JOIN stock           s  ON s.product_id = p.id AND s.store_id = $2
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [productId, storeId],
    );
    return rows[0] || null;
  }

  /**
   * Upsert stock quantity and record a movement.
   * type: 'set' | 'add' | 'subtract'
   */
  async adjustStock(productId, storeId, quantity, type, note, userId) {
    // Get current quantity
    const { rows: current } = await query(
      `SELECT COALESCE(s.quantity, 0) AS qty
       FROM products p
       LEFT JOIN stock s ON s.product_id = p.id AND s.store_id = $2
       WHERE p.id = $1`,
      [productId, storeId],
    );

    if (!current[0]) return null;

    const currentQty = parseInt(current[0].qty, 10);

    let newQty;
    let delta;

    if (type === "set") {
      newQty = quantity;
      delta = quantity - currentQty;
    } else if (type === "add") {
      newQty = currentQty + quantity;
      delta = quantity;
    } else {
      // subtract
      newQty = Math.max(0, currentQty - quantity);
      delta = newQty - currentQty; // will be negative
    }

    // Upsert stock
    await query(
      `INSERT INTO stock (product_id, store_id, quantity, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id, store_id)
       DO UPDATE SET quantity = $3, updated_at = NOW(), updated_by = $4`,
      [productId, storeId, newQty, userId],
    );

    // Record movement (only if quantity actually changed)
    if (delta !== 0) {
      await query(
        `INSERT INTO stock_movements
           (product_id, store_id, movement_type, quantity_change,
            reference_type, reference_id, note, created_by)
         VALUES ($1, $2, 'adjustment', $3, 'adjustment', $4, $5, $6)`,
        [
          productId,
          storeId,
          delta,
          productId,
          note ?? "Manual stock adjustment",
          userId,
        ],
      );
    }

    return this.findByProductAndStore(productId, storeId);
  }
}

export const inventoryRepository = new InventoryRepository();
