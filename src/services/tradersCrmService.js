const { getWithProxyFallback } = require('../utils/httpClient');

function logFetchError(app, endpoint, { startDate, endDate }, error) {
  const status = error?.response?.status;
  const detail = status ? `HTTP ${status}` : (error?.code || error?.message || 'unknown error');
  console.error(`[CRM:${app}] ${endpoint} failed for ${startDate} - ${endDate}: ${detail}`);
}

async function fetchTradersCrmReport({ startDate, endDate }) {
  const baseURL = process.env.CRM_TRADERS_BASE_URL || 'https://crm-trader-api.abisibg.com/api';

  const response = await getWithProxyFallback(`${baseURL}/reports/login-history-stats`, {
    // Default page size is small - without a high limit, quarterly/yearly chart
    // aggregation below would silently see only the first page of recentLogins.
    params: { startDate, endDate, limit: 5000 },
    // This upstream measured 17-30s+ just to respond directly; combined with the
    // 6s direct-attempt this fallback always burns first, the standard 30s budget
    // used by the other CRM modules leaves almost no margin and times out
    // intermittently (surfacing as "Could not fetch live data" on the dashboard).
    timeout: 45000,
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
