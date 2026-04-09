import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { query } from "../config/database.js";
import { joinUserRooms, leaveUserRooms } from "./room-manager.js";
import { registerClientEventHandlers } from "./event-handler.js";
import { initSocketBridge } from "../events/socket-bridge.js";
import { logger } from "../utils/logger.js";
import { scannerSessions } from "../scanner/scanner.sessions.js";
import { productService } from "../services/product.service.js";

/**
 * Initialises Socket.IO on the existing HTTP server.
 * Called once from server.js after the HTTP server is created.
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server} io instance
 */
export const initSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.cors.allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Ping every 25s, disconnect if no pong within 60s
    // Keeps connections alive through Railway's idle timeout
    pingInterval: 25000,
    pingTimeout: 60000,
    transports: ["websocket", "polling"], // polling as fallback for restricted networks
  });

  // ── JWT Authentication Middleware ───────────────────────────────────────────
  // Every connection must send a valid JWT in the handshake.
  // Socket is rejected before it can join any room if auth fails.

  io.use(async (socket, next) => {
    try {
      // The frontend sends the token in the auth object:
      // socket = io(url, { auth: { token: 'Bearer xxx' } })
      const rawToken =
        socket.handshake.auth?.token || socket.handshake.headers?.authorization;

      if (!rawToken) {
        return next(new Error("Authentication token is required"));
      }

      const token = rawToken.startsWith("Bearer ")
        ? rawToken.slice(7)
        : rawToken;

      let decoded;
      try {
        decoded = jwt.verify(token, env.jwt.secret);
      } catch (err) {
        return next(
          new Error(
            err.name === "TokenExpiredError"
              ? "Token has expired"
              : "Invalid token",
          ),
        );
      }

      // Load user + role from DB — same as the HTTP auth middleware
      const { rows } = await query(
        `SELECT
           u.id, u.first_name, u.last_name, u.email,
           u.store_id, u.is_active,
           r.id   AS role_id,
           r.name AS role_name,
           r.dashboard_type
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1 AND u.deleted_at IS NULL`,
        [decoded.id || decoded.userId],
      );

      const user = rows[0];
      if (!user) return next(new Error("User not found"));
      if (!user.is_active) return next(new Error("Account is inactive"));

      if (decoded.role === "scanner") {
        socket.user = {
          id: user.id,
          storeId: user.store_id,
          role: { name: "scanner" },
        };
        socket.data = { sessionId: decoded.sessionId, role: "scanner" };
      } else {
        // Attach user to socket so event handlers can read it
        socket.user = {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          storeId: user.store_id,
          role: {
            id: user.role_id,
            name: user.role_name,
            dashboardType: user.dashboard_type,
          },
        };
        socket.data = { role: "pos" };
      }

      next();
    } catch (err) {
      logger.error("[socket] Auth middleware error:", err);
      next(new Error("Authentication failed"));
    }
  });

  // ── Connection Handler ──────────────────────────────────────────────────────

  io.on("connection", async (socket) => {
    const user = socket.user;
    logger.info(
      `[socket] Connected: ${user.id} (${user.role.name}) store:${user.storeId ?? "none"}`,
    );

    if (socket.data.role === "pos") {
      // Join all relevant rooms for this user
      await joinUserRooms(socket);

      // Register handlers for events the client can send
      registerClientEventHandlers(socket, io);

      // Confirm connection to the client
      socket.emit("connected", {
        message: "Connected to POS real-time server",
        userId: user.id,
        storeId: user.storeId,
        role: user.role.name,
        timestamp: new Date().toISOString(),
      });

      socket.on("disconnect", () => leaveUserRooms(socket));

      // POS client joins its scanner room
      socket.on("scanner:join", ({ sessionId }) => {
        const session = scannerSessions.get(sessionId);
        if (!session) return socket.emit("scanner:session-expired");

        socket.join(`scanner:${sessionId}`);
        scannerSessions.setPosSocket(sessionId, socket.id);
        socket.data.sessionId = sessionId; // save to room for disconnect

        if (session.paired) {
          socket.emit("scanner:paired");
        }
      });
    }

    if (socket.data.role === "scanner") {
      const { sessionId } = socket.data;
      const session = scannerSessions.get(sessionId);

      if (!session) {
        socket.emit("scanner:session-expired");
        socket.disconnect();
        return;
      }

      socket.join(`scanner:${sessionId}`);
      scannerSessions.markPaired(sessionId, socket.id);
      socket.to(`scanner:${sessionId}`).emit("scanner:paired");

      // now mode: "regular" | "add-to-cart" in payload
      socket.on("scanner:scan", async ({ barcode, type, mode }) => {
        const product = await productService.getByBarcode(barcode);
        socket.to(`scanner:${sessionId}`).emit("scanner:scan", {
          barcode,
          type,
          mode,
          product,
          error: product ? null : "Product not found",
        });
        socket.emit("scanner:ack", {
          received: true,
          mode,
          barcode,
          product,
          error: product ? null : "Product not found",
        });
      });

      socket.on("scanner:disconnect-request", () => {
        socket.to(`scanner:${sessionId}`).emit("scanner:disconnected");
        scannerSessions.delete(sessionId);
      });
    }

    // ── Common Socket Disconnect ───────────────────────────────────────────────
    socket.on("disconnect", () => {
      if (socket.data.sessionId) {
        if (socket.data.role === "pos") {
          socket
            .to(`scanner:${socket.data.sessionId}`)
            .emit("scanner:pos-disconnected");
        } else if (socket.data.role === "scanner") {
          socket
            .to(`scanner:${socket.data.sessionId}`)
            .emit("scanner:disconnected");
        }
      }
    });
  });

  // ── Bridge event bus → Socket.IO rooms ─────────────────────────────────────
  initSocketBridge(io);

  logger.info("✅ Socket.IO server initialised");
  return io;
};
