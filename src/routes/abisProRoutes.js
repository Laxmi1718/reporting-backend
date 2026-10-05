const express = require('express');
const { getAbisProReport } = require('../controllers/abisProReportController');
const authenticate = require('../middleware/authenticate');
const requireAppAccess = require('../middleware/requireAppAccess');

const router = express.Router();

router.get('/', authenticate, requireAppAccess(['abispro']), getAbisProReport);

module.exports = router;
