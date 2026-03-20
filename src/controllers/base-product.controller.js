import { baseProductService } from "../services/base-product.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * GET /api/v1/base-products
 * Query: page, limit, search, categoryId
 *
 * Used by the product creation form to populate the "base product" dropdown.
 */
export const listBaseProducts = asyncHandler(async (req, res) => {
  const { baseProducts, pagination } = await baseProductService.list(req.query);
  return ApiResponse.paginated(
    res,
    baseProducts,
    pagination,
    "Base products fetched successfully",
  );
});

/**
 * GET /api/v1/base-products/:id
 *
 * Returns the base product with all its existing variants listed.
 * Used by the product form to show which variants already exist
 * so the user knows what's already been created under this product.
 */
export const getBaseProductById = asyncHandler(async (req, res) => {
  const bp = await baseProductService.getById(req.params.id);
  return ApiResponse.success(res, bp, "Base product fetched successfully");
});

/**
 * POST /api/v1/base-products
 * Body: { name, description?, categoryId?, imageUrl? }
 *
 * Creates the "concept" (e.g. "Coca-Cola").
 * After this, use POST /products to create the individual variants
 * (e.g. "Coca-Cola 500ml", "Coca-Cola 1L").
 */
export const createBaseProduct = asyncHandler(async (req, res) => {
  const bp = await baseProductService.create(req.body, req.user.id);
  return ApiResponse.created(res, bp, "Base product created successfully");
});

/**
 * PUT /api/v1/base-products/:id
 * Body: any subset of { name, description, categoryId, imageUrl }
 */
export const updateBaseProduct = asyncHandler(async (req, res) => {
  const bp = await baseProductService.update(
    req.params.id,
    req.body,
    req.user.id,
  );
  return ApiResponse.success(res, bp, "Base product updated successfully");
});

/**
 * DELETE /api/v1/base-products/:id
 * Blocked if any variants (products) are still linked to this base product.
 */
export const deleteBaseProduct = asyncHandler(async (req, res) => {
  await baseProductService.remove(req.params.id, req.user.id);
  return ApiResponse.noContent(res, "Base product deleted successfully");
});
