import { categoryService } from "../services/category.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * GET /api/v1/categories
 */
export const listCategories = asyncHandler(async (req, res) => {
  const { categories, pagination } = await categoryService.list(req.query);
  return ApiResponse.paginated(
    res,
    categories,
    pagination,
    "Categories fetched successfully",
  );
});

/**
 * GET /api/v1/categories/:id
 */
export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryService.getById(req.params.id);
  return ApiResponse.success(res, category, "Category fetched successfully");
});

/**
 * POST /api/v1/categories
 * Body: { name }
 */
export const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.create(req.body.name, req.user.id);
  return ApiResponse.created(res, category, "Category created successfully");
});

/**
 * PUT /api/v1/categories/:id
 * Body: { name }
 */
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.update(
    req.params.id,
    req.body.name,
    req.user.id,
  );
  return ApiResponse.success(res, category, "Category updated successfully");
});

/**
 * DELETE /api/v1/categories/:id
 * Blocked if category has products assigned.
 */
export const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.remove(req.params.id, req.user.id);
  return ApiResponse.noContent(res, "Category deleted successfully");
});
