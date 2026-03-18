import bcrypt from "bcryptjs";
import { logger } from "../../utils/logger.js";

export const seedUsers = async (query) => {
  logger.info("  → Seeding roles...");

  // ── Roles ──────────────────────────────────────────────────────────────────
  await query(`
    INSERT INTO roles (name, dashboard_type) VALUES
      ('Admin',   'admin'),
      ('Manager', 'admin'),
      ('Cashier', 'cashier')
    ON CONFLICT (name) DO NOTHING
  `);

  // ── Controls ───────────────────────────────────────────────────────────────
  logger.info("  → Seeding controls...");

  await query(`
    INSERT INTO controls (code, name) VALUES
      ('dashboard.view',          'View Dashboard'),
      ('users.view',              'View Users'),
      ('users.create',            'Create Users'),
      ('users.update',            'Update Users'),
      ('users.delete',            'Delete Users'),
      ('stores.view',             'View Stores'),
      ('stores.manage',           'Manage Stores'),
      ('products.view',           'View Products'),
      ('products.create',         'Create Products'),
      ('products.update',         'Update Products'),
      ('products.delete',         'Delete Products'),
      ('categories.manage',       'Manage Categories'),
      ('stock.view',              'View Stock'),
      ('stock.adjust',            'Adjust Stock'),
      ('stock.transfer',          'Transfer Stock'),
      ('sales.view',              'View Sales'),
      ('sales.create',            'Create Sales'),
      ('sales.cancel',            'Cancel Sales'),
      ('sales.return',            'Process Returns'),
      ('payments.view',           'View Payments'),
      ('customers.view',          'View Customers'),
      ('customers.manage',        'Manage Customers'),
      ('suppliers.view',          'View Suppliers'),
      ('suppliers.manage',        'Manage Suppliers'),
      ('purchase_orders.view',    'View Purchase Orders'),
      ('purchase_orders.manage',  'Manage Purchase Orders'),
      ('shifts.manage',           'Manage Shifts'),
      ('reports.view',            'View Reports'),
      ('reports.export',          'Export Reports')
    ON CONFLICT (code) DO NOTHING
  `);

  // ── Role → Control mappings ────────────────────────────────────────────────
  logger.info("  → Assigning controls to roles...");

  // Admin gets everything
  await query(`
    INSERT INTO role_control_mapping (role_id, control_id)
    SELECT r.id, c.id
    FROM roles r, controls c
    WHERE r.name = 'Admin'
    ON CONFLICT (role_id, control_id) DO NOTHING
  `);

  // Manager gets everything except user delete and store management
  await query(`
    INSERT INTO role_control_mapping (role_id, control_id)
    SELECT r.id, c.id
    FROM roles r, controls c
    WHERE r.name = 'Manager'
      AND c.code NOT IN ('users.delete', 'stores.manage')
    ON CONFLICT (role_id, control_id) DO NOTHING
  `);

  // Cashier gets a limited set
  await query(`
    INSERT INTO role_control_mapping (role_id, control_id)
    SELECT r.id, c.id
    FROM roles r, controls c
    WHERE r.name = 'Cashier'
      AND c.code IN (
        'dashboard.view',
        'products.view',
        'stock.view',
        'sales.view',
        'sales.create',
        'customers.view',
        'customers.manage',
        'payments.view',
        'shifts.manage'
      )
    ON CONFLICT (role_id, control_id) DO NOTHING
  `);

  // ── Seed store ─────────────────────────────────────────────────────────────
  logger.info("  → Seeding default store...");

  await query(`
    INSERT INTO stores (code, name, address, region, city, contact)
    VALUES ('HQ', 'Head Office', '1 Main Street', 'Greater Accra', 'Accra', '+233200000000')
    ON CONFLICT (code) DO NOTHING
  `);

  // ── Seed admin user ────────────────────────────────────────────────────────
  logger.info("  → Seeding admin user...");

  const adminHash = await bcrypt.hash("Admin@1234", 12);
  const cashierHash = await bcrypt.hash("Cashier@1234", 12);

  await query(
    `
    INSERT INTO users (first_name, last_name, phone, email, password_hash, role_id, store_id)
    SELECT
      'Super', 'Admin', '+233200000001', 'admin@pos.com', $1,
      (SELECT id FROM roles WHERE name = 'Admin'),
      (SELECT id FROM stores WHERE code = 'HQ')
    ON CONFLICT (phone) DO NOTHING
  `,
    [adminHash],
  );

  await query(
    `
    INSERT INTO users (first_name, last_name, phone, email, password_hash, role_id, store_id)
    SELECT
      'Test', 'Cashier', '+233200000002', 'cashier@pos.com', $1,
      (SELECT id FROM roles WHERE name = 'Cashier'),
      (SELECT id FROM stores WHERE code = 'HQ')
    ON CONFLICT (phone) DO NOTHING
  `,
    [cashierHash],
  );

  logger.info("  ✅ Roles, controls, store, and users seeded.");
  logger.info("     Admin:   admin@pos.com   / Admin@1234");
  logger.info("     Cashier: cashier@pos.com / Cashier@1234");
};
