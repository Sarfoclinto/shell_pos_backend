import { userService } from "../services/user.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * GET /api/v1/users
 * Query params: page, limit, search, storeId, roleId, isActive
 */
export const listUsers = asyncHandler(async (req, res) => {
  const { users, pagination } = await userService.list(req.query);
  return ApiResponse.paginated(
    res,
    users,
    pagination,
    "Users fetched successfully",
  );
});

/**
 * GET /api/v1/users/:id
 */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getById(req.params.id);
  return ApiResponse.success(res, user, "User fetched successfully");
});

/**
 * POST /api/v1/users
 * Body: { firstName, lastName, phone, email?, password, roleId, storeId?,
 *         address?, region?, city? }
 */
export const createUser = asyncHandler(async (req, res) => {
  const user = await userService.create(req.body, req.user.id);
  return ApiResponse.created(res, user, "User created successfully");
});

/**
 * PUT /api/v1/users/:id
 * Body: any subset of user fields (except password — use reset-password)
 */
export const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.update(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, user, "User updated successfully");
});

/**
 * PATCH /api/v1/users/:id/toggle-status
 * Activates / deactivates a user. Cannot be used on self.
 */
export const toggleUserStatus = asyncHandler(async (req, res) => {
  const result = await userService.toggleStatus(req.params.id, req.user.id);
  return ApiResponse.success(res, result, result.message);
});

/**
 * PATCH /api/v1/users/:id/reset-password
 * Admin/Manager resets another user's password.
 * Body: { newPassword }
 */
export const resetPassword = asyncHandler(async (req, res) => {
  await userService.resetPassword(
    req.params.id,
    req.body.newPassword,
    req.user.id,
  );
  return ApiResponse.success(res, null, "Password reset successfully");
});

/**
 * DELETE /api/v1/users/:id
 * Soft delete. Cannot delete self.
 */
export const deleteUser = asyncHandler(async (req, res) => {
  await userService.remove(req.params.id, req.user.id);
  return ApiResponse.noContent(res, "User deleted successfully");
});

// ── Per-user control overrides ────────────────────────────────────────────────

/**
 * GET /api/v1/users/:id/controls
 * Returns { roleControls, userControls } for the user.
 * roleControls — all controls inherited from the user's role
 * userControls — controls granted directly to this user
 */
export const getUserControls = asyncHandler(async (req, res) => {
  const controls = await userService.getControls(req.params.id);
  return ApiResponse.success(
    res,
    controls,
    "User controls fetched successfully",
  );
});

/**
 * PUT /api/v1/users/:id/controls
 * Replaces the user's control overrides entirely.
 * Body: { controlIds: string[] }
 */
export const replaceUserControls = asyncHandler(async (req, res) => {
  const controls = await userService.replaceControls(
    req.params.id,
    req.body.controlIds,
    req.user.id,
  );
  return ApiResponse.success(
    res,
    controls,
    "User controls updated successfully",
  );
});
