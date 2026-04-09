import crypto from "crypto";

// Map<sessionId, SessionRecord>
const sessions = new Map();

const PIN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes to pair

function generatePin(length = 6) {
  return Array.from(
    { length },
    () => PIN_CHARS[crypto.randomInt(PIN_CHARS.length)],
  ).join("");
}

export const scannerSessions = {
  create(userId, storeId) {
    const sessionId = crypto.randomUUID();
    const pin = generatePin();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    sessions.set(sessionId, {
      sessionId,
      pin,
      userId, // cashier who owns this session
      storeId,
      expiresAt,
      paired: false,
      scannerSocketId: null,
      posSocketId: null,
    });

    // Auto-cleanup after TTL
    setTimeout(() => sessions.delete(sessionId), SESSION_TTL_MS);

    return { sessionId, pin, expiresAt };
  },

  get(sessionId) {
    return sessions.get(sessionId) ?? null;
  },

  validate(sessionId, pin) {
    const session = sessions.get(sessionId);
    if (!session) return { valid: false, reason: "Session not found" };
    if (new Date() > session.expiresAt) {
      sessions.delete(sessionId);
      return { valid: false, reason: "Session expired" };
    }
    if (session.pin !== pin.toUpperCase()) {
      return { valid: false, reason: "Invalid PIN" };
    }
    return { valid: true, session };
  },

  markPaired(sessionId, scannerSocketId) {
    const session = sessions.get(sessionId);
    if (session) {
      session.paired = true;
      session.scannerSocketId = scannerSocketId;
    }
  },

  setPosSocket(sessionId, posSocketId) {
    const session = sessions.get(sessionId);
    if (session) session.posSocketId = posSocketId;
  },

  delete(sessionId) {
    sessions.delete(sessionId);
  },
};
