const { fetchAbisProAnalytics } = require('../services/abisProService');

async function getAbisProReport(req, res) {
  const { month, year, fromDate, toDate, startDate, endDate, start_date, end_date } = req.query;

  const effectiveFromDate = startDate || fromDate || start_date || null;
  const effectiveToDate = endDate || toDate || end_date || null;

  if (!(effectiveFromDate && effectiveToDate) && (!month || !year)) {
    return res.status(400).json({
      success: false,
      message: 'start_date and end_date or month and year are required',
    });
  }

  try {
    const data = await fetchAbisProAnalytics({
      month,
      year,
      fromDate: effectiveFromDate,
      toDate: effectiveToDate,
      startDate: effectiveFromDate,
      endDate: effectiveToDate,
    });

    if (data && data.success === false) {
      return res.status(502).json({
        success: false,
        message: data.message || 'Failed to load ABIS Pro report',
      });
    }

    return res.json(data);
  } catch (error) {
    const statusCode = error.response?.status || error.statusCode || 500;
    const message = error.response?.data?.message || error.message || 'Failed to load ABIS Pro report';

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
}

module.exports = {
  getAbisProReport,
};
