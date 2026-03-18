import { Router } from "express";
import {
  salesSummary,
  salesByDay,
  salesByPaymentMethod,
  topProducts,
  topCustomers,
  stockLevels,
  lowStock,
  stockMovementLog,
  shiftSummary,
  purchaseOrdersSummary,
} from "../controllers/report.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  salesSummaryValidator,
  salesByDayValidator,
  salesByPaymentValidator,
  topProductsValidator,
  topCustomersValidator,
  stockLevelsValidator,
  lowStockValidator,
  stockMovementLogValidator,
  shiftSummaryValidator,
  purchaseOrdersSummaryValidator,
} from "../validators/report.validator.js";

const router = Router();

// All report routes require authentication and reports.view control
router.use(authenticate, authorize("reports.view"));

router.get("/sales-summary", validate(salesSummaryValidator), salesSummary);
router.get("/sales-by-day", validate(salesByDayValidator), salesByDay);
router.get(
  "/sales-by-payment-method",
  validate(salesByPaymentValidator),
  salesByPaymentMethod,
);
router.get("/top-products", validate(topProductsValidator), topProducts);
router.get("/top-customers", validate(topCustomersValidator), topCustomers);
router.get("/stock-levels", validate(stockLevelsValidator), stockLevels);
router.get("/low-stock", validate(lowStockValidator), lowStock);
router.get(
  "/stock-movement-log",
  validate(stockMovementLogValidator),
  stockMovementLog,
);
router.get("/shift-summary", validate(shiftSummaryValidator), shiftSummary);
router.get(
  "/purchase-orders-summary",
  validate(purchaseOrdersSummaryValidator),
  purchaseOrdersSummary,
);

export default router;
