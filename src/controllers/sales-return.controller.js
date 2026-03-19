import { salesReturnService } from "../services/sales-return.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

export const listSalesReturns = asyncHandler(async (req, res) => {
  const { returns, pagination } = await salesReturnService.list(req.query);
  return ApiResponse.paginated(
    res,
    returns,
    pagination,
    "Sales returns fetched successfully",
  );
});
export const getSalesReturnById = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await salesReturnService.getById(req.params.id),
    "Sales return fetched successfully",
  ),
);
export const createSalesReturn = asyncHandler(async (req, res) =>
  ApiResponse.created(
    res,
    await salesReturnService.create(
      req.body,
      req.user.storeId,
      req.user.id,
      req.user.id,
    ),
    "Sales return initiated successfully",
  ),
);
export const approveSalesReturn = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await salesReturnService.approve(
      req.params.id,
      req.user.id,
      req.body.notes,
    ),
    "Sales return approved",
  ),
);
export const rejectSalesReturn = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await salesReturnService.reject(req.params.id, req.user.id, req.body.notes),
    "Sales return rejected",
  ),
);
