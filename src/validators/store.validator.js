import { body, query } from "express-validator";

export const createStoreValidator = [
  body("code")
    .trim()
    .notEmpty()
    .withMessage("Store code is required")
    .isLength({ min: 2, max: 5 })
    .withMessage("Store code must be between 2 and 5 characters")
    .matches(/^[A-Z0-9]+$/)
    .withMessage("Store code must be uppercase letters and numbers only"),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Store name is required")
    .isLength({ max: 150 })
    .withMessage("Store name must not exceed 150 characters"),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Address must not exceed 500 characters"),

  body("region")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Region must not exceed 100 characters"),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City must not exceed 100 characters"),

  body("contact")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Contact must not exceed 50 characters"),
];

export const updateStoreValidator = [
  body("code")
    .optional()
    .trim()
    .isLength({ min: 2, max: 5 })
    .withMessage("Store code must be between 2 and 5 characters")
    .matches(/^[A-Z0-9]+$/)
    .withMessage("Store code must be uppercase letters and numbers only"),

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Store name cannot be empty")
    .isLength({ max: 150 })
    .withMessage("Store name must not exceed 150 characters"),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Address must not exceed 500 characters"),

  body("region")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Region must not exceed 100 characters"),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City must not exceed 100 characters"),

  body("contact")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Contact must not exceed 50 characters"),
];

export const listStoresValidator = [
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
    .withMessage("Search term must not exceed 100 characters"),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be true or false"),
];
