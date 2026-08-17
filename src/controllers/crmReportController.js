const { fetchCrmOverallReport } = require('../services/crmAggregatorService');

async function getCrmReport(req, res) {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'startDate and endDate are required',
    });
  }

  try {
    const result = await fetchCrmOverallReport({ startDate, endDate });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load CRM report',
      apps: [],
    });
  }
}

module.exports = { getCrmReport };
