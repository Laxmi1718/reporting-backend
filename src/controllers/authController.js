const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { findByEmployeeId } = require('../services/userService');
const { listApplications, getUserApplications } = require('../services/applicationAccessService');

const INVALID_CREDENTIALS_MESSAGE = 'Invalid employee ID or password';

async function login(req, res) {
  const { employeeId, password } = req.body || {};

  if (!employeeId || !password) {
    return res.status(400).json({
      success: false,
      message: 'employeeId and password are required',
    });
  }

  try {
    const user = await findByEmployeeId(employeeId);
    if (!user) {
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS_MESSAGE });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS_MESSAGE });
    }

    // Admin implicitly has every application - the users table's own id (not
    // exposed elsewhere) is only needed here and by the admin/access-control
    // routes, so it's looked up fresh rather than widening findByEmployeeId's
    // existing SELECT.
    const applications = user.role === 'Admin'
      ? await listApplications()
      : await getUserApplications(user.id);

    const token = jwt.sign(
      { id: user.id, employeeId: user.employee_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
    );

    return res.json({
      success: true,
      token,
      employeeId: user.employee_id,
      role: user.role,
      applications,
    });
  } catch (error) {
    console.error('[Auth] Login failed:', error.message);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
}

module.exports = {
  login,
};
