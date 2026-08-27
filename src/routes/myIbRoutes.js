const express = require('express');
const { getMyIbReport } = require('../controllers/myIbReportController');
const authenticate = require('../middleware/authenticate');
const requireAppAccess = require('../middleware/requireAppAccess');

const router = express.Router();

router.get('/', authenticate, requireAppAccess(['myib']), getMyIbReport);

module.exports = router;
