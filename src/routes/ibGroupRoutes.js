const express = require('express');
const { getIbGroupReport } = require('../controllers/ibGroupReportController');
const authenticate = require('../middleware/authenticate');
const requireAppAccess = require('../middleware/requireAppAccess');

const router = express.Router();

router.get('/', authenticate, requireAppAccess(['ib_group']), getIbGroupReport);

module.exports = router;
