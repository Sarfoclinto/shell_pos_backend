import { body, param, query } from "express-validator";

// ── Variant ───────────────────────────────────────────────────────────────────

export const createVariantValidator = [
  body("variation")
    .trim()
    .notEmpty()
    .withMessage("Variation label is required")
    .isLength({ max: 100 })
    .withMessage("Variation must not exceed 100 characters"),
];

// ── Base Product ──────────────────────────────────────────────────────────────

export const createBaseProductValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ max: 255 })
    .withMessage("Product name must not exceed 255 characters"),

  body("description")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description must not exceed 2000 characters"),

  body("categoryId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage("categoryId must be a valid UUID"),

  body("imageUrl")
    .optional({ nullable: true, checkFalsy: true })
    .isURL()
    .withMessage("imageUrl must be a valid URL"),
];

// ── Product (SKU / variant) ───────────────────────────────────────────────────

export const createProductValidator = [
  body("baseProductId")
    .trim()
    .notEmpty()
    .withMessage("baseProductId is required")
    .isUUID()
    .withMessage("baseProductId must be a valid UUID"),

  body("variantId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage("variantId must be a valid UUID"),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product display name is required")
    .isLength({ max: 255 })
    .withMessage("Name must not exceed 255 characters"),

  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .isFloat({ min: 0 })
    .withMessage("Price must be a non-negative number"),

  body("costPrice")
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage("Cost price must be a non-negative number"),

  body("barcode")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage("Barcode must not exceed 100 characters"),

  body("type")
    .optional()
    .isIn(["inventory", "non-inventory"])
    .withMessage('Type must be "inventory" or "non-inventory"'),

  body("categoryId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage("categoryId must be a valid UUID"),

  // Initial stock per store — optional array
  body("initialStock")
    .optional()
    .isArray()
    .withMessage("initialStock must be an array"),

  body("initialStock.*.storeId")
    .optional()
    .isUUID()
    .withMessage("Each initialStock entry must have a valid storeId"),

  body("initialStock.*.quantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Each initialStock quantity must be a non-negative integer"),
];

export const updateProductValidator = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Name cannot be empty")
    .isLength({ max: 255 })
    .withMessage("Name must not exceed 255 characters"),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a non-negative number"),

  body("costPrice")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("Cost price must be a non-negative number"),

  body("barcode")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage("Barcode must not exceed 100 characters"),

  body("type")
    .optional()
    .isIn(["inventory", "non-inventory"])
    .withMessage('Type must be "inventory" or "non-inventory"'),

  body("variantId")
    .optional({ nullable: true })
    .isUUID()
    .withMessage("variantId must be a valid UUID"),

  body("categoryId")
    .optional({ nullable: true })
    .isUUID()
    .withMessage("categoryId must be a valid UUID"),

  body("imageUrl")
    .optional({ nullable: true, checkFalsy: true })
    .isURL()
    .withMessage("imageUrl must be a valid URL"),
];

// ── List / search ─────────────────────────────────────────────────────────────

export const listProductsValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search must not exceed 100 characters"),

  query("categoryId")
    .optional()
    .isUUID()
    .withMessage("categoryId must be a valid UUID"),

  query("type")
    .optional()
    .isIn(["inventory", "non-inventory"])
    .withMessage('type must be "inventory" or "non-inventory"'),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be true or false"),

  query("baseProductId")
    .optional()
    .isUUID()
    .withMessage("baseProductId must be a valid UUID"),

  query("storeId")
    .optional()
    .isUUID()
    .withMessage("storeId must be a valid UUID"),
];

export const barcodeParamValidator = [
  param("barcode").trim().notEmpty().withMessage("Barcode is required"),
];
