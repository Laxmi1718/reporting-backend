const express = require('express');
const { getLmsReport } = require('../controllers/reportController');

const router = express.Router();

router.get('/lms', getLmsReport);

module.exports = router;
