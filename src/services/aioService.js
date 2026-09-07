const axios = require('axios');

// Same DD-MM-YYYY convention as GRIM's API.
function toAioDateFormat(dateString) {
  if (!dateString) return dateString;
  const [year, month, day] = String(dateString).split('-');
  if (year && month && day) {
    return `${day}-${month}-${year}`;
  }
  return dateString;
}

async function fetchUtilizationDashboard({ startDate, endDate }) {
  const baseURL = process.env.AIO_API_BASE_URL;
  const username = process.env.AIO_API_USERNAME;
  const password = process.env.AIO_API_PASSWORD;

  if (!baseURL || !username || !password) {
    const error = new Error('AIO API configuration is missing');
    error.statusCode = 500;
    throw error;
  }

  const url = `${baseURL.replace(/\/$/, '')}/api/v1/Utilization/Dashboard`;

  try {
    const response = await axios.get(url, {
      params: {
        FromDate: toAioDateFormat(startDate),
        ToDate: toAioDateFormat(endDate),
      },
      auth: { username, password },
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    const status = error?.response?.status;
    const detail = status ? `HTTP ${status}` : (error?.code || error?.message || 'unknown error');
    console.error(`[AIO] Utilization/Dashboard failed: ${detail}`);
    throw error;
  }
}

module.exports = { fetchUtilizationDashboard, toAioDateFormat };
