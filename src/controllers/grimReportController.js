const { fetchAppUsageStats } = require('../services/grimService');

async function getGrimReport(req, res) {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'startDate and endDate are required',
    });
  }

  try {
    const data = await fetchAppUsageStats({ startDate, endDate });

    if (data && data.success === false) {
      return res.status(502).json({
        success: false,
        message: data.message || 'Failed to load GRIM report',
      });
    }

    return res.json(data);
  } catch (error) {
    const statusCode = error.response?.status || error.statusCode || 500;
    const message = error.response?.data?.message || error.message || 'Failed to load GRIM report';

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
}

module.exports = {
  getGrimReport,
};
