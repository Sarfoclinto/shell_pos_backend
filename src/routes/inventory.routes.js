import { Router } from "express";
import {
  listInventory,
  getProductInventory,
  getProductStoreInventory,
  adjustStock,
} from "../controllers/inventory.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  listInventoryValidator,
  productParamValidator,
  productStoreParamValidator,
  adjustStockValidator,
} from "../validators/inventory.validator.js";

const router = Router();

router.use(authenticate);

/**
 * Main inventory list — paginated, filterable.
 * This is the primary inventory management screen.
 */
router.get(
  "/",
  authorize("stock.view"),
  validate(listInventoryValidator),
  listInventory,
);

/**
 * Static sub-paths must come before /:productId to avoid route conflicts.
 * (none currently, but good to note for future additions)
 */

/**
 * Stock for one product across all stores.
 * Used on the product detail page to show store-by-store breakdown.
 */
router.get(
  "/:productId",
  authorize("stock.view"),
  validate(productParamValidator),
  getProductInventory,
);

/**
 * Stock for one product at one specific store.
 * Used by the cashier screen / quick stock check.
 */
router.get(
  "/:productId/:storeId",
  authorize("stock.view"),
  validate(productStoreParamValidator),
  getProductStoreInventory,
);

/**
 * Direct stock adjustment — no approval workflow.
 * For quick corrections by managers. For audited adjustments,
 * use POST /inventory-adjustments instead.
 */
router.patch(
  "/:productId/:storeId",
  authorize("stock.adjust"),
  validate([...productStoreParamValidator, ...adjustStockValidator]),
  adjustStock,
);

export default router;
