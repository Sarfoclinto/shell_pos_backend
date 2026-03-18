import { Router } from "express";
import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  toggleSupplierStatus,
  deleteSupplier,
} from "../controllers/supplier.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createSupplierValidator,
  updateSupplierValidator,
  listSuppliersValidator,
} from "../validators/supplier.validator.js";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  authorize("suppliers.view"),
  validate(listSuppliersValidator),
  listSuppliers,
);
router.post(
  "/",
  authorize("suppliers.manage"),
  validate(createSupplierValidator),
  createSupplier,
);
router.get("/:id", authorize("suppliers.view"), getSupplierById);
router.put(
  "/:id",
  authorize("suppliers.manage"),
  validate(updateSupplierValidator),
  updateSupplier,
);
router.patch(
  "/:id/toggle-status",
  authorize("suppliers.manage"),
  toggleSupplierStatus,
);
router.delete("/:id", authorize("suppliers.manage"), deleteSupplier);

export default router;
