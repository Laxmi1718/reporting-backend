const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');
const {
  getUsers,
  getApplications,
  getUserApplicationAccess,
  assignApplications,
  removeApplication,
} = require('../controllers/adminController');

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('/users', getUsers);
router.get('/applications', getApplications);
router.get('/users/:userId/applications', getUserApplicationAccess);
router.post('/users/:userId/applications', assignApplications);
router.delete('/users/:userId/applications/:applicationId', removeApplication);

module.exports = router;
