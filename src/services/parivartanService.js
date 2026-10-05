const { getWithProxyFallback, postWithProxyFallback } = require('../utils/httpClient');

function logFetchError(app, endpoint, { startDate, endDate }, error) {
  const status = error?.response?.status;
  const detail = status ? `HTTP ${status}` : (error?.code || error?.message || 'unknown error');
  console.error(`[CRM:${app}] ${endpoint} failed for ${startDate} - ${endDate}: ${detail}`);
}

async function fetchParivartanReport({ startDate, endDate }) {
  const baseURL = process.env.CRM_PARIVARTAN_BASE_URL || 'https://crmapi.abisibg.com/api';
  const employeeId = process.env.CRM_PARIVARTAN_EMPLOYEE_ID;
  const employeePassword = process.env.CRM_PARIVARTAN_EMPLOYEE_PASSWORD;

  if (!employeeId || !employeePassword) {
    const error = new Error('Parivartan token credentials are not configured');
    error.code = 'PARIVARTAN_TOKEN_CONFIG_MISSING';
    throw error;
  }

  let tokenResponse;
  try {
    tokenResponse = await postWithProxyFallback(`${baseURL}/v3/token`, {
      EmployeeId: employeeId,
      EmployeePassword: employeePassword,
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
  } catch (error) {
    logFetchError('Parivartan', 'token', { startDate, endDate }, error);
    const tokenError = new Error('Parivartan token request failed');
    tokenError.cause = error;
    throw tokenError;
  }

  const token = tokenResponse?.data?.token;
  if (!token) {
    const error = new Error('Parivartan token response did not contain a token');
    error.code = 'PARIVARTAN_TOKEN_MISSING';
    throw error;
  }

  const authorization = { Authorization: `Bearer ${token}` };

  const [loginHistoryRes, loginStatsRes] = await Promise.all([
    getWithProxyFallback(`${baseURL}/admin/login-history`, {
      // Default page size is ~50 - without a high limit, quarterly/yearly chart
      // aggregation below would silently see only the first page of the range.
      params: { startDate, endDate, limit: 5000 },
      headers: authorization,
      timeout: 30000,
    }).catch((error) => {
      logFetchError('Parivartan', 'login-history', { startDate, endDate }, error);
      return { error };
    }),
    getWithProxyFallback(`${baseURL}/admin/login-stats`, {
      params: { startDate, endDate },
      headers: authorization,
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
