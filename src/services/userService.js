const pool = require('../config/database');

async function findByEmployeeId(employeeId) {
  const [rows] = await pool.query(
    'SELECT id, employee_id, password_hash, role FROM users WHERE employee_id = ? LIMIT 1',
    [employeeId],
  );
  return rows[0] || null;
}

module.exports = {
  findByEmployeeId,
};
