const axios = require('axios');

function logFetchError(app, endpoint, { startDate, endDate }, error) {
  const status = error?.response?.status;
  const detail = status ? `HTTP ${status}` : (error?.code || error?.message || 'unknown error');
  console.error(`[CRM:${app}] ${endpoint} failed for ${startDate} - ${endDate}: ${detail}`);
}

async function fetchDoctorCrmReport({ startDate, endDate }) {
  const baseURL = process.env.CRM_DOCTOR_BASE_URL || 'https://drcrm-api.abisibg.com/api';

  const response = await axios.get(`${baseURL}/auth/login-analytics`, {
    params: { startDate, endDate },
    timeout: 30000,
  }).catch((error) => {
    logFetchError('Doctor CRM', 'login-analytics', { startDate, endDate }, error);
    return { error };
  });

  return {
    app: 'Doctor CRM',
    loginStats: response?.error ? null : response?.data,
    error: response?.error || null,
  };
}

module.exports = { fetchDoctorCrmReport };
