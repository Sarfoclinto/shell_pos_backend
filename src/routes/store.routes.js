import { Router } from "express";
import {
  listStores,
  getStoreById,
  createStore,
  updateStore,
  toggleStoreStatus,
  deleteStore,
} from "../controllers/store.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createStoreValidator,
  updateStoreValidator,
  listStoresValidator,
} from "../validators/store.validator.js";

const router = Router();

// All store routes require authentication
router.use(authenticate);

router.get(
  "/",
  authorize("stores.view"),
  validate(listStoresValidator),
  listStores,
);

router.get("/:id", authorize("stores.view"), getStoreById);

router.post(
  "/",
  authorize("stores.manage"),
  validate(createStoreValidator),
  createStore,
);

router.put(
  "/:id",
  authorize("stores.manage"),
  validate(updateStoreValidator),
  updateStore,
);

router.patch(
  "/:id/toggle-status",
  authorize("stores.manage"),
  toggleStoreStatus,
);

router.delete("/:id", authorize("stores.manage"), deleteStore);

export default router;
