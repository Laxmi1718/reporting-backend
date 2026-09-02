const axios = require('axios');

// The real API doesn't take a date range - it always returns its own rolling
// windows (last 30 days, last 12 weeks/months) computed server-side. No
// startDate/endDate params are sent, matching the verified Postman request.
async function fetchUserMetrics() {
  const baseURL = process.env.IBGROUP_API_BASE_URL;
  const apiKey = process.env.IBGROUP_API_KEY;

  if (!baseURL || !apiKey) {
    const error = new Error('IB Group API configuration is missing');
    error.statusCode = 500;
    throw error;
  }

  try {
    const response = await axios.get(`${baseURL.replace(/\/$/, '')}/api/dashboard/user-metrics`, {
      headers: { 'x-api-key': apiKey },
      timeout: 15000,
    });

    return response.data;
  } catch (error) {
    const status = error?.response?.status;
    const detail = status ? `HTTP ${status}` : (error?.code || error?.message || 'unknown error');
    console.error(`[IB Group] user-metrics failed: ${detail}`);
    throw error;
  }
}

module.exports = { fetchUserMetrics };
