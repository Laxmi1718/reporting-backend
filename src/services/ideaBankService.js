const { postWithProxyFallback } = require('../utils/httpClient');

// Same DD-MM-YYYY convention as GRIM's API.
function toIdeaBankDateFormat(dateString) {
  if (!dateString) return dateString;
  const [year, month, day] = String(dateString).split('-');
  if (year && month && day) {
    return `${day}-${month}-${year}`;
  }
  return dateString;
}

function logFetchError(url, requestBody, error) {
  console.error(`[IdeaBank] utilization-report failed: ${JSON.stringify({
    url,
    body: requestBody,
    code: error?.code || null,
    message: error?.message || null,
    status: error?.response?.status ?? null,
    responseData: error?.response?.data ?? null,
  })}`);
}

async function fetchUtilizationReport({ startDate, endDate }) {
  const baseURL = process.env.IDEABANK_API_BASE_URL;

  if (!baseURL) {
    const error = new Error('IdeaBank API configuration is missing');
    error.statusCode = 500;
    throw error;
  }

  const url = `${baseURL.replace(/\/$/, '')}/dashboard/utilization-report`;
  const requestBody = {
    from: toIdeaBankDateFormat(startDate),
    to: toIdeaBankDateFormat(endDate),
  };

  try {
    const response = await postWithProxyFallback(url, requestBody, { timeout: 30000 });
    return response.data;
  } catch (error) {
    logFetchError(url, requestBody, error);
    throw error;
  }
}

module.exports = { fetchUtilizationReport, toIdeaBankDateFormat };
