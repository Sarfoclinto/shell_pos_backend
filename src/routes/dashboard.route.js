import { Router } from "express";
import {
  getAdminDashboard,
  getCashierDashboard,
  getManagerDashboard,
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

/**
 * GET /api/v1/dashboard/manager
 * Managers and admins only.
 * Optional query params:
 *   storeId? — scope to a store (managers should pass their own)
 *   from?    — ISO date string (default: 30 days ago)
 *   to?      — ISO date string (default: now)
 */
router.get("/manager", authorize("dashboard.view"), getManagerDashboard);

export default router;
