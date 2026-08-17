const axios = require('axios');

function logFetchError(app, endpoint, { startDate, endDate }, error) {
  const status = error?.response?.status;
  const detail = status ? `HTTP ${status}` : (error?.code || error?.message || 'unknown error');
  console.error(`[CRM:${app}] ${endpoint} failed for ${startDate} - ${endDate}: ${detail}`);
}

async function fetchParivartanReport({ startDate, endDate }) {
  const baseURL = process.env.CRM_PARIVARTAN_BASE_URL || 'https://crmapi.abisibg.com/api';

  const [loginHistoryRes, loginStatsRes] = await Promise.all([
    axios.get(`${baseURL}/admin/login-history`, {
      params: { startDate, endDate },
      timeout: 30000,
    }).catch((error) => {
      logFetchError('Parivartan', 'login-history', { startDate, endDate }, error);
      return { error };
    }),
    axios.get(`${baseURL}/admin/login-stats`, {
      params: { startDate, endDate },
      timeout: 30000,
    }).catch((error) => {
      logFetchError('Parivartan', 'login-stats', { startDate, endDate }, error);
      return { error };
    }),
  ]);

  return {
    app: 'Parivartan',
    loginHistory: loginHistoryRes?.error ? null : loginHistoryRes?.data,
    loginStats: loginStatsRes?.error ? null : loginStatsRes?.data,
    error: loginHistoryRes?.error || loginStatsRes?.error || null,
  };
}

module.exports = { fetchParivartanReport };
