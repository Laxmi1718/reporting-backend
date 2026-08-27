const { getWithProxyFallback } = require('../utils/httpClient');

function logFetchError(app, endpoint, { startDate, endDate }, error) {
  const status = error?.response?.status;
  const detail = status ? `HTTP ${status}` : (error?.code || error?.message || 'unknown error');
  console.error(`[CRM:${app}] ${endpoint} failed for ${startDate} - ${endDate}: ${detail}`);
}

async function fetchAbisProCrmReport({ startDate, endDate }) {
  const baseURL = process.env.CRM_ABIS_PRO_BASE_URL || 'https://crm.abispro.api.abisibg.com/api';

  const [loginStatsRes, loginHistoryRes] = await Promise.all([
    getWithProxyFallback(`${baseURL}/reports/login-analytics`, {
      params: { startDate, endDate },
      timeout: 30000,
    }).catch((error) => {
      logFetchError('Abis Pro (CRM)', 'login-analytics', { startDate, endDate }, error);
      return { error };
    }),
    getWithProxyFallback(`${baseURL.replace('/api', '')}/api/reports/login-history`, {
      // Default page size is small - without a high limit, quarterly/yearly chart
      // aggregation below would silently see only the first page of the range.
      params: { startDate, endDate, limit: 5000 },
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
