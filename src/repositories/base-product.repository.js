import { query } from "../config/database.js";

class BaseProductRepository {
  async findAll({ search, categoryId, limit, offset }) {
    const conditions = ["bp.deleted_at IS NULL"];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(`(bp.name ILIKE $${i} OR bp.description ILIKE $${i})`);
      values.push(`%${search}%`);
      i++;
    }
    if (categoryId) {
      conditions.push(`bp.category_id = $${i++}`);
      values.push(categoryId);
    }

    const where = conditions.join(" AND ");

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM base_products bp WHERE ${where}`,
      values,
    );
    const total = parseInt(countRows[0].count, 10);

    const { rows } = await query(
      `SELECT
         bp.*,
         c.name AS category_name,
         COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL) AS variant_count
       FROM base_products bp
       LEFT JOIN categories c ON c.id = bp.category_id
       LEFT JOIN products   p ON p.base_product_id = bp.id
       WHERE ${where}
       GROUP BY bp.id, c.name
       ORDER BY bp.name ASC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset],
    );

    return { rows, total };
  }

  /**
   * Single base product with its full list of variants.
   * Used by the product creation form to show which SKUs already exist
   * under this base product.
   */
  async findByIdWithVariants(id) {
    const { rows: bp } = await query(
      `SELECT bp.*, c.name AS category_name
       FROM base_products bp
       LEFT JOIN categories c ON c.id = bp.category_id
       WHERE bp.id = $1 AND bp.deleted_at IS NULL`,
      [id],
    );
    if (!bp[0]) return null;

    const { rows: variants } = await query(
      `SELECT
         p.id, p.name, p.sku, p.barcode, p.price,
         p.cost_price, p.type, p.is_active,
         pv.variation
       FROM products p
       LEFT JOIN product_variants pv ON pv.id = p.variant_id
       WHERE p.base_product_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.name ASC`,
      [id],
    );

    return { ...bp[0], variants };
  }

  async findByName(name, excludeId = null) {
    const conditions = [`LOWER(name) = LOWER($1)`, `deleted_at IS NULL`];
    const values = [name];
    if (excludeId) {
      conditions.push(`id != $2`);
      values.push(excludeId);
    }

    const { rows } = await query(
      `SELECT id FROM base_products WHERE ${conditions.join(" AND ")} LIMIT 1`,
      values,
    );
    return rows[0] || null;
  }

  async countActiveVariants(baseProductId) {
    const { rows } = await query(
      `SELECT COUNT(*) FROM products
       WHERE base_product_id = $1 AND deleted_at IS NULL`,
      [baseProductId],
    );
    return parseInt(rows[0].count, 10);
  }

  async create(data, createdBy) {
    const { rows } = await query(
      `INSERT INTO base_products (name, description, category_id, image_url, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
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

  async update(id, data, updatedBy) {
    const fieldMap = {
      name: "name",
      description: "description",
      categoryId: "category_id",
      imageUrl: "image_url",
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

    if (!updates.length) return this.findByIdWithVariants(id);

    updates.push(`updated_at = NOW()`, `updated_by = $${i++}`);
    values.push(updatedBy, id);

    await query(
      `UPDATE base_products
       SET ${updates.join(", ")}
       WHERE id = $${i} AND deleted_at IS NULL`,
      values,
    );
    return this.findByIdWithVariants(id);
  }

  async softDelete(id, deletedBy) {
    const { rows } = await query(
      `UPDATE base_products
       SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id, deletedBy],
    );
    return rows[0] || null;
  }
}

export const baseProductRepository = new BaseProductRepository();
