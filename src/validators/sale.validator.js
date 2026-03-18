import { body, param, query } from "express-validator";

const PAYMENT_METHODS = ["cash", "card", "mobile_money", "split", "other"];

export const createSaleValidator = [
  // ── Items ───────────────────────────────────────────────────────────────────
  body("items")
    .isArray({ min: 1 })
    .withMessage("A sale must have at least one item"),

  body("items.*.productId")
    .isUUID()
    .withMessage("Each item must have a valid productId"),

  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Item quantity must be at least 1"),

  body("items.*.unitPrice")
    .isFloat({ min: 0 })
    .withMessage("Item unit price must be a non-negative number"),

  body("items.*.discount")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("Item discount must be a non-negative number"),

  // ── Totals ──────────────────────────────────────────────────────────────────
  body("discountAmount")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("Discount amount must be a non-negative number"),

  body("taxAmount")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("Tax amount must be a non-negative number"),

  // ── Customer (optional) ─────────────────────────────────────────────────────
  body("customerId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage("customerId must be a valid UUID"),

  // ── Payment ─────────────────────────────────────────────────────────────────
  body("payment").notEmpty().withMessage("Payment details are required"),

  body("payment.method")
    .isIn(PAYMENT_METHODS)
    .withMessage(
      `Payment method must be one of: ${PAYMENT_METHODS.join(", ")}`,
    ),

  body("payment.amount")
    .isFloat({ min: 0.01 })
    .withMessage("Payment amount must be greater than 0"),

  body("payment.referenceNumber")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage("Reference number must not exceed 100 characters"),

  // ── Split payment breakdown (required when method = 'split') ────────────────
  body("payment.splits")
    .if(body("payment.method").equals("split"))
    .isArray({ min: 2 })
    .withMessage("Split payments must have at least 2 entries"),

  body("payment.splits.*.method")
    .if(body("payment.method").equals("split"))
    .isIn(["cash", "card", "mobile_money", "other"])
    .withMessage("Split method must be cash, card, mobile_money, or other"),

  body("payment.splits.*.amount")
    .if(body("payment.method").equals("split"))
    .isFloat({ min: 0.01 })
    .withMessage("Each split amount must be greater than 0"),

  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes must not exceed 500 characters"),
];

export const cancelSaleValidator = [
  body("reason")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason must not exceed 500 characters"),
];

export const receiptParamValidator = [
  param("receiptNumber")
    .trim()
    .notEmpty()
    .withMessage("Receipt number is required"),
];

export const listSalesValidator = [
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

  query("shiftId")
    .optional()
    .isUUID()
    .withMessage("shiftId must be a valid UUID"),

  query("userId")
    .optional()
    .isUUID()
    .withMessage("userId must be a valid UUID"),

  query("customerId")
    .optional()
    .isUUID()
    .withMessage("customerId must be a valid UUID"),

  query("status")
    .optional()
    .isIn(["completed", "pending", "cancelled"])
    .withMessage("status must be completed, pending, or cancelled"),

  query("from")
    .optional()
    .isISO8601()
    .withMessage("from must be a valid ISO 8601 date"),

  query("to")
    .optional()
    .isISO8601()
    .withMessage("to must be a valid ISO 8601 date"),
];
