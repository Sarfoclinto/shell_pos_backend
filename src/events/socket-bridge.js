import { eventBus } from "./event-bus.js";
import { EVENTS, ROOMS } from "./events.js";
import { logger } from "../utils/logger.js";

/**
 * Socket Bridge — the only place that knows about both
 * the event bus AND Socket.IO.
 *
 * It subscribes to every event on the bus and decides:
 *   - Which Socket.IO room(s) to emit to
 *   - What payload shape to send to the client
 *
 * Called once during server startup with the io instance.
 * After that it runs passively in the background.
 *
 * To add a new real-time feature:
 *   1. Add the event name to events.js
 *   2. Fire eventBus.emit(EVENTS.YOUR_EVENT, data) in a service
 *   3. Add a handler here that maps it to a room
 *   Done.
 */

export const initSocketBridge = (io) => {
  const emit = (room, event, payload) => {
    logger.debug(`[socket] → room "${room}" | event "${event}"`);
    io.to(room).emit(event, {
      event,
      payload,
      timestamp: new Date().toISOString(),
    });
  };

  // ── Products ────────────────────────────────────────────────────────────────

  eventBus.on(EVENTS.PRODUCT_PRICE_UPDATED, ({ product, storeId }) => {
    // Price changes affect all users at the store — cashiers need to
    // update their POS cart prices in real time
    const room = storeId ? ROOMS.store(storeId) : ROOMS.global();
    emit(room, EVENTS.PRODUCT_PRICE_UPDATED, { product });
  });

  eventBus.on(EVENTS.PRODUCT_DEACTIVATED, ({ product, storeId }) => {
    const room = storeId ? ROOMS.store(storeId) : ROOMS.global();
    emit(room, EVENTS.PRODUCT_DEACTIVATED, { product });
  });

  eventBus.on(EVENTS.PRODUCT_ACTIVATED, ({ product, storeId }) => {
    const room = storeId ? ROOMS.store(storeId) : ROOMS.global();
    emit(room, EVENTS.PRODUCT_ACTIVATED, { product });
  });

  eventBus.on(EVENTS.PRODUCT_STOCK_LOW, ({ product, storeId, quantity }) => {
    // Only notify managers and admins at that store
    emit(ROOMS.storeRole(storeId, "manager"), EVENTS.PRODUCT_STOCK_LOW, {
      product,
      quantity,
    });
    emit(ROOMS.storeRole(storeId, "admin"), EVENTS.PRODUCT_STOCK_LOW, {
      product,
      quantity,
    });
  });

  // ── Shifts ──────────────────────────────────────────────────────────────────

  eventBus.on(EVENTS.SHIFT_OPENED, ({ shift, storeId }) => {
    emit(ROOMS.store(storeId), EVENTS.SHIFT_OPENED, { shift });
  });

  eventBus.on(EVENTS.SHIFT_CLOSED, ({ shift, storeId }) => {
    // Everyone at the store sees shift closure — dashboards update
    emit(ROOMS.store(storeId), EVENTS.SHIFT_CLOSED, { shift });
  });

  // ── Sales ───────────────────────────────────────────────────────────────────

  eventBus.on(EVENTS.SALE_COMPLETED, ({ sale, storeId }) => {
    // Broadcast to store — managers see live sales feed
    emit(ROOMS.store(storeId), EVENTS.SALE_COMPLETED, { sale });
  });

  eventBus.on(EVENTS.SALE_CANCELLED, ({ sale, storeId }) => {
    emit(ROOMS.store(storeId), EVENTS.SALE_CANCELLED, { sale });
  });

  // ── Inventory ───────────────────────────────────────────────────────────────

  eventBus.on(EVENTS.STOCK_ADJUSTED, ({ productId, storeId, newQuantity }) => {
    emit(ROOMS.store(storeId), EVENTS.STOCK_ADJUSTED, {
      productId,
      storeId,
      newQuantity,
    });
  });

  eventBus.on(EVENTS.STOCK_TRANSFER_APPROVED, ({ transfer }) => {
    // Notify both stores involved
    emit(ROOMS.store(transfer.fromStoreId), EVENTS.STOCK_TRANSFER_APPROVED, {
      transfer,
    });
    emit(ROOMS.store(transfer.toStoreId), EVENTS.STOCK_TRANSFER_APPROVED, {
      transfer,
    });
  });

  eventBus.on(EVENTS.STOCK_TRANSFER_COMPLETED, ({ transfer }) => {
    emit(ROOMS.store(transfer.fromStoreId), EVENTS.STOCK_TRANSFER_COMPLETED, {
      transfer,
    });
    emit(ROOMS.store(transfer.toStoreId), EVENTS.STOCK_TRANSFER_COMPLETED, {
      transfer,
    });
  });

  // ── Purchase Orders ─────────────────────────────────────────────────────────

  eventBus.on(EVENTS.PURCHASE_ORDER_RECEIVED, ({ purchaseOrder, storeId }) => {
    emit(ROOMS.store(storeId), EVENTS.PURCHASE_ORDER_RECEIVED, {
      purchaseOrder,
    });
  });

  // ── Announcements ───────────────────────────────────────────────────────────

  eventBus.on(EVENTS.ANNOUNCEMENT, ({ message, target }) => {
    // target: { type: 'global' | 'store' | 'role' | 'user', id?: string }
    const room = resolveAnnouncementRoom(target);
    emit(room, EVENTS.ANNOUNCEMENT, { message });
  });

  // ── Chat ────────────────────────────────────────────────────────────────────

  eventBus.on(EVENTS.CHAT_MESSAGE, ({ message, recipientId }) => {
    emit(ROOMS.user(recipientId), EVENTS.CHAT_MESSAGE, { message });
  });

  // ── User account changes ────────────────────────────────────────────────────

  eventBus.on(EVENTS.USER_DEACTIVATED, ({ userId }) => {
    // Force-disconnect the deactivated user — they'll get a 401 on next request
    emit(ROOMS.user(userId), EVENTS.USER_DEACTIVATED, {});
  });

  eventBus.on(EVENTS.USER_ROLE_CHANGED, ({ userId, newRole }) => {
    // Notify the user their role changed — frontend re-fetches permissions
    emit(ROOMS.user(userId), EVENTS.USER_ROLE_CHANGED, { newRole });
  });

  logger.info("✅ Socket bridge initialised");
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const resolveAnnouncementRoom = (target) => {
  switch (target?.type) {
    case "store":
      return ROOMS.store(target.id);
    case "role":
      return ROOMS.role(target.role);
    case "user":
      return ROOMS.user(target.id);
    default:
      return ROOMS.global();
  }
};
