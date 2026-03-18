import { Router } from "express";
import {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createCategoryValidator,
  updateCategoryValidator,
  listCategoriesValidator,
} from "../validators/category.validator.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("products.view"),
  validate(listCategoriesValidator),
  listCategories,
);

router.get("/:id", authorize("products.view"), getCategoryById);

router.post(
  "/",
  authorize("categories.manage"),
  validate(createCategoryValidator),
  createCategory,
);

router.put(
  "/:id",
  authorize("categories.manage"),
  validate(updateCategoryValidator),
  updateCategory,
);

router.delete("/:id", authorize("categories.manage"), deleteCategory);

export default router;
