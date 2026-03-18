import { stockTransferService } from "../services/stock-transfer.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

export const listTransfers = asyncHandler(async (req, res) => {
  const { transfers, pagination } = await stockTransferService.list(req.query);
  return ApiResponse.paginated(
    res,
    transfers,
    pagination,
    "Transfers fetched successfully",
  );
});

export const getTransferById = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await stockTransferService.getById(req.params.id),
    "Transfer fetched successfully",
  ),
);

export const createTransfer = asyncHandler(async (req, res) =>
  ApiResponse.created(
    res,
    await stockTransferService.create(
      req.body,
      req.user.storeId,
      req.user.id,
      req.user.id,
    ),
    "Transfer initiated successfully",
  ),
);

export const approveTransfer = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await stockTransferService.approve(
      req.params.id,
      req.user.id,
      req.body.notes,
    ),
    "Transfer approved — stock deducted from source",
  ),
);

export const completeTransfer = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await stockTransferService.complete(req.params.id, req.user.id),
    "Transfer completed — stock credited to destination",
  ),
);

export const cancelTransfer = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await stockTransferService.cancel(
      req.params.id,
      req.user.id,
      req.body.notes,
    ),
    "Transfer cancelled",
  ),
);
