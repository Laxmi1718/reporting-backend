const express = require('express');
const { getLmsReport } = require('../controllers/reportController');
const authenticate = require('../middleware/authenticate');
const requireAppAccess = require('../middleware/requireAppAccess');

const router = express.Router();

router.get('/lms', authenticate, requireAppAccess(['lms']), getLmsReport);

module.exports = router;
