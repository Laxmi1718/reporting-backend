const axios = require('axios');

function toLmsDateFormat(dateString) {
  if (!dateString) return dateString;
  const [year, month, day] = String(dateString).split('-');
  if (year && month && day) {
    return `${day}/${month}/${year}`;
  }
  return dateString;
}

async function getUtilizationData({ startDate, endDate }) {
  const baseURL = process.env.LMS_API_BASE_URL;
  const apiKey = process.env.LMS_API_KEY;

  if (!baseURL || !apiKey) {
    const error = new Error('LMS API configuration is missing');
    error.statusCode = 500;
    throw error;
  }

  const response = await axios.get(`${baseURL.replace(/\/$/, '')}/Reports/GetUtilizationData`, {
    params: {
      startDate: toLmsDateFormat(startDate),
      endDate: toLmsDateFormat(endDate),
    },
    headers: {
      ApiKey: apiKey,
    },
    timeout: 15000,
  });

  return response.data;
}

module.exports = {
  getUtilizationData,
};
