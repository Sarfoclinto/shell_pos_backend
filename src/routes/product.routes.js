import { Router } from "express";
import {
  listVariants,
  createVariant,
  listProducts,
  getByBarcode,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductStatus,
  deleteProduct,
} from "../controllers/product.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createVariantValidator,
  createProductValidator,
  updateProductValidator,
  listProductsValidator,
  barcodeParamValidator,
} from "../validators/product.validator.js";

const router = Router();

router.use(authenticate);

// ── Variants
// These must be declared before /:id to avoid route conflicts.
router.get("/variants", authorize("products.view"), listVariants);

router.post(
  "/variants",
  authorize("products.create"),
  validate(createVariantValidator),
  createVariant,
);

// ── Barcode scanner lookup
// Must also be before /:id.
router.get(
  "/barcode/:barcode",
  authorize("products.view"),
  validate(barcodeParamValidator),
  getByBarcode,
);

// ── Collection
router.get(
  "/",
  authorize("products.view"),
  validate(listProductsValidator),
  listProducts,
);

router.post(
  "/",
  authorize("products.create"),
  validate(createProductValidator),
  createProduct,
);

// ── Single resource
router.get("/:id", authorize("products.view"), getProductById);

router.put(
  "/:id",
  authorize("products.update"),
  validate(updateProductValidator),
  updateProduct,
);

router.patch(
  "/:id/toggle-status",
  authorize("products.update"),
  toggleProductStatus,
);

router.delete("/:id", authorize("products.delete"), deleteProduct);

export default router;
