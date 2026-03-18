import { inventoryAdjustmentService } from "../services/inventory-adjustment.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

export const listAdjustments = asyncHandler(async (req, res) => {
  const { adjustments, pagination } = await inventoryAdjustmentService.list(
    req.query,
  );
  return ApiResponse.paginated(
    res,
    adjustments,
    pagination,
    "Adjustments fetched successfully",
  );
});
export const getAdjustmentById = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await inventoryAdjustmentService.getById(req.params.id),
    "Adjustment fetched successfully",
  ),
);
export const createAdjustment = asyncHandler(async (req, res) =>
  ApiResponse.created(
    res,
    await inventoryAdjustmentService.create(
      req.body,
      req.user.storeId,
      req.user.id,
      req.user.id,
    ),
    "Adjustment created successfully",
  ),
);
export const approveAdjustment = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await inventoryAdjustmentService.approve(
      req.params.id,
      req.user.id,
      req.body.notes,
    ),
    "Adjustment approved",
  ),
);
export const rejectAdjustment = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await inventoryAdjustmentService.reject(
      req.params.id,
      req.user.id,
      req.body.notes,
    ),
    "Adjustment rejected",
  ),
);
