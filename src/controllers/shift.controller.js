import { shiftService } from "../services/shift.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * POST /api/v1/shifts/open
 * Opens a shift for the authenticated user at their assigned store.
 * Body: { openingFloat }
 */
export const openShift = asyncHandler(async (req, res) => {
  const shift = await shiftService.open(
    req.user.id,
    req.user.storeId,
    req.body.openingFloat,
    req.body.openedAt,
  );
  return ApiResponse.created(res, shift, "Shift opened successfully");
});

/**
 * POST /api/v1/shifts/close
 * Closes the authenticated user's currently open shift.
 * Body: { closingCash, notes? }
 */
export const closeShift = asyncHandler(async (req, res) => {
  const shift = await shiftService.close(
    req.user.id,
    req.user.storeId,
    req.body.closingCash,
    req.body.notes,
  );
  return ApiResponse.success(res, shift, "Shift closed successfully");
});

/**
 * POST /api/v1/shifts/admin-close
 * Admin closes a cashier's shift.
 * Body: { cashierId, storeId, closingCash, notes? }
 */
export const adminCloseShift = asyncHandler(async (req, res) => {
  const shift = await shiftService.adminClose(
    req.user.id,
    req.body.cashierId,
    req.body.storeId,
    req.body.closingCash,
    req.body.notes,
  );
  return ApiResponse.success(res, shift, "Shift closed successfully");
});

/**
 * GET /api/v1/shifts/current
 * Returns the authenticated user's currently open shift with live summary.
 */
export const getCurrentShift = asyncHandler(async (req, res) => {
  const shift = await shiftService.getCurrent(req.user.id, req.user.storeId);
  return ApiResponse.success(res, shift, "Current shift fetched successfully");
});

/**
 * GET /api/v1/shifts
 * Paginated list. Query params: page, limit, storeId, userId, status, from, to
 */
export const listShifts = asyncHandler(async (req, res) => {
  const { shifts, pagination } = await shiftService.list(req.query);
  return ApiResponse.paginated(
    res,
    shifts,
    pagination,
    "Shifts fetched successfully",
  );
});

/**
 * GET /api/v1/shifts/:id
 * Full shift detail with payment breakdown and transaction summary.
 */
export const getShiftById = asyncHandler(async (req, res) => {
  const shift = await shiftService.getById(req.params.id);
  return ApiResponse.success(res, shift, "Shift fetched successfully");
});
