const pool = require('../config/database');

async function listApplications() {
  const [rows] = await pool.query(
    'SELECT id, app_family, module_key, module_name FROM report_applications ORDER BY id',
  );
  return rows;
}

async function listUsers() {
  const [rows] = await pool.query(
    'SELECT id, employee_id, role, created_at FROM users ORDER BY id',
  );
  return rows;
}

async function findUserById(userId) {
  const [rows] = await pool.query(
    'SELECT id, employee_id, role FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  return rows[0] || null;
}

async function getUserApplications(userId) {
  const [rows] = await pool.query(
    `SELECT ra.id, ra.app_family, ra.module_key, ra.module_name
     FROM user_application_access uaa
     JOIN report_applications ra ON ra.id = uaa.application_id
     WHERE uaa.user_id = ?
     ORDER BY ra.id`,
    [userId],
  );
  return rows;
}

async function getUserModuleKeys(userId) {
  const apps = await getUserApplications(userId);
  return apps.map((app) => app.module_key);
}

async function grantAccess(userId, applicationIds) {
  if (!Array.isArray(applicationIds) || applicationIds.length === 0) return;

  const values = applicationIds.map((applicationId) => [userId, applicationId]);
  await pool.query(
    'INSERT IGNORE INTO user_application_access (user_id, application_id) VALUES ?',
    [values],
  );
}

async function revokeAccess(userId, applicationId) {
  const [result] = await pool.query(
    'DELETE FROM user_application_access WHERE user_id = ? AND application_id = ?',
    [userId, applicationId],
  );
  return result.affectedRows > 0;
}

async function hasAnyModuleAccess(userId, moduleKeys) {
  if (!Array.isArray(moduleKeys) || moduleKeys.length === 0) return false;

  const [rows] = await pool.query(
    `SELECT 1
     FROM user_application_access uaa
     JOIN report_applications ra ON ra.id = uaa.application_id
     WHERE uaa.user_id = ? AND ra.module_key IN (?)
     LIMIT 1`,
    [userId, moduleKeys],
  );
  return rows.length > 0;
}

module.exports = {
  listApplications,
  listUsers,
  findUserById,
  getUserApplications,
  getUserModuleKeys,
  grantAccess,
  revokeAccess,
  hasAnyModuleAccess,
};
