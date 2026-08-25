require('dotenv').config();
const pool = require('./config/database');

// Read-only verification - no writes, no test script, no hardcoded persistence call.
// Identifies the row created by the real HTTP request just made to
// GET /api/reports/lms?startDate=2026-07-15&endDate=2026-08-17
const startDate = '2026-07-15';
const endDate = '2026-08-17';

function fmtDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  const [apps] = await pool.query("SELECT id FROM report_applications WHERE module_key = 'lms'");
  const applicationId = apps[0]?.id;
  console.log(`LMS application_id: ${applicationId}`);

  const [rows] = await pool.query(
    'SELECT id, requested_start_date, requested_end_date, fetched_at, (raw_response IS NOT NULL) AS has_raw_response FROM app_reports WHERE application_id = ? AND requested_start_date = ? AND requested_end_date = ? ORDER BY id DESC',
    [applicationId, startDate, endDate],
  );

  console.log(`\napp_reports rows matching requested_start_date=${startDate} AND requested_end_date=${endDate}: ${rows.length}`);
  rows.forEach((r) => {
    console.log(`  id=${r.id}  requested_start_date=${fmtDate(r.requested_start_date)}  requested_end_date=${fmtDate(r.requested_end_date)}  fetched_at=${r.fetched_at}  has_raw_response=${r.has_raw_response}`);
  });

  if (!rows.length) {
    console.log('\nNo row found for this exact range.');
    await pool.end();
    return;
  }

  const reportId = rows[0].id; // most recent match = the one just created by the live request
  console.log(`\n>>> Verifying report_id = ${reportId} (most recent match) <<<\n`);

  const [periodMetrics] = await pool.query('SELECT report_id, period_type, total_logins, unique_users FROM app_period_metrics WHERE report_id = ?', [reportId]);
  console.log(`app_period_metrics rows for report_id=${reportId}: ${periodMetrics.length}`);
  console.table(periodMetrics);

  const [dailyMetrics] = await pool.query('SELECT report_id, metric_date, logins FROM app_daily_metrics WHERE report_id = ? ORDER BY metric_date', [reportId]);
  console.log(`\napp_daily_metrics rows for report_id=${reportId}: ${dailyMetrics.length}`);

  const [trainingStats] = await pool.query('SELECT report_id, period_type, trainings_created, trainings_completed FROM lms_training_stats WHERE report_id = ?', [reportId]);
  console.log(`\nlms_training_stats rows for report_id=${reportId}: ${trainingStats.length}`);
  console.table(trainingStats);

  const [elearningStats] = await pool.query('SELECT report_id, period_type, active_courses, completed_users FROM lms_elearning_stats WHERE report_id = ?', [reportId]);
  console.log(`\nlms_elearning_stats rows for report_id=${reportId}: ${elearningStats.length}`);
  console.table(elearningStats);

  console.log('\n--- Cross-check: does every child row reference this exact report_id? ---');
  const allMatch = [...periodMetrics, ...dailyMetrics, ...trainingStats, ...elearningStats].every((r) => r.report_id === reportId);
  console.log(allMatch ? `YES - all rows reference report_id=${reportId}` : 'MISMATCH FOUND');

  await pool.end();
}

main().catch((error) => {
  console.error('Verification failed:', error);
  process.exit(1);
});
