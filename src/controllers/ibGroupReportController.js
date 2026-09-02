const { fetchUserMetrics } = require('../services/ibGroupService');

async function getIbGroupReport(req, res) {
  try {
    const data = await fetchUserMetrics();

    if (data && data.status === false) {
      return res.status(502).json({
        success: false,
        message: data.message || 'Failed to load IB Group report',
      });
    }

    return res.json(data);
  } catch (error) {
    const statusCode = error.response?.status || error.statusCode || 500;
    const message = error.response?.data?.message || error.message || 'Failed to load IB Group report';

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
}

module.exports = {
  getIbGroupReport,
};
