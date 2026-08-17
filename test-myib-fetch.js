require('dotenv').config();
const { fetchDashboardStats } = require('./src/services/myIbService');

const reportUpdateDate = '2026-08-12'; // YYYY-MM-DD, same as the dashboard sends
const period = 'Week';

console.log('Resolved MYIB_BASE_URL:', process.env.MYIB_BASE_URL);
console.log('Requesting Period:', period, 'for date:', reportUpdateDate);

fetchDashboardStats({ reportUpdateDate, period })
  .then((data) => {
    console.log('SUCCESS');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch((error) => {
    console.log('FAILED');
    console.log('code:', error.code);
    console.log('message:', error.message);
    console.log('response status:', error.response?.status);
    console.log('response data:', JSON.stringify(error.response?.data)?.slice(0, 500));
  });
