import { body, query } from "express-validator";

export const createSalesReturnValidator = [
  body("saleId").isUUID().withMessage("saleId must be a valid UUID"),

  body("reason")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason must not exceed 500 characters"),

  body("items")
    .isArray({ min: 1 })
    .withMessage("A return must have at least one item"),

  body("items.*.productId")
    .isUUID()
    .withMessage("Each item must have a valid productId"),

  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Return quantity must be at least 1"),

  body("items.*.unitPrice")
    .isFloat({ min: 0 })
    .withMessage("Unit price must be a non-negative number"),
];

export const approveReturnValidator = [
  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 }),
];

export const rejectReturnValidator = [
  body("notes")
    .trim()
    .notEmpty()
    .withMessage("A reason for rejection is required")
    .isLength({ max: 500 }),
];

export const listSalesReturnsValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("storeId").optional().isUUID(),
  query("status")
    .optional()
    .isIn(["pending", "approved", "rejected"])
    .withMessage("status must be pending, approved, or rejected"),
  query("from").optional().isISO8601(),
  query("to").optional().isISO8601(),
];
