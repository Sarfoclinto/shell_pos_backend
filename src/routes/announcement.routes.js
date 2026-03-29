import { Router } from "express";
import { sendAnnouncement } from "../controllers/announcement.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

/**
 * POST /api/v1/announcements
 * Only admins and managers can send announcements.
 */
router.post(
  "/",
  authorize("dashboard.view"), // all admin/manager roles have this
  sendAnnouncement,
);

export default router;
