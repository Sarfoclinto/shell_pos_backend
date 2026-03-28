import { dashboardService } from "../services/dashboard.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * GET /api/v1/dashboard/admin
 *
 * Full admin/manager dashboard data in a single request.
 *
 * Query params:
 *   storeId? — scope all metrics to a specific store.
 *              Omit to get global data across all stores.
 *              A manager scoped to one store should always pass their storeId.
 */
export const getAdminDashboard = asyncHandler(async (req, res) => {
  // Managers are scoped to their own store by default
  // Admins can pass any storeId or omit for global view
  const storeId = req.query.storeId || req.user.storeId || null;

  const data = await dashboardService.getAdminDashboard(storeId);
  return ApiResponse.success(res, data, "Dashboard data fetched successfully");
});

/**
 * GET /api/v1/dashboard/cashier
 *
 * Cashier's personal dashboard — scoped to their own data only.
 * Uses req.user.id and req.user.storeId — no query params needed.
 */
export const getCashierDashboard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getCashierDashboard(
    req.user.id,
    req.user.storeId,
  );
  return ApiResponse.success(res, data, "Dashboard data fetched successfully");
});
