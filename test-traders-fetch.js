require('dotenv').config();
const axios = require('axios');

const baseURL = process.env.CRM_TRADERS_BASE_URL || 'https://crm-trader-api.abisibg.com/api';
const startDate = '2026-08-10';
const endDate = '2026-08-12';
const url = `${baseURL}/reports/login-history-stats`;

console.log('Resolved baseURL from env:', baseURL);
console.log('Requesting:', url, { startDate, endDate });

axios.get(url, { params: { startDate, endDate }, timeout: 30000 })
  .then((res) => {
    console.log('SUCCESS - status:', res.status);
    console.log('totalCalls:', res.data?.data?.summary?.callStats?.totalCalls);
  })
  .catch((error) => {
    console.log('FAILED');
    console.log('code:', error.code);
    console.log('message:', error.message);
    console.log('response status:', error.response?.status);
    console.log('response data:', JSON.stringify(error.response?.data)?.slice(0, 500));
  });
