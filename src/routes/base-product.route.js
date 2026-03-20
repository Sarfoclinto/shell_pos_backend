import { Router } from "express";
import {
  listBaseProducts,
  getBaseProductById,
  createBaseProduct,
  updateBaseProduct,
  deleteBaseProduct,
} from "../controllers/base-product.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createBaseProductValidator,
  updateBaseProductValidator,
  listBaseProductsValidator,
} from "../validators/base-product.validator.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("products.view"),
  validate(listBaseProductsValidator),
  listBaseProducts,
);

router.get("/:id", authorize("products.view"), getBaseProductById);

router.post(
  "/",
  authorize("products.create"),
  validate(createBaseProductValidator),
  createBaseProduct,
);

router.put(
  "/:id",
  authorize("products.update"),
  validate(updateBaseProductValidator),
  updateBaseProduct,
);

router.delete("/:id", authorize("products.delete"), deleteBaseProduct);

export default router;
