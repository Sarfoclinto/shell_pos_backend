import { body, query } from "express-validator";

const REASONS = [
  "stock-count",
  "damaged-items",
  "lost-items",
  "manual-correction",
  "other",
];

export const createAdjustmentValidator = [
  body("reason")
    .isIn(REASONS)
    .withMessage(`Reason must be one of: ${REASONS.join(", ")}`),

  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 }),

  body("items")
    .isArray({ min: 1 })
    .withMessage("An adjustment must have at least one item"),

  body("items.*.productId")
    .isUUID()
    .withMessage("Each item must have a valid productId"),

  body("items.*.adjustedQuantity")
    .isInt({ min: 0 })
    .withMessage("Adjusted quantity must be a non-negative integer"),
];

export const approveAdjustmentValidator = [
  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 }),
];

export const rejectAdjustmentValidator = [
  body("notes")
    .trim()
    .notEmpty()
    .withMessage("A reason for rejection is required")
    .isLength({ max: 500 }),
];

export const listAdjustmentsValidator = [
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
