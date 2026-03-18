import { inventoryRepository } from "../repositories/inventory.repository.js";
import { ApiError } from "../utils/api-error.js";

export const inventoryService = {
  async getByProduct(productId) {
    const inv = await inventoryRepository.findByProductId(productId);
    if (!inv) throw ApiError.notFound("Inventory record not found");
    return inv;
  },

  async adjust(productId, { quantity, type }) {
    // type: 'add' | 'remove' | 'set'
    const inv = await inventoryRepository.findByProductId(productId);
    if (!inv) throw ApiError.notFound("Inventory record not found");

    let delta;
    if (type === "set") delta = quantity - inv.quantity_on_hand;
    else if (type === "add") delta = quantity;
    else if (type === "remove") delta = -quantity;
    else
      throw ApiError.badRequest(
        "Invalid adjustment type. Use add, remove, or set",
      );

    if (inv.quantity_on_hand + delta < 0) {
      throw ApiError.badRequest("Insufficient stock");
    }
    return inventoryRepository.adjustQuantity(productId, delta);
  },

  async getLowStock() {
    return inventoryRepository.getLowStockItems();
  },

  async updateThresholds(productId, { reorder_level, reorder_quantity }) {
    const inv = await inventoryRepository.findByProductId(productId);
    if (!inv) throw ApiError.notFound("Inventory record not found");
    return inventoryRepository.update(inv.id, {
      reorder_level,
      reorder_quantity,
    });
  },
};
