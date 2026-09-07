const express = require('express');
const { getAioReport } = require('../controllers/aioReportController');
const authenticate = require('../middleware/authenticate');
const requireAppAccess = require('../middleware/requireAppAccess');

const router = express.Router();

router.get('/', authenticate, requireAppAccess(['aio']), getAioReport);

module.exports = router;
