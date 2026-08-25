const express = require('express');
const { getIbremsReport } = require('../controllers/ibremsReportController');

const router = express.Router();

router.get('/', getIbremsReport);

module.exports = router;
