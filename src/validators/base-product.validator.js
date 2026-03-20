import { body, query } from "express-validator";

export const createBaseProductValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Base product name is required")
    .isLength({ max: 255 })
    .withMessage("Name must not exceed 255 characters"),

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

export const updateBaseProductValidator = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Name cannot be empty")
    .isLength({ max: 255 })
    .withMessage("Name must not exceed 255 characters"),

  body("description")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description must not exceed 2000 characters"),

  body("categoryId")
    .optional({ nullable: true })
    .isUUID()
    .withMessage("categoryId must be a valid UUID"),

  body("imageUrl")
    .optional({ nullable: true, checkFalsy: true })
    .isURL()
    .withMessage("imageUrl must be a valid URL"),
];

export const listBaseProductsValidator = [
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
];
