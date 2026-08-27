const {
  listApplications,
  listUsers,
  findUserById,
  getUserApplications,
  grantAccess,
  revokeAccess,
} = require('../services/applicationAccessService');

async function getUsers(req, res) {
  try {
    const users = await listUsers();
    return res.json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load users' });
  }
}

async function getApplications(req, res) {
  try {
    const applications = await listApplications();
    return res.json({ success: true, applications });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load applications' });
  }
}

async function getUserApplicationAccess(req, res) {
  const userId = Number(req.params.userId);

  try {
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const applications = await getUserApplications(userId);
    return res.json({ success: true, applications });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load user application access' });
  }
}

async function assignApplications(req, res) {
  const userId = Number(req.params.userId);
  const { applicationIds } = req.body || {};

  if (!Array.isArray(applicationIds) || applicationIds.some((id) => !Number.isInteger(id))) {
    return res.status(400).json({ success: false, message: 'applicationIds must be an array of integers' });
  }

  try {
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await grantAccess(userId, applicationIds);
    const applications = await getUserApplications(userId);
    return res.json({ success: true, applications });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to assign applications' });
  }
}

async function removeApplication(req, res) {
  const userId = Number(req.params.userId);
  const applicationId = Number(req.params.applicationId);

  try {
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await revokeAccess(userId, applicationId);
    const applications = await getUserApplications(userId);
    return res.json({ success: true, applications });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to remove application access' });
  }
}

module.exports = {
  getUsers,
  getApplications,
  getUserApplicationAccess,
  assignApplications,
  removeApplication,
};
