const axios = require('axios');

function toMyIbDateFormat(dateString) {
  if (!dateString) return dateString;
  const [year, month, day] = String(dateString).split('-');
  if (year && month && day) {
    return `${day}-${month}-${year}`;
  }
  return dateString;
}

async function fetchDashboardStats({ reportUpdateDate, period }) {
  const baseURL = process.env.MYIB_BASE_URL;
  const apiKey = process.env.MYIB_API_KEY;

  if (!baseURL || !apiKey) {
    const error = new Error('MyIB API configuration is missing');
    error.statusCode = 500;
    throw error;
  }

  const response = await axios.post(
    `${baseURL.replace(/\/$/, '')}/v2/Mobile/Support/GetDashboardStats`,
    null,
    {
      params: {
        ReportUpdateDate: toMyIbDateFormat(reportUpdateDate),
        Period: period,
      },
      headers: { 'x-api-key': apiKey },
      timeout: 30000,
    },
  );

  return response.data;
}

module.exports = { fetchDashboardStats, toMyIbDateFormat };
