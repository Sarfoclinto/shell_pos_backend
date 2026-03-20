import { inventoryService } from "../services/inventory.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * GET /api/v1/inventory
 * Query: page, limit, storeId, categoryId, search, lowStock, type
 *
 * Main inventory view — one row per product+store combination.
 * Pass storeId to scope to a specific store.
 * Pass lowStock=true to see only items at or below reorder threshold.
 */
export const listInventory = asyncHandler(async (req, res) => {
  const { inventory, pagination } = await inventoryService.list(req.query);
  return ApiResponse.paginated(
    res,
    inventory,
    pagination,
    "Inventory fetched successfully",
  );
});

/**
 * GET /api/v1/inventory/:productId
 * Returns stock for one product broken down across every active store.
 * Also includes the total quantity across all stores.
 *
 * Response:
 *   { product: {...}, stockByStore: [{storeId, storeName, quantity}], totalQuantity }
 */
export const getProductInventory = asyncHandler(async (req, res) => {
  const data = await inventoryService.getByProduct(req.params.productId);
  return ApiResponse.success(
    res,
    data,
    "Product inventory fetched successfully",
  );
});

/**
 * GET /api/v1/inventory/:productId/:storeId
 * Returns stock for one product at one specific store.
 */
export const getProductStoreInventory = asyncHandler(async (req, res) => {
  const { productId, storeId } = req.params;
  const data = await inventoryService.getByProductAndStore(productId, storeId);
  return ApiResponse.success(res, data, "Stock fetched successfully");
});

/**
 * PATCH /api/v1/inventory/:productId/:storeId
 * Directly adjust the stock quantity for a product at a store.
 * Automatically records a stock_movement entry.
 *
 * Body: {
 *   quantity: number,          — the amount (meaning depends on type)
 *   type: 'set'|'add'|'subtract',
 *   note?: string              — reason for the adjustment
 * }
 *
 * Examples:
 *   { quantity: 50, type: 'set' }      → sets stock to exactly 50
 *   { quantity: 10, type: 'add' }      → adds 10 to current stock
 *   { quantity: 5,  type: 'subtract' } → removes 5 from current stock
 */
export const adjustStock = asyncHandler(async (req, res) => {
  const { productId, storeId } = req.params;
  const data = await inventoryService.adjust(
    productId,
    storeId,
    req.body,
    req.user.id,
  );
  return ApiResponse.success(res, data, "Stock adjusted successfully");
});
