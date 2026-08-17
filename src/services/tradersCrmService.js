const axios = require('axios');

function logFetchError(app, endpoint, { startDate, endDate }, error) {
  const status = error?.response?.status;
  const detail = status ? `HTTP ${status}` : (error?.code || error?.message || 'unknown error');
  console.error(`[CRM:${app}] ${endpoint} failed for ${startDate} - ${endDate}: ${detail}`);
}

async function fetchTradersCrmReport({ startDate, endDate }) {
  const baseURL = process.env.CRM_TRADERS_BASE_URL || 'https://crm-trader-api.abisibg.com/api';

  const response = await axios.get(`${baseURL}/reports/login-history-stats`, {
    params: { startDate, endDate },
    timeout: 30000,
  }).catch((error) => {
    logFetchError('Traders CRM', 'login-history-stats', { startDate, endDate }, error);
    return { error };
  });

  return {
    app: 'Traders CRM',
    loginStats: response?.error ? null : response?.data,
    error: response?.error || null,
  };
}

module.exports = { fetchTradersCrmReport };
