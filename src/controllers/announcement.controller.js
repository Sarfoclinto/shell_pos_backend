import { eventBus } from "../events/event-bus.js";
import { EVENTS } from "../events/events.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * POST /api/v1/announcements
 *
 * Sends a real-time announcement to a target audience.
 *
 * Body: {
 *   message:  string
 *   target: {
 *     type: 'global' | 'store' | 'role' | 'user'
 *     id?:   string   — storeId or userId (when type is store/user)
 *     role?: string   — role name (when type is role)
 *   }
 * }
 *
 * Examples:
 *   { message: "System maintenance in 10 min", target: { type: "global" } }
 *   { message: "Please check prices", target: { type: "store", id: "uuid" } }
 *   { message: "New cashier guidelines", target: { type: "role", role: "cashier" } }
 *   { message: "Your password expires soon", target: { type: "user", id: "uuid" } }
 */
export const sendAnnouncement = asyncHandler(async (req, res) => {
  const { message, target } = req.body;

  if (!message?.trim()) throw ApiError.badRequest("Message is required");
  if (!target?.type) throw ApiError.badRequest("Target type is required");

  const validTypes = ["global", "store", "role", "user"];
  if (!validTypes.includes(target.type)) {
    throw ApiError.badRequest(
      `Target type must be one of: ${validTypes.join(", ")}`,
    );
  }

  if ((target.type === "store" || target.type === "user") && !target.id) {
    throw ApiError.badRequest(
      `target.id is required when type is "${target.type}"`,
    );
  }
  if (target.type === "role" && !target.role) {
    throw ApiError.badRequest('target.role is required when type is "role"');
  }

  const payload = {
    message: {
      id: `ann_${Date.now()}`,
      text: message.trim(),
      sentBy: `${req.user.firstName} ${req.user.lastName}`,
      sentByRole: req.user.role.name,
      sentAt: new Date().toISOString(),
    },
    target,
  };

  eventBus.emit(EVENTS.ANNOUNCEMENT, payload);

  return ApiResponse.success(res, payload.message, "Announcement sent");
});
