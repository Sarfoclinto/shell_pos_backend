export const ProductModel = {
  table: 'products',
  publicFields: ['id', 'category_id', 'name', 'sku', 'barcode', 'description',
                 'price', 'cost_price', 'tax_rate', 'unit', 'image_url', 'is_active',
                 'created_at', 'updated_at'],
  insertFields: ['category_id', 'name', 'sku', 'barcode', 'description',
                 'price', 'cost_price', 'tax_rate', 'unit', 'image_url', 'is_active'],
  updateFields: ['category_id', 'name', 'sku', 'barcode', 'description',
                 'price', 'cost_price', 'tax_rate', 'unit', 'image_url', 'is_active'],
};
