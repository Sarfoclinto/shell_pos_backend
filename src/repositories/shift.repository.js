import { BaseRepository } from "./base.repository.js";
import { query } from "../config/database.js";

class ShiftRepository extends BaseRepository {
  constructor() {
    super("shifts");
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  /**
   * Check whether a user already has an open shift at a given store.
   */
  async findOpenShift(userId, storeId) {
    const { rows } = await query(
      `SELECT id, store_id, opening_float, opened_at
       FROM shifts
       WHERE user_id  = $1
         AND store_id = $2
         AND status   = 'open'
       LIMIT 1`,
      [userId, storeId],
    );
    return rows[0] || null;
  }

  /**
   * Single shift with full joins — user name, store name, and sales summary.
   */
  async findByIdWithSummary(id) {
    const { rows } = await query(
      `SELECT
         sh.*,
         u.first_name,
         u.last_name,
         s.name   AS store_name,
         s.code   AS store_code,

         -- Sales counts
         COUNT(sa.id)                                          AS total_transactions,
         COUNT(sa.id) FILTER (WHERE sa.status = 'completed')  AS completed_transactions,
         COUNT(sa.id) FILTER (WHERE sa.status = 'cancelled')  AS cancelled_transactions,

         -- Revenue figures
         COALESCE(SUM(sa.final_amount)
           FILTER (WHERE sa.status = 'completed'), 0)         AS total_revenue,
         COALESCE(SUM(sa.discount_amount)
           FILTER (WHERE sa.status = 'completed'), 0)         AS total_discounts,
         COALESCE(SUM(sa.tax_amount)
           FILTER (WHERE sa.status = 'completed'), 0)         AS total_tax,

         -- Payment method breakdown
         COALESCE(SUM(p.amount)
           FILTER (WHERE p.payment_method = 'cash'
             AND p.payment_status = 'paid'), 0)               AS cash_collected,
         COALESCE(SUM(p.amount)
           FILTER (WHERE p.payment_method = 'card'
             AND p.payment_status = 'paid'), 0)               AS card_collected,
         COALESCE(SUM(p.amount)
           FILTER (WHERE p.payment_method = 'mobile_money'
             AND p.payment_status = 'paid'), 0)               AS mobile_money_collected,
         COALESCE(SUM(p.amount)
           FILTER (WHERE p.payment_method = 'split'
             AND p.payment_status = 'paid'), 0)               AS split_collected,
         COALESCE(SUM(p.amount)
           FILTER (WHERE p.payment_method = 'other'
             AND p.payment_status = 'paid'), 0)               AS other_collected

       FROM shifts sh
       INNER JOIN users  u  ON u.id  = sh.user_id
       INNER JOIN stores s  ON s.id  = sh.store_id
       LEFT  JOIN sales  sa ON sa.shift_id = sh.id
       LEFT  JOIN payments p ON p.sale_id = sa.id

       WHERE sh.id = $1
       GROUP BY sh.id, u.first_name, u.last_name, s.name, s.code`,
      [id],
    );
    return rows[0] || null;
  }

  /**
   * Paginated list with optional filters.
   */
  async findAll({ storeId, userId, status, from, to, limit, offset }) {
    const conditions = [];
    const values = [];
    let i = 1;

    if (storeId) {
      conditions.push(`sh.store_id = $${i++}`);
      values.push(storeId);
    }
    if (userId) {
      conditions.push(`sh.user_id  = $${i++}`);
      values.push(userId);
    }
    if (status) {
      conditions.push(`sh.status   = $${i++}`);
      values.push(status);
    }
    if (from) {
      conditions.push(`sh.opened_at >= $${i++}`);
      values.push(from);
    }
    if (to) {
      conditions.push(`sh.opened_at <= $${i++}`);
      values.push(to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM shifts sh ${where}`,
      values,
    );
    const total = parseInt(countRows[0].count, 10);

    const { rows } = await query(
      `SELECT
         sh.id, sh.status, sh.opened_at, sh.closed_at,
         sh.opening_float, sh.closing_cash, sh.expected_cash, sh.difference,
         sh.created_at,
         u.id         AS user_id,
         u.first_name,
         u.last_name,
         s.id         AS store_id,
         s.name       AS store_name,
         s.code       AS store_code,
         COUNT(sa.id) FILTER (WHERE sa.status = 'completed') AS completed_transactions,
         COALESCE(SUM(sa.final_amount)
           FILTER (WHERE sa.status = 'completed'), 0)        AS total_revenue
       FROM shifts sh
       INNER JOIN users  u  ON u.id = sh.user_id
       INNER JOIN stores s  ON s.id = sh.store_id
       LEFT  JOIN sales  sa ON sa.shift_id = sh.id
       ${where}
       GROUP BY sh.id, u.id, u.first_name, u.last_name, s.id, s.name, s.code
       ORDER BY sh.opened_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset],
    );

    return { rows, total };
  }

  // ── Write ───────────────────────────────────────────────────────────────────

  async openShift(userId, storeId, openingFloat, createdBy, openedAt) {
    // if openedAt, check if shift exist already for that date
    // if yes, update status to true and return as currently open
    if (openedAt) {
      const { rows } = await query(
        `SELECT * FROM shifts WHERE user_id = $1 AND store_id = $2 AND DATE(opened_at) = $3`,
        [userId, storeId, openedAt],
      );
      if (rows.length > 0) {
        // update status to true
        const { rows } = await query(
          `UPDATE 
            shifts 
            SET status = 'open', updated_at = NOW(), updated_by = $1 
            WHERE user_id = $1 AND store_id = $2 AND DATE(opened_at) = $3 
            RETURNING *`,
          [userId, storeId, openedAt],
        );
        return rows[0];
      }
    }
    const { rows } = await query(
      `INSERT INTO shifts (user_id, store_id, opening_float, status, created_by, opened_at)
    VALUES ($1, $2, $3, 'open', $4, COALESCE($5, NOW()))
    RETURNING *`,
      [userId, storeId, openingFloat, createdBy, openedAt],
    );
    return rows[0];
  }

  /**
   * Compute expected cash from completed cash sales in this shift,
   * then close the shift.
   */
  async closeShift(id, closingCash, updatedBy, notes) {
    // Calculate expected cash:
    // opening_float + all cash payments on completed sales in this shift
    const { rows: calcRows } = await query(
      `SELECT
         sh.opening_float,
         COALESCE(SUM(p.amount)
           FILTER (WHERE p.payment_method = 'cash'
             AND p.payment_status = 'paid'), 0) AS cash_sales
       FROM shifts sh
       LEFT JOIN sales    sa ON sa.shift_id = sh.id AND sa.status = 'completed'
       LEFT JOIN payments p  ON p.sale_id   = sa.id
       WHERE sh.id = $1
       GROUP BY sh.id`,
      [id],
    );

    const { opening_float, cash_sales } = calcRows[0];
    const expectedCash = parseFloat(opening_float) + parseFloat(cash_sales);
    const difference = parseFloat(closingCash) - expectedCash;

    const { rows } = await query(
      `UPDATE shifts
       SET status        = 'closed',
           closed_at     = NOW(),
           closing_cash  = $2,
           expected_cash = $3,
           difference    = $4,
           updated_at    = NOW(),
           updated_by    = $5,
           notes         = $6
       WHERE id = $1
       RETURNING *`,
      [id, closingCash, expectedCash, difference, updatedBy, notes],
    );
    return rows[0];
  }

  /**
   * admin close shift
   */
  async adminCloseShift(id, closingCash, updatedBy, notes) {
    // Calculate expected cash:
    // opening_float + all cash payments on completed sales in this shift
    const { rows: calcRows } = await query(
      `SELECT
         sh.opening_float,
         COALESCE(SUM(p.amount)
           FILTER (WHERE p.payment_method = 'cash'
             AND p.payment_status = 'paid'), 0) AS cash_sales
       FROM shifts sh
       LEFT JOIN sales    sa ON sa.shift_id = sh.id AND sa.status = 'completed'
       LEFT JOIN payments p  ON p.sale_id   = sa.id
       WHERE sh.id = $1
       GROUP BY sh.id`,
      [id],
    );

    const { opening_float, cash_sales } = calcRows[0];
    const expectedCash = parseFloat(opening_float) + parseFloat(cash_sales);
    const difference = parseFloat(closingCash) - expectedCash;

    const { rows } = await query(
      `UPDATE shifts
       SET status        = 'closed',
           closed_at     = NOW(),
           closing_cash  = $2,
           expected_cash = $3,
           difference    = $4,
           updated_at    = NOW(),
           updated_by    = $5,
           notes         = $6
       WHERE id = $1
       RETURNING *`,
      [id, closingCash, expectedCash, difference, updatedBy, notes],
    );
    return rows[0];
  }
}

export const shiftRepository = new ShiftRepository();
