const axios = require('axios');

function logFetchError(endpoint, { startDate, endDate }, error) {
  const status = error?.response?.status;
  const detail = status ? `HTTP ${status}` : (error?.code || error?.message || 'unknown error');
  console.error(`[IBREMS] ${endpoint} failed for ${startDate} - ${endDate}: ${detail}`);
}

async function getLogsSummary({ startDate, endDate }) {
  const baseURL = process.env.IBREMS_API_BASE_URL;
  const apiKey = process.env.IBREMS_API_KEY;

  if (!baseURL || !apiKey) {
    const error = new Error('IBREMS API configuration is missing');
    error.statusCode = 500;
    throw error;
  }

  try {
    const response = await axios.get(`${baseURL.replace(/\/$/, '')}/logs/summary`, {
      params: { from: startDate, to: endDate },
      headers: { 'x-api-key': apiKey },
      timeout: 15000,
    });

    return response.data;
  } catch (error) {
    logFetchError('logs/summary', { startDate, endDate }, error);
    throw error;
  }
}

module.exports = { getLogsSummary };
