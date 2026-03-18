export const CustomerModel = {
  table: 'customers',
  publicFields: ['id', 'name', 'email', 'phone', 'address', 'loyalty_points', 'created_at', 'updated_at'],
  insertFields: ['name', 'email', 'phone', 'address'],
  updateFields: ['name', 'email', 'phone', 'address', 'loyalty_points'],
};
