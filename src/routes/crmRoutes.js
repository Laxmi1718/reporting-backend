const express = require('express');
const { getCrmReport } = require('../controllers/crmReportController');
const authenticate = require('../middleware/authenticate');
const requireAppAccess = require('../middleware/requireAppAccess');

const router = express.Router();

const CRM_MODULE_KEYS = ['parivartan', 'abis_pro', 'traders', 'chicks', 'doctor'];

router.get('/', authenticate, requireAppAccess(CRM_MODULE_KEYS), getCrmReport);

module.exports = router;
