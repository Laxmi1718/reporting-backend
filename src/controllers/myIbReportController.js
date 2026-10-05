const { fetchDashboardStats } = require('../services/myIbService');

// NOTE: only "Week" is confirmed against the real API (from the sample response).
// The rest are best-guess translations of our reportType values and have not been
// verified against the live MyIB API - test each one before relying on it.
const PERIOD_MAP = {
  Daily: 'Day',
  Weekly: 'Week',
  Monthly: 'Month',
  Quarterly: 'Quarter',
  'Half-Yearly': 'HalfYear',
  Yearly: 'Year',
};

async function getMyIbReport(req, res) {
  const { reportUpdateDate, reportType, fromDate, toDate } = req.query;

  if (!reportUpdateDate) {
    return res.status(400).json({
      success: false,
      message: 'reportUpdateDate is required',
    });
  }

  const period = PERIOD_MAP[reportType] || 'Week';

  try {
    const data = await fetchDashboardStats({ reportUpdateDate, period, fromDate, toDate });

    if (data && data.IsSuccess === false) {
      return res.status(502).json({
        success: false,
        message: data.Message || 'Failed to load MyIB report',
      });
    }

    return res.json(data);
  } catch (error) {
    const statusCode = error.response?.status || error.statusCode || 500;
    const message = error.response?.data?.Message || error.message || 'Failed to load MyIB report';
    console.error(`[MyIB] GetDashboardStats failed for ${reportUpdateDate} (${period}): ${message}`);

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
}

module.exports = {
  getMyIbReport,
};
