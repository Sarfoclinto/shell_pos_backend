import { query } from "../config/database.js";

class PurchaseOrderRepository {
  async generateOrderNumber() {
    const now = new Date();
    const ts = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const dayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
    const { rows } = await query(
      `SELECT COUNT(*) FROM purchase_orders WHERE order_date >= $1`,
      [dayStart],
    );
    const seq = String(parseInt(rows[0].count, 10) + 1).padStart(4, "0");
    return `PO-${ts}-${seq}`;
  }

  async findAll({ storeId, supplierId, status, from, to, limit, offset }) {
    const conds = [];
    const vals = [];
    let i = 1;
    if (storeId) {
      conds.push(`po.store_id    = $${i++}`);
      vals.push(storeId);
    }
    if (supplierId) {
      conds.push(`po.supplier_id = $${i++}`);
      vals.push(supplierId);
    }
    if (status) {
      conds.push(`po.status      = $${i++}`);
      vals.push(status);
    }
    if (from) {
      conds.push(`po.order_date >= $${i++}`);
      vals.push(from);
    }
    if (to) {
      conds.push(`po.order_date <= $${i++}`);
      vals.push(to);
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const { rows: cr } = await query(
      `SELECT COUNT(*) FROM purchase_orders po ${where}`,
      vals,
    );
    const total = parseInt(cr[0].count, 10);

    const { rows } = await query(
      `SELECT po.*, sp.name AS supplier_name, st.name AS store_name, st.code AS store_code,
              u.first_name, u.last_name,
              COALESCE(json_agg(json_build_object(
                'id',               poi.id,
                'productId',        poi.product_id,
                'productName',      p.name,
                'sku',              p.sku,
                'quantityOrdered',  poi.quantity_ordered,
                'quantityReceived', poi.quantity_received,
                'unitPrice',        poi.unit_price,
                'totalPrice',       poi.total_price
              ) ORDER BY poi.id) FILTER (WHERE poi.id IS NOT NULL), '[]') AS items
       FROM purchase_orders po
       JOIN suppliers sp ON sp.id = po.supplier_id
       JOIN stores    st ON st.id = po.store_id
       JOIN users     u  ON u.id  = po.user_id
       LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
       LEFT JOIN products p ON p.id = poi.product_id
       ${where}
       GROUP BY po.id, sp.name, st.name, st.code, u.first_name, u.last_name
       ORDER BY po.order_date DESC
       LIMIT ${i} OFFSET ${i + 1}`,
      [...vals, limit, offset],
    );
    return { rows, total };
  }

  async findByIdWithItems(id) {
    const { rows } = await query(
      `SELECT po.*, sp.name AS supplier_name, sp.phone AS supplier_phone,
              st.name AS store_name, st.code AS store_code,
              u.first_name, u.last_name,
              COALESCE(json_agg(json_build_object(
                'id',               poi.id,
                'productId',        poi.product_id,
                'productName',      p.name,
                'sku',              p.sku,
                'quantityOrdered',  poi.quantity_ordered,
                'quantityReceived', poi.quantity_received,
                'unitPrice',        poi.unit_price,
                'totalPrice',       poi.total_price
              ) ORDER BY poi.id) FILTER (WHERE poi.id IS NOT NULL), '[]') AS items
       FROM purchase_orders po
       JOIN suppliers sp ON sp.id = po.supplier_id
       JOIN stores    st ON st.id = po.store_id
       JOIN users     u  ON u.id  = po.user_id
       LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
       LEFT JOIN products p ON p.id = poi.product_id
       WHERE po.id = $1
       GROUP BY po.id, sp.name, sp.phone, st.name, st.code, u.first_name, u.last_name`,
      [id],
    );
    return rows[0] || null;
  }

  async create(data, storeId, userId, createdBy) {
    const orderNumber = await this.generateOrderNumber();
    const { rows } = await query(
      `INSERT INTO purchase_orders
         (order_number, supplier_id, store_id, user_id, status, total_amount,
          expected_delivery_date, order_date, created_by)
       VALUES ($1,$2,$3,$4,'pending',$5,$6,NOW(),$7) RETURNING id`,
      [
        orderNumber,
        data.supplierId,
        storeId,
        userId,
        data.totalAmount,
        data.expectedDeliveryDate ?? null,
        createdBy,
      ],
    );
    return rows[0].id;
  }

  async createItems(purchaseOrderId, items, createdBy) {
    for (const item of items) {
      await query(
        `INSERT INTO purchase_order_items
           (purchase_order_id, product_id, quantity_ordered, quantity_received, unit_price, total_price, created_by)
         VALUES ($1,$2,$3,0,$4,$5,$6)`,
        [
          purchaseOrderId,
          item.productId,
          item.quantityOrdered,
          item.unitPrice,
          item.quantityOrdered * item.unitPrice,
          createdBy,
        ],
      );
    }
  }

  async updateStatus(id, status, updatedBy) {
    const { rows } = await query(
      `UPDATE purchase_orders SET status = $2, updated_at = NOW(), updated_by = $3
       WHERE id = $1 RETURNING *`,
      [id, status, updatedBy],
    );
    return rows[0] || null;
  }

  async receiveItems(purchaseOrderId, items, storeId, updatedBy) {
    // Update each item's quantity_received and update stock + movement
    for (const item of items) {
      const { rows: poiRows } = await query(
        `UPDATE purchase_order_items
         SET quantity_received = quantity_received + $1, updated_at = NOW(), updated_by = $3
         WHERE id = $2 AND purchase_order_id = $4
         RETURNING product_id, quantity_ordered, quantity_received`,
        [
          item.quantityReceived,
          item.purchaseOrderItemId,
          updatedBy,
          purchaseOrderId,
        ],
      );
      if (!poiRows[0]) continue;
      const { product_id, quantity_ordered, quantity_received } = poiRows[0];

      // Add to stock
      await query(
        `INSERT INTO stock (product_id, store_id, quantity, created_by)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (product_id, store_id)
         DO UPDATE SET quantity = stock.quantity + $3, updated_at = NOW(), updated_by = $4`,
        [product_id, storeId, item.quantityReceived, updatedBy],
      );

      // Record movement
      await query(
        `INSERT INTO stock_movements
           (product_id, store_id, movement_type, quantity_change, reference_type, reference_id, note, created_by)
         VALUES ($1,$2,'purchase',$3,'purchase_order',$4,$5,$6)`,
        [
          product_id,
          storeId,
          item.quantityReceived,
          purchaseOrderId,
          `Received against PO`,
          updatedBy,
        ],
      );
    }

    // If all items fully received, mark the PO as received
    const { rows: checkRows } = await query(
      `SELECT COUNT(*) FILTER (WHERE quantity_received < quantity_ordered) AS pending_count
       FROM purchase_order_items WHERE purchase_order_id = $1`,
      [purchaseOrderId],
    );
    if (parseInt(checkRows[0].pending_count, 10) === 0) {
      await this.updateStatus(purchaseOrderId, "received", updatedBy);
    }
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepository();
