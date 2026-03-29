import { EventEmitter } from "events";

/**
 * Application-wide event bus.
 *
 * Services fire events here. The socket bridge listens here
 * and forwards to the right Socket.IO rooms.
 *
 * This decouples services from the WebSocket layer completely —
 * a service doesn't know or care whether Socket.IO is running.
 *
 * Usage in a service:
 *   import { eventBus } from '../events/eventBus.js';
 *   import { EVENTS }   from '../events/events.js';
 *
 *   eventBus.emit(EVENTS.PRODUCT_PRICE_UPDATED, {
 *     productId: '...',
 *     newPrice: 45.00,
 *     storeId: '...',
 *   });
 */
class AppEventBus extends EventEmitter {
  constructor() {
    super();
    // Increase the default listener limit to avoid memory leak warnings
    // in large apps with many event handlers
    this.setMaxListeners(50);
  }
}

export const eventBus = new AppEventBus();
