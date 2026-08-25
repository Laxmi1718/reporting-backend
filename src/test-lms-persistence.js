require('dotenv').config();
const pool = require('./config/database');
const { getUtilizationData } = require('./services/lmsService');

// Real date range, no fake/synthetic data. getUtilizationData() is the real
// application function - it hits the real LMS API and, as wired in lmsService.js,
// persists via persistLmsReport() inside its own try/catch. This script only reads
// afterward to verify; it never inserts anything itself.
const startDate = '2026-08-10';
const endDate = '2026-08-17';

let persistenceError = null;
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  if (message.includes('[DB persistence] Failed to save LMS report')) {
    persistenceError = message;
  }
  originalConsoleError(...args);
};

function fmtDate(value) {
  if (!value) return null;
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const mismatches = [];
function compare(label, apiValue, dbValue) {
  const a = apiValue === undefined ? null : apiValue;
  let b = dbValue === undefined ? null : dbValue;
  const aNorm = typeof a === 'number' ? Number(a.toFixed(2)) : a;
  const bNorm = typeof b === 'string' && b !== '' && !Number.isNaN(Number(b)) ? Number(Number(b).toFixed(2)) : b;
  const match = String(aNorm) === String(bNorm);
  if (!match) mismatches.push(`${label}: API=${JSON.stringify(apiValue)} vs DB=${JSON.stringify(dbValue)}`);
  return match;
}

async function main() {
  const [apps] = await pool.query("SELECT id FROM report_applications WHERE module_key = 'lms'");
  if (!apps.length) {
    console.log('No LMS application row exists in report_applications - cannot verify.');
    await pool.end();
    return;
  }
  const applicationId = apps[0].id;

  const [existingBefore] = await pool.query(
    'SELECT id FROM app_reports WHERE application_id = ? AND requested_start_date = ? AND requested_end_date = ?',
    [applicationId, startDate, endDate],
  );
  const preExistingIds = existingBefore.map((r) => r.id);
  const maxIdBefore = preExistingIds.length ? Math.max(...preExistingIds) : 0;

  console.log(`LMS application_id: ${applicationId}`);
  console.log(`Pre-existing app_reports rows already in DB for this exact date range (${startDate} to ${endDate}) BEFORE this run: ${preExistingIds.length ? preExistingIds.join(', ') : 'none'}`);

  let apiCallOk = false;
  let apiResponseOk = false;
  let response = null;
  let apiError = null;

  console.log(`\nCalling getUtilizationData({ startDate: '${startDate}', endDate: '${endDate}' })...`);
  try {
    response = await getUtilizationData({ startDate, endDate });
    apiCallOk = true;
    apiResponseOk = response?.succeeded === true;
  } catch (error) {
    apiError = error.message;
  }

  console.error = originalConsoleError;

  const [afterRows] = await pool.query(
    'SELECT id, requested_start_date, requested_end_date, fetched_at, raw_response FROM app_reports WHERE application_id = ? AND requested_start_date = ? AND requested_end_date = ? AND id > ? ORDER BY id ASC',
    [applicationId, startDate, endDate, maxIdBefore],
  );
  const newReport = afterRows[0] || null;
  const reportId = newReport?.id || null;

  let periodMetrics = [];
  let dailyMetrics = [];
  let trainingStats = [];
  let elearningStats = [];

  if (reportId) {
    [periodMetrics] = await pool.query('SELECT * FROM app_period_metrics WHERE report_id = ?', [reportId]);
    [dailyMetrics] = await pool.query('SELECT * FROM app_daily_metrics WHERE report_id = ? ORDER BY metric_date', [reportId]);
    [trainingStats] = await pool.query('SELECT * FROM lms_training_stats WHERE report_id = ?', [reportId]);
    [elearningStats] = await pool.query('SELECT * FROM lms_elearning_stats WHERE report_id = ?', [reportId]);
  }

  const currentDb = periodMetrics.find((p) => p.period_type === 'current');
  const previousDb = periodMetrics.find((p) => p.period_type === 'previous');
  const trainingCurrentDb = trainingStats.find((t) => t.period_type === 'current');
  const elearningCurrentDb = elearningStats.find((e) => e.period_type === 'current');

  if (response && currentDb) {
    compare('currentPeriod.totalLogin', response.currentPeriod?.totalLogin, currentDb.total_logins);
    compare('currentPeriod.activeUsers', response.currentPeriod?.activeUsers, currentDb.unique_users);
    compare('currentPeriod.averageActiveUsersPerDay', response.currentPeriod?.averageActiveUsersPerDay, currentDb.average_active_users_per_day);
    compare('currentPeriod.loginAveragePerUser', response.currentPeriod?.loginAveragePerUser, currentDb.login_average_per_user);
    const expectedNewLogins = (response.currentPeriod?.dailyNewLogin || []).reduce((s, e) => s + (Number(e.count) || 0), 0);
    compare('currentPeriod SUM(dailyNewLogin)', expectedNewLogins, currentDb.new_logins);
  }
  if (response && previousDb) {
    compare('previousPeriod.totalLogin', response.previousPeriod?.totalLogin, previousDb.total_logins);
    compare('previousPeriod.activeUsers', response.previousPeriod?.activeUsers, previousDb.unique_users);
    const expectedPrevNewLogins = (response.previousPeriod?.dailyNewLogin || []).reduce((s, e) => s + (Number(e.count) || 0), 0);
    compare('previousPeriod SUM(dailyNewLogin)', expectedPrevNewLogins, previousDb.new_logins);
  }
  if (response && trainingCurrentDb) {
    compare('currentPeriod.trainingSessions.created', response.currentPeriod?.trainingSessions?.created, trainingCurrentDb.trainings_created);
    compare('currentPeriod.trainingSessions.completed', response.currentPeriod?.trainingSessions?.completed, trainingCurrentDb.trainings_completed);
    compare('currentPeriod.trainingSessions.assignedUsers', response.currentPeriod?.trainingSessions?.assignedUsers, trainingCurrentDb.assigned_users);
    compare('currentPeriod.trainingSessions.completedUsers', response.currentPeriod?.trainingSessions?.completedUsers, trainingCurrentDb.completed_users);
  }
  if (response && elearningCurrentDb) {
    compare('currentPeriod.eLearning.activeCourses', response.currentPeriod?.eLearning?.activeCourses, elearningCurrentDb.active_courses);
    compare('currentPeriod.eLearning.assignedUsers', response.currentPeriod?.eLearning?.assignedUsers, elearningCurrentDb.assigned_users);
    compare('currentPeriod.eLearning.completedUsers', response.currentPeriod?.eLearning?.completedUsers, elearningCurrentDb.completed_users);
    compare('currentPeriod.eLearning.inProgressUsers', response.currentPeriod?.eLearning?.inProgressUsers, elearningCurrentDb.in_progress_users);
  }

  const expectedDailyRowCount = (response?.currentPeriod?.dailyLogin?.length || 0) + (response?.previousPeriod?.dailyLogin?.length || 0);
  if (dailyMetrics.length !== expectedDailyRowCount) {
    mismatches.push(`app_daily_metrics row count: API dailyLogin combined=${expectedDailyRowCount} vs DB rows=${dailyMetrics.length}`);
  }

  console.log('\n================ VERIFICATION REPORT ================');
  console.log(`REAL API CALL: ${apiCallOk ? 'PASS' : 'FAIL'}${apiError ? ` (${apiError})` : ''}`);
  console.log(`API RESPONSE: ${apiResponseOk ? 'PASS' : 'FAIL'}`);
  console.log(`DB TRANSACTION: ${persistenceError ? 'ROLLED BACK' : 'COMMITTED'}`);
  console.log(`app_reports: ${reportId ? 'PASS' : 'FAIL'}`);
  console.log(`app_period_metrics: ${periodMetrics.length === 2 ? 'PASS' : 'FAIL'} (${periodMetrics.length} row(s))`);
  console.log(`app_daily_metrics: ${dailyMetrics.length > 0 && dailyMetrics.length === expectedDailyRowCount ? 'PASS' : 'FAIL'} (${dailyMetrics.length} row(s), expected ${expectedDailyRowCount})`);
  console.log(`lms_training_stats: ${trainingStats.length === 2 ? 'PASS' : 'FAIL'} (${trainingStats.length} row(s))`);
  console.log(`lms_elearning_stats: ${elearningStats.length === 2 ? 'PASS' : 'FAIL'} (${elearningStats.length} row(s))`);
  console.log(`API vs DB DATA MATCH: ${mismatches.length === 0 ? 'PASS' : 'FAIL'}`);
  console.log('=======================================================');

  console.log(`\nreport_id created by this test run: ${reportId}`);
  console.log(`requested_start_date: ${newReport ? fmtDate(newReport.requested_start_date) : 'N/A'}`);
  console.log(`requested_end_date: ${newReport ? fmtDate(newReport.requested_end_date) : 'N/A'}`);
  console.log(`fetched_at populated: ${newReport?.fetched_at ? 'yes (' + newReport.fetched_at + ')' : 'no'}`);
  console.log(`raw_response populated: ${newReport?.raw_response ? 'yes' : 'no'}`);

  console.log(`\n--- Existing vs new data ---`);
  console.log(`Pre-existing app_reports row(s) for this exact date range (NOT created by this run): ${preExistingIds.length ? preExistingIds.join(', ') : 'none'}`);
  console.log(`Row(s) newly created by THIS run: ${afterRows.map((r) => r.id).join(', ') || 'none'}`);

  if (mismatches.length) {
    console.log('\nMismatches found:');
    mismatches.forEach((m) => console.log(' - ' + m));
  } else {
    console.log('\nNo mismatches found - all compared API values match their DB counterparts.');
  }

  await pool.end();
}

main().catch((error) => {
  console.error = originalConsoleError;
  console.error('Verification script failed:', error);
  process.exit(1);
});
