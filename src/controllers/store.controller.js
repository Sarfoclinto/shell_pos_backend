import { storeService } from "../services/store.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * GET /api/v1/stores
 * Query params: page, limit, search, isActive
 */
export const listStores = asyncHandler(async (req, res) => {
  const { stores, pagination } = await storeService.list(req.query);

  return ApiResponse.paginated(
    res,
    stores,
    pagination,
    "Stores fetched successfully",
  );
});

/**
 * GET /api/v1/stores/:id
 */
export const getStoreById = asyncHandler(async (req, res) => {
  const store = await storeService.getById(req.params.id);
  return ApiResponse.success(res, store, "Store fetched successfully");
});

/**
 * POST /api/v1/stores
 * Body: { code, name, address?, region?, city?, contact? }
 */
export const createStore = asyncHandler(async (req, res) => {
  const store = await storeService.create(req.body, req.user.id);
  return ApiResponse.created(res, store, "Store created successfully");
});

/**
 * PUT /api/v1/stores/:id
 * Body: any subset of { code, name, address, region, city, contact }
 */
export const updateStore = asyncHandler(async (req, res) => {
  const store = await storeService.update(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, store, "Store updated successfully");
});

/**
 * PATCH /api/v1/stores/:id/toggle-status
 * Activates an inactive store, deactivates an active one.
 * Blocked if store has active users (on deactivation).
 */
export const toggleStoreStatus = asyncHandler(async (req, res) => {
  const store = await storeService.toggleStatus(req.params.id, req.user.id);
  const action = store.isActive ? "activated" : "deactivated";
  return ApiResponse.success(res, store, `Store ${action} successfully`);
});

/**
 * DELETE /api/v1/stores/:id
 * Soft delete. Blocked if store has active users.
 */
export const deleteStore = asyncHandler(async (req, res) => {
  await storeService.remove(req.params.id, req.user.id);
  return ApiResponse.noContent(res, "Store deleted successfully");
});
