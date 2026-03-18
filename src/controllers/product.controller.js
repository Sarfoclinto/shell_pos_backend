import { productService } from "../services/product.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

// ── Variants ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/products/variants
 */
export const listVariants = asyncHandler(async (_, res) => {
  const variants = await productService.listVariants();
  return ApiResponse.success(res, variants, "Variants fetched successfully");
});

/**
 * POST /api/v1/products/variants
 * Body: { variation }
 */
export const createVariant = asyncHandler(async (req, res) => {
  const variant = await productService.createVariant(
    req.body.variation,
    req.user.id,
  );
  return ApiResponse.created(res, variant, "Variant created successfully");
});

// ── Products ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/products
 * Query: page, limit, search, categoryId, type, isActive, baseProductId, storeId
 */
export const listProducts = asyncHandler(async (req, res) => {
  const { products, pagination } = await productService.list(req.query);
  return ApiResponse.paginated(
    res,
    products,
    pagination,
    "Products fetched successfully",
  );
});

/**
 * GET /api/v1/products/barcode/:barcode
 * Barcode scanner lookup — returns full product detail with stock.
 */
export const getByBarcode = asyncHandler(async (req, res) => {
  const product = await productService.getByBarcode(req.params.barcode);
  return ApiResponse.success(res, product, "Product fetched successfully");
});

/**
 * GET /api/v1/products/:id
 */
export const getProductById = asyncHandler(async (req, res) => {
  const product = await productService.getById(req.params.id);
  return ApiResponse.success(res, product, "Product fetched successfully");
});

/**
 * POST /api/v1/products
 * Body: { baseProductId, variantId?, name, price, costPrice?, barcode?,
 *         type?, categoryId?, initialStock?: [{ storeId, quantity }] }
 */
export const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.create(req.body, req.user.id);
  return ApiResponse.created(res, product, "Product created successfully");
});

/**
 * PUT /api/v1/products/:id
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.update(
    req.params.id,
    req.body,
    req.user.id,
  );
  return ApiResponse.success(res, product, "Product updated successfully");
});

/**
 * PATCH /api/v1/products/:id/toggle-status
 */
export const toggleProductStatus = asyncHandler(async (req, res) => {
  const result = await productService.toggleStatus(req.params.id, req.user.id);
  return ApiResponse.success(res, result, result.message);
});

/**
 * DELETE /api/v1/products/:id
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  await productService.remove(req.params.id, req.user.id);
  return ApiResponse.noContent(res, "Product deleted successfully");
});
