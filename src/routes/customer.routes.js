import { Router } from "express";
import {
  listCustomers,
  getCustomerById,
  getCustomerByPhone,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customer.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createCustomerValidator,
  updateCustomerValidator,
  listCustomersValidator,
  phoneParamValidator,
} from "../validators/customer.validator.js";

const router = Router();
router.use(authenticate);

// Static paths before /:id
router.get(
  "/phone/:phone",
  authorize("customers.view"),
  validate(phoneParamValidator),
  getCustomerByPhone,
);

router.get(
  "/",
  authorize("customers.view"),
  validate(listCustomersValidator),
  listCustomers,
);

router.post(
  "/",
  authorize("customers.manage"),
  validate(createCustomerValidator),
  createCustomer,
);

router.get("/:id", authorize("customers.view"), getCustomerById);

router.put(
  "/:id",
  authorize("customers.manage"),
  validate(updateCustomerValidator),
  updateCustomer,
);

router.delete("/:id", authorize("customers.manage"), deleteCustomer);

export default router;
