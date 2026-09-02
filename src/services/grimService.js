const axios = require('axios');
const https = require('https');

const REQUEST_TIMEOUT_MS = 30000;


const grimHttpsAgent = new https.Agent({
  checkServerIdentity: () => undefined,
});

function toGrimDateFormat(dateString) {
  if (!dateString) return dateString;
  const [year, month, day] = String(dateString).split('-');
  if (year && month && day) {
    return `${day}-${month}-${year}`;
  }
  return dateString;
}

function logFetchError(url, requestBody, error) {
  console.error(`[GRIM] app_usage_stats failed: ${JSON.stringify({
    url,
    body: requestBody,
    code: error?.code || null,
    message: error?.message || null,
    status: error?.response?.status ?? null,
    responseData: error?.response?.data ?? null,
  })}`);
}

async function fetchAppUsageStats({ startDate, endDate }) {
  const baseURL = process.env.GRIM_API_BASE_URL;

  if (!baseURL) {
    const error = new Error('GRIM API configuration is missing');
    error.statusCode = 500;
    throw error;
  }

  const url = `${baseURL.replace(/\/$/, '')}/api/v4/admin/app_usage_stats`;
  const requestBody = {
    from: toGrimDateFormat(startDate),
    to: toGrimDateFormat(endDate),
  };

  try {
    const response = await axios.post(url, requestBody, {
      timeout: REQUEST_TIMEOUT_MS,
      httpsAgent: grimHttpsAgent,
    });

    return response.data;
  } catch (error) {
    logFetchError(url, requestBody, error);
    throw error;
  }
}

module.exports = { fetchAppUsageStats, toGrimDateFormat };
