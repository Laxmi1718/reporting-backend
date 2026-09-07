const express = require('express');
const { getIdeaBankReport } = require('../controllers/ideaBankReportController');
const authenticate = require('../middleware/authenticate');
const requireAppAccess = require('../middleware/requireAppAccess');

const router = express.Router();

router.get('/', authenticate, requireAppAccess(['ideabank']), getIdeaBankReport);

module.exports = router;
