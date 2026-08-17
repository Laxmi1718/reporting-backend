const axios = require('axios');

function logFetchError(app, endpoint, { startDate, endDate }, error) {
  const status = error?.response?.status;
  const detail = status ? `HTTP ${status}` : (error?.code || error?.message || 'unknown error');
  console.error(`[CRM:${app}] ${endpoint} failed for ${startDate} - ${endDate}: ${detail}`);
}

async function fetchAbisProCrmReport({ startDate, endDate }) {
  const baseURL = process.env.CRM_ABIS_PRO_BASE_URL || 'https://crm.abispro.api.abisibg.com/api';

  const [loginStatsRes, loginHistoryRes] = await Promise.all([
    axios.get(`${baseURL}/reports/login-analytics`, {
      params: { startDate, endDate },
      timeout: 30000,
    }).catch((error) => {
      logFetchError('Abis Pro (CRM)', 'login-analytics', { startDate, endDate }, error);
      return { error };
    }),
    axios.get(`${baseURL.replace('/api', '')}/api/reports/login-history`, {
      params: { startDate, endDate },
      timeout: 30000,
    }).catch((error) => {
      logFetchError('Abis Pro (CRM)', 'login-history', { startDate, endDate }, error);
      return { error };
    }),
  ]);

  return {
    app: 'Abis Pro (CRM)',
    loginStats: loginStatsRes?.error ? null : loginStatsRes?.data,
    loginHistory: loginHistoryRes?.error ? null : loginHistoryRes?.data,
    error: loginStatsRes?.error || loginHistoryRes?.error || null,
  };
}

module.exports = { fetchAbisProCrmReport };
