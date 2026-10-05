const axios = require('axios');
const { persistMyIbReport } = require('./myIbPersistenceService');

function toMyIbDateFormat(dateString) {
  if (!dateString) return dateString;
  const [year, month, day] = String(dateString).split('-');
  if (year && month && day) {
    return `${day}-${month}-${year}`;
  }
  return dateString;
}

function toMyIbRangeDateFormat(dateString) {
  if (!dateString) return dateString;
  const [year, month, day] = String(dateString).split('-');
  if (year && month && day) {
    return `${day}:${month}:${year}`;
  }
  return dateString;
}

async function fetchDashboardStats({ reportUpdateDate, period, fromDate, toDate }) {
  const baseURL = process.env.MYIB_BASE_URL;
  const apiKey = process.env.MYIB_API_KEY;

  if (!baseURL || !apiKey) {
    const error = new Error('MyIB API configuration is missing');
    error.statusCode = 500;
    throw error;
  }

  const response = await axios.post(
    `${baseURL.replace(/\/$/, '')}/v2/Mobile/Support/GetDashboardStats`,
    {
      from: toMyIbRangeDateFormat(fromDate || reportUpdateDate),
      to: toMyIbRangeDateFormat(toDate || reportUpdateDate),
    },
    {
      params: {
        ReportUpdateDate: toMyIbDateFormat(reportUpdateDate),
        Period: period,
      },
      headers: { 'x-api-key': apiKey },
      timeout: 30000,
    },
  );

  try {
    await persistMyIbReport(response.data, { reportUpdateDate, period });
  } catch (error) {
    console.error(`[DB persistence] Failed to save MyIB report: ${error.message}`);
  }

  return response.data;
}

module.exports = { fetchDashboardStats, toMyIbDateFormat, toMyIbRangeDateFormat };
