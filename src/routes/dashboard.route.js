import { Router } from "express";
import {
  getAdminDashboard,
  getCashierDashboard,
} from "../controllers/dashboard.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

/**
 * GET /api/v1/dashboard/admin
 * Admins and managers only.
 * Pass ?storeId=uuid to scope to one store.
 */
router.get("/admin", authorize("dashboard.view"), getAdminDashboard);

/**
 * GET /api/v1/dashboard/cashier
 * All authenticated users can fetch their own cashier dashboard.
 * Data is automatically scoped to the requesting user.
 */
router.get("/cashier", getCashierDashboard);

export default router;
