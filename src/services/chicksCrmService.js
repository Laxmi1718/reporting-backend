const { getWithProxyFallback } = require('../utils/httpClient');

function logFetchError(app, endpoint, { startDate, endDate }, error) {
  const status = error?.response?.status;
  const detail = status ? `HTTP ${status}` : (error?.code || error?.message || 'unknown error');
  console.error(`[CRM:${app}] ${endpoint} failed for ${startDate} - ${endDate}: ${detail}`);
}

async function fetchChicksCrmReport({ startDate, endDate }) {
  const baseURL = process.env.CRM_CHICKS_BASE_URL || 'https://chickscrmapi.abisibg.com/api';

  const response = await getWithProxyFallback(`${baseURL}/admin/login-stats`, {
    params: { startDate, endDate },
    timeout: 30000,
  }).catch((error) => {
    logFetchError('Chicks CRM', 'login-stats', { startDate, endDate }, error);
    return { error };
  });

  return {
    app: 'Chicks CRM',
    loginStats: response?.error ? null : response?.data,
    error: response?.error || null,
  };
}

module.exports = { fetchChicksCrmReport };
