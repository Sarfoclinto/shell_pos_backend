/**
 * Central registry of all real-time event names.
 *
 * CONVENTION:
 *   {domain}.{action}
 *
 * Import this anywhere you need to fire or listen to an event.
 * Never use raw strings — always reference this object.
 * That way a rename here catches every usage at once.
 */

export const EVENTS = Object.freeze({
  // ── Products ────────────────────────────────────────────────────────────────
  PRODUCT_PRICE_UPDATED: "product.price_updated",
  PRODUCT_DEACTIVATED: "product.deactivated",
  PRODUCT_ACTIVATED: "product.activated",
  PRODUCT_STOCK_LOW: "product.stock_low",

  // ── Shifts ──────────────────────────────────────────────────────────────────
  SHIFT_OPENED: "shift.opened",
  SHIFT_CLOSED: "shift.closed",

  // ── Sales ───────────────────────────────────────────────────────────────────
  SALE_COMPLETED: "sale.completed",
  SALE_CANCELLED: "sale.cancelled",

  // ── Inventory ───────────────────────────────────────────────────────────────
  STOCK_ADJUSTED: "stock.adjusted",
  STOCK_TRANSFER_APPROVED: "stock.transfer_approved",
  STOCK_TRANSFER_COMPLETED: "stock.transfer_completed",

  // ── Purchase Orders ─────────────────────────────────────────────────────────
  PURCHASE_ORDER_RECEIVED: "purchase_order.received",

  // ── Announcements ───────────────────────────────────────────────────────────
  ANNOUNCEMENT: "announcement",

  // ── Chat ────────────────────────────────────────────────────────────────────
  CHAT_MESSAGE: "chat.message",
  CHAT_MESSAGE_READ: "chat.message_read",

  // ── System ──────────────────────────────────────────────────────────────────
  // Sent to a specific user when their account is changed
  USER_DEACTIVATED: "user.deactivated",
  USER_ROLE_CHANGED: "user.role_changed",
});

/**
 * Room name builders — always construct room names through these
 * so the format is consistent everywhere.
 */
export const ROOMS = Object.freeze({
  global: () => "global",
  user: (userId) => `user:${userId}`,
  store: (storeId) => `store:${storeId}`,
  storeRole: (storeId, role) => `store:${storeId}:${role}`,
  role: (role) => `role:${role}`,
});
