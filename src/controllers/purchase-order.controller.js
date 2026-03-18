import { purchaseOrderService } from "../services/purchase-order.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

export const listPurchaseOrders = asyncHandler(async (req, res) => {
  const { purchaseOrders, pagination } = await purchaseOrderService.list(
    req.query,
  );
  return ApiResponse.paginated(
    res,
    purchaseOrders,
    pagination,
    "Purchase orders fetched successfully",
  );
});
export const getPurchaseOrderById = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await purchaseOrderService.getById(req.params.id),
    "Purchase order fetched successfully",
  ),
);
export const createPurchaseOrder = asyncHandler(async (req, res) =>
  ApiResponse.created(
    res,
    await purchaseOrderService.create(
      req.body,
      req.user.storeId,
      req.user.id,
      req.user.id,
    ),
    "Purchase order created successfully",
  ),
);
export const markOrdered = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await purchaseOrderService.markOrdered(req.params.id, req.user.id),
    "Purchase order marked as ordered",
  ),
);
export const receiveItems = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await purchaseOrderService.receiveItems(
      req.params.id,
      req.body.items,
      req.user.storeId,
      req.user.id,
    ),
    "Items received successfully",
  ),
);
export const cancelPurchaseOrder = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await purchaseOrderService.cancel(req.params.id, req.user.id),
    "Purchase order cancelled",
  ),
);
