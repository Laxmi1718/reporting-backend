const express = require('express');
const { getMyIbReport } = require('../controllers/myIbReportController');

const router = express.Router();

router.get('/', getMyIbReport);

module.exports = router;
