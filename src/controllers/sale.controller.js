import { saleService } from "../services/sale.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * GET /api/v1/sales
 * Query: page, limit, storeId, shiftId, userId, customerId, status, from, to
 */
export const listSales = asyncHandler(async (req, res) => {
  const { sales, pagination } = await saleService.list(req.query);
  return ApiResponse.paginated(
    res,
    sales,
    pagination,
    "Sales fetched successfully",
  );
});

/**
 * GET /api/v1/sales/receipt/:receiptNumber
 * Lookup by receipt number — used for reprint, customer queries.
 * Must be declared before /:id.
 */
export const getSaleByReceipt = asyncHandler(async (req, res) => {
  const sale = await saleService.getByReceiptNumber(req.params.receiptNumber);
  return ApiResponse.success(res, sale, "Sale fetched successfully");
});

/**
 * GET /api/v1/sales/:id
 */
export const getSaleById = asyncHandler(async (req, res) => {
  const sale = await saleService.getById(req.params.id);
  return ApiResponse.success(res, sale, "Sale fetched successfully");
});

/**
 * POST /api/v1/sales
 * The core POS action — creates sale, items, deducts stock, records payment.
 * Requires an open shift (enforced by requireShift middleware on the route).
 *
 * Body: {
 *   items: [{ productId, quantity, unitPrice, discount? }],
 *   customerId?,
 *   discountAmount?,
 *   taxAmount?,
 *   notes?,
 *   payment: {
 *     method, amount, referenceNumber?,
 *     splits?: [{ method, amount, referenceNumber? }]
 *   }
 * }
 */
export const createSale = asyncHandler(async (req, res) => {
  const sale = await saleService.create(req.body, req.user, req.shift);
  return ApiResponse.created(res, sale, "Sale completed successfully");
});

/**
 * PATCH /api/v1/sales/:id/cancel
 * Body: { reason? }
 */
export const cancelSale = asyncHandler(async (req, res) => {
  const sale = await saleService.cancel(
    req.params.id,
    req.user.id,
    req.body.reason,
  );
  return ApiResponse.success(res, sale, "Sale cancelled successfully");
});
