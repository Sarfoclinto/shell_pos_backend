import { query } from "express-validator";

/**
 * Shared date range + store filter used by most report endpoints.
 */
const dateRangeValidator = [
  query("from")
    .optional()
    .isISO8601()
    .withMessage("from must be a valid ISO 8601 date"),

  query("to")
    .optional()
    .isISO8601()
    .withMessage("to must be a valid ISO 8601 date"),

  query("storeId")
    .optional()
    .isUUID()
    .withMessage("storeId must be a valid UUID"),
];

export const salesSummaryValidator = [...dateRangeValidator];

export const salesByDayValidator = [...dateRangeValidator];

export const salesByPaymentValidator = [...dateRangeValidator];

export const topProductsValidator = [
  ...dateRangeValidator,
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),
];

export const topCustomersValidator = [
  ...dateRangeValidator,
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),
];

export const stockLevelsValidator = [
  query("storeId")
    .optional()
    .isUUID()
    .withMessage("storeId must be a valid UUID"),

  query("categoryId")
    .optional()
    .isUUID()
    .withMessage("categoryId must be a valid UUID"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage("limit must be between 1 and 200"),
];

export const lowStockValidator = [
  query("storeId")
    .optional()
    .isUUID()
    .withMessage("storeId must be a valid UUID"),
];

export const stockMovementLogValidator = [
  ...dateRangeValidator,

  query("productId")
    .optional()
    .isUUID()
    .withMessage("productId must be a valid UUID"),

  query("movementType")
    .optional()
    .isIn([
      "sale",
      "purchase",
      "adjustment",
      "transfer_in",
      "transfer_out",
      "return",
    ])
    .withMessage("Invalid movement type"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),
];

export const shiftSummaryValidator = [
  query("storeId")
    .optional()
    .isUUID()
    .withMessage("storeId must be a valid UUID"),

  query("userId")
    .optional()
    .isUUID()
    .withMessage("userId must be a valid UUID"),

  query("from")
    .optional()
    .isISO8601()
    .withMessage("from must be a valid ISO 8601 date"),

  query("to")
    .optional()
    .isISO8601()
    .withMessage("to must be a valid ISO 8601 date"),
];

export const purchaseOrdersSummaryValidator = [
  ...dateRangeValidator,

  query("supplierId")
    .optional()
    .isUUID()
    .withMessage("supplierId must be a valid UUID"),
];
