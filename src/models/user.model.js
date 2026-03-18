/**
 * User model — defines the shape of a user record and safe columns.
 * Not an ORM model; used by the repository to whitelist fields.
 */
export const UserModel = {
  table: 'users',

  // Columns safe to return to the client (never include password_hash)
  publicFields: ['id', 'name', 'email', 'role', 'is_active', 'last_login_at', 'created_at', 'updated_at'],

  // Columns allowed on INSERT
  insertFields: ['name', 'email', 'password_hash', 'role', 'is_active'],

  // Columns allowed on UPDATE
  updateFields: ['name', 'email', 'role', 'is_active'],

  roles: Object.freeze({
    ADMIN: 'admin',
    MANAGER: 'manager',
    CASHIER: 'cashier',
  }),
};
