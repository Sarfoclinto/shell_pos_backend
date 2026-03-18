export const InventoryModel = {
  table: "inventory",
  publicFields: [
    "id",
    "product_id",
    "quantity_on_hand",
    "reorder_level",
    "reorder_quantity",
    "last_restocked_at",
    "updated_at",
  ],
  updateFields: [
    "quantity_on_hand",
    "reorder_level",
    "reorder_quantity",
    "last_restocked_at",
  ],
};
