import { eventBus } from "../events/event-bus.js";
import { EVENTS, ROOMS } from "../events/events.js";
import { logger } from "../utils/logger.js";

/**
 * Handles incoming events FROM the client (browser → server).
 *
 * These are the interactive events where the client initiates something:
 * sending a chat message, marking a notification as read, etc.
 *
 * Outgoing events (server → client) are handled by the socket bridge.
 */
export const registerClientEventHandlers = (socket, io) => {
  const user = socket.user;

  // ── Chat ────────────────────────────────────────────────────────────────────

  /**
   * Client sends: { recipientId, message }
   * Server forwards to recipient's personal room.
   */
  socket.on("chat.send", ({ recipientId, message }) => {
    if (!recipientId || !message?.trim()) return;

    const payload = {
      id: `msg_${Date.now()}`,
      senderId: user.id,
      senderName: `${user.firstName} ${user.lastName}`,
      senderRole: user.role.name,
      recipientId,
      message: message.trim(),
      sentAt: new Date().toISOString(),
    };

    // Fire through the event bus so the bridge handles delivery
    // This also means it could be persisted to DB in the bridge if needed
    eventBus.emit(EVENTS.CHAT_MESSAGE, { message: payload, recipientId });

    // Echo back to sender so their UI updates immediately
    socket.emit(EVENTS.CHAT_MESSAGE, {
      event: EVENTS.CHAT_MESSAGE,
      payload: { message: payload },
      timestamp: new Date().toISOString(),
    });

    logger.debug(`[socket] Chat: ${user.id} → ${recipientId}`);
  });

  /**
   * Broadcast a message to all users in the sender's store.
   * Client sends: { message }
   * Only managers and admins can broadcast — enforced here.
   */
  socket.on("chat.broadcast_store", ({ message }) => {
    const allowedRoles = ["admin", "manager"];
    if (!allowedRoles.includes(user.role.name.toLowerCase())) {
      socket.emit("error", {
        message: "Only managers and admins can broadcast",
      });
      return;
    }
    if (!user.storeId || !message?.trim()) return;

    const payload = {
      id: `msg_${Date.now()}`,
      senderId: user.id,
      senderName: `${user.firstName} ${user.lastName}`,
      senderRole: user.role.name,
      message: message.trim(),
      type: "broadcast",
      sentAt: new Date().toISOString(),
    };

    io.to(ROOMS.store(user.storeId)).emit(EVENTS.CHAT_MESSAGE, {
      event: EVENTS.CHAT_MESSAGE,
      payload: { message: payload },
      timestamp: new Date().toISOString(),
    });
  });

  // ── Presence ─────────────────────────────────────────────────────────────────

  /**
   * Client pings to confirm it's still alive.
   * Useful for showing "online" indicators.
   */
  socket.on("ping", () => {
    socket.emit("pong", { timestamp: new Date().toISOString() });
  });

  // ── Disconnect ───────────────────────────────────────────────────────────────

  socket.on("disconnect", (reason) => {
    logger.debug(`[socket] Disconnected: ${user.id} — reason: ${reason}`);
  });

  socket.on("error", (err) => {
    logger.error(`[socket] Error for user ${user.id}:`, err);
  });
};
