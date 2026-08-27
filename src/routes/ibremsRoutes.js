const express = require('express');
const { getIbremsReport } = require('../controllers/ibremsReportController');
const authenticate = require('../middleware/authenticate');
const requireAppAccess = require('../middleware/requireAppAccess');

const router = express.Router();

router.get('/', authenticate, requireAppAccess(['ibrems']), getIbremsReport);

module.exports = router;
