import { reportService } from "../services/report.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * GET /api/v1/reports/sales-summary
 * Query: from?, to?, storeId?
 *
 * Returns revenue, order count, discounts, tax, avg order value,
 * unique customers, and active cashiers for the period.
 */
export const salesSummary = asyncHandler(async (req, res) => {
  const data = await reportService.salesSummary(req.query);
  return ApiResponse.success(res, data, "Sales summary fetched successfully");
});

/**
 * GET /api/v1/reports/sales-by-day
 * Query: from?, to?, storeId?
 *
 * Returns one row per calendar day with orders and revenue.
 * The frontend uses this to render line/bar charts.
 */
export const salesByDay = asyncHandler(async (req, res) => {
  const data = await reportService.salesByDay(req.query);
  return ApiResponse.success(res, data, "Daily sales fetched successfully");
});

/**
 * GET /api/v1/reports/sales-by-payment-method
 * Query: from?, to?, storeId?
 *
 * Returns transaction count and total per payment method.
 * The frontend uses this to render a pie/donut chart.
 */
export const salesByPaymentMethod = asyncHandler(async (req, res) => {
  const data = await reportService.salesByPaymentMethod(req.query);
  return ApiResponse.success(
    res,
    data,
    "Payment method breakdown fetched successfully",
  );
});

/**
 * GET /api/v1/reports/top-products
 * Query: from?, to?, storeId?, limit? (default 10)
 */
export const topProducts = asyncHandler(async (req, res) => {
  const data = await reportService.topProducts(req.query);
  return ApiResponse.success(res, data, "Top products fetched successfully");
});

/**
 * GET /api/v1/reports/top-customers
 * Query: from?, to?, storeId?, limit? (default 10)
 */
export const topCustomers = asyncHandler(async (req, res) => {
  const data = await reportService.topCustomers(req.query);
  return ApiResponse.success(res, data, "Top customers fetched successfully");
});

/**
 * GET /api/v1/reports/stock-levels
 * Query: storeId?, categoryId?, page?, limit?
 *
 * Returns current stock per product per store.
 * Paginated since product catalogs can be large.
 */
export const stockLevels = asyncHandler(async (req, res) => {
  const { stockLevels, pagination } = await reportService.stockLevels(
    req.query,
  );
  return ApiResponse.paginated(
    res,
    stockLevels,
    pagination,
    "Stock levels fetched successfully",
  );
});

/**
 * GET /api/v1/reports/low-stock
 * Query: storeId?
 *
 * Returns all products at or below the reorder threshold.
 * Used to drive reorder alerts on the dashboard.
 */
export const lowStock = asyncHandler(async (req, res) => {
  const data = await reportService.lowStock(req.query);
  return ApiResponse.success(
    res,
    data,
    "Low stock report fetched successfully",
  );
});

/**
 * GET /api/v1/reports/stock-movement-log
 * Query: storeId?, productId?, movementType?, from?, to?, page?, limit?
 *
 * Paginated audit trail of every stock movement.
 */
export const stockMovementLog = asyncHandler(async (req, res) => {
  const { movements, pagination } = await reportService.stockMovementLog(
    req.query,
  );
  return ApiResponse.paginated(
    res,
    movements,
    pagination,
    "Stock movement log fetched successfully",
  );
});

/**
 * GET /api/v1/reports/shift-summary
 * Query: storeId?, userId?, from?, to?
 *
 * Returns aggregate totals + per-shift breakdown for cash reconciliation.
 */
export const shiftSummary = asyncHandler(async (req, res) => {
  const data = await reportService.shiftSummary(req.query);
  return ApiResponse.success(res, data, "Shift summary fetched successfully");
});

/**
 * GET /api/v1/reports/purchase-orders-summary
 * Query: storeId?, supplierId?, from?, to?
 *
 * Returns PO status counts + spend breakdown by supplier.
 */
export const purchaseOrdersSummary = asyncHandler(async (req, res) => {
  const data = await reportService.purchaseOrdersSummary(req.query);
  return ApiResponse.success(
    res,
    data,
    "Purchase orders summary fetched successfully",
  );
});
