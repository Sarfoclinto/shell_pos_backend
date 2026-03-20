import { query } from "express-validator";
import { body, param } from "express-validator";

export const listInventoryValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("storeId")
    .optional()
    .isUUID()
    .withMessage("storeId must be a valid UUID"),

  query("categoryId")
    .optional()
    .isUUID()
    .withMessage("categoryId must be a valid UUID"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search must not exceed 100 characters"),

  query("lowStock")
    .optional()
    .isBoolean()
    .withMessage("lowStock must be true or false"),

  query("type")
    .optional()
    .isIn(["inventory", "non-inventory"])
    .withMessage('type must be "inventory" or "non-inventory"'),
];

export const productStoreParamValidator = [
  param("productId").isUUID().withMessage("productId must be a valid UUID"),

  param("storeId").isUUID().withMessage("storeId must be a valid UUID"),
];

export const productParamValidator = [
  param("productId").isUUID().withMessage("productId must be a valid UUID"),
];

export const adjustStockValidator = [
  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 0 })
    .withMessage("Quantity must be a non-negative integer"),

  body("type")
    .isIn(["set", "add", "subtract"])
    .withMessage('type must be "set", "add", or "subtract"'),

  body("note")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Note must not exceed 500 characters"),
];
