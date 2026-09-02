const express = require('express');
const { getGrimReport } = require('../controllers/grimReportController');
const authenticate = require('../middleware/authenticate');
const requireAppAccess = require('../middleware/requireAppAccess');

const router = express.Router();

router.get('/', authenticate, requireAppAccess(['grim']), getGrimReport);

module.exports = router;
