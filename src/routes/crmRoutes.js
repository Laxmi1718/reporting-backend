const express = require('express');
const { getCrmReport } = require('../controllers/crmReportController');

const router = express.Router();

router.get('/', getCrmReport);

module.exports = router;
