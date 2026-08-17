require('dotenv').config();
const { fetchDashboardStats } = require('./src/services/myIbService');

// Two dates far apart, same Period, to check whether TotalLoginCount/ActiveUsers
// actually move with the date or stay frozen (suggesting lifetime totals).
const period = 'Month';
const dateA = '2026-01-15';
const dateB = '2026-07-15';

async function run() {
  console.log(`Requesting Period=${period} for ${dateA} and ${dateB}...\n`);

  const [resultA, resultB] = await Promise.all([
    fetchDashboardStats({ reportUpdateDate: dateA, period }),
    fetchDashboardStats({ reportUpdateDate: dateB, period }),
  ]);

  const a = resultA?.Data || {};
  const b = resultB?.Data || {};

  console.log(`--- ${dateA} -> ReportDate: ${a.ReportDate}, Period: ${a.Period} ---`);
  console.log(JSON.stringify(a, null, 2));
  console.log(`\n--- ${dateB} -> ReportDate: ${b.ReportDate}, Period: ${b.Period} ---`);
  console.log(JSON.stringify(b, null, 2));

  console.log('\n=== FIELD-BY-FIELD DIFF ===');
  const fields = ['ReportDate', 'LastLoginCount', 'TotalLoginCount', 'ActiveUsers', 'AverageActiveUsersPerDay', 'LoginAverage'];
  fields.forEach((field) => {
    const same = a[field] === b[field];
    console.log(`${field}: ${a[field]} vs ${b[field]}  ${same ? '<-- SAME' : '(different)'}`);
  });

  const utilA = a.UtilizationPerDay || {};
  const utilB = b.UtilizationPerDay || {};
  Object.keys(utilA).forEach((field) => {
    const same = utilA[field] === utilB[field];
    console.log(`UtilizationPerDay.${field}: ${utilA[field]} vs ${utilB[field]}  ${same ? '<-- SAME' : '(different)'}`);
  });
}

run().catch((error) => {
  console.log('FAILED');
  console.log('message:', error.message);
  console.log('response status:', error.response?.status);
  console.log('response data:', JSON.stringify(error.response?.data)?.slice(0, 500));
});
