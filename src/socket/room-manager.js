import { ROOMS } from "../events/events.js";
import { logger } from "../utils/logger.js";

/**
 * Manages which Socket.IO rooms a user joins on connection.
 *
 * A user automatically joins:
 *   - Their personal room      → user:{userId}
 *   - Their store room         → store:{storeId}
 *   - Their role room          → role:{roleName}
 *   - Their store+role room    → store:{storeId}:{roleName}
 *   - The global room          → global
 *
 * This is called once per connection in socket/index.js.
 */
export const joinUserRooms = async (socket) => {
  const { id: userId, storeId, role } = socket.user;

  const rooms = [
    ROOMS.global(),
    ROOMS.user(userId),
    ROOMS.role(role.name.toLowerCase()),
  ];

  if (storeId) {
    rooms.push(ROOMS.store(storeId));
    rooms.push(ROOMS.storeRole(storeId, role.name.toLowerCase()));
  }

  await socket.join(rooms);

  logger.debug(`[socket] User ${userId} joined rooms: ${rooms.join(", ")}`);
};

/**
 * Leave all dynamic rooms on disconnect.
 * Socket.IO automatically handles this, but we log it for debugging.
 */
export const leaveUserRooms = (socket) => {
  const { id: userId } = socket.user;
  logger.debug(`[socket] User ${userId} disconnected — left all rooms`);
};
