import { authService } from "../services/auth.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * POST /api/v1/auth/login
 * Body: { emailOrPhone, password }
 */
export const login = asyncHandler(async (req, res) => {
  const { emailOrPhone, password } = req.body;
  const result = await authService.login(emailOrPhone, password);

  return ApiResponse.success(res, result, "Login successful");
});

/**
 * POST /api/v1/auth/refresh
 * Body: { refreshToken }
 */
export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await authService.refresh(refreshToken);

  return ApiResponse.success(res, result, "Token refreshed");
});

/**
 * POST /api/v1/auth/logout
 * Stateless — client drops tokens. Route exists for audit logging
 * and future token denylist support.
 */
export const logout = asyncHandler(async (_, res) => {
  return ApiResponse.success(res, null, "Logged out successfully");
});

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user's profile.
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  return ApiResponse.success(res, user, "Profile fetched");
});

/**
 * PATCH /api/v1/auth/change-password
 * Body: { currentPassword, newPassword, confirmPassword }
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword);

  return ApiResponse.success(res, null, "Password changed successfully");
});
