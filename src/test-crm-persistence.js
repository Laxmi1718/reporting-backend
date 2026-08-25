require('dotenv').config();
const pool = require('./config/database');
const { fetchCrmOverallReport } = require('./services/crmAggregatorService');

async function main() {
  const startDate = '2026-08-10';
  const endDate = '2026-08-12';

  console.log(`Fetching CRM overall report for ${startDate} - ${endDate}...`);
  console.log('(this hits all 5 live CRM APIs, same as the dashboard does, and now also persists to MySQL)\n');

  const result = await fetchCrmOverallReport({ startDate, endDate });

  console.log('--- Dashboard-facing response shape (unchanged check) ---');
  console.log('success:', result.success);
  console.log('currentPeriod.totalCalls:', result.currentPeriod.totalCalls);
  console.log('appReports count:', result.appReports.length);
  console.log('appReports apps:', result.appReports.map((r) => r.app));

  console.log('\n--- Verifying rows landed in MySQL ---');

  const [apps] = await pool.query('SELECT id, module_key, module_name, app_family FROM report_applications ORDER BY id');
  console.log(`report_applications: ${apps.length} row(s)`);
  console.table(apps);

  const [reports] = await pool.query(
    `SELECT r.id, a.module_key, r.requested_start_date, r.requested_end_date, r.fetched_at
     FROM app_reports r JOIN report_applications a ON r.application_id = a.id
     ORDER BY r.id DESC LIMIT 10`,
  );
  console.log(`\napp_reports (most recent 10): ${reports.length} row(s)`);
  console.table(reports);

  const reportIds = reports.map((r) => r.id);

  const [metrics] = await pool.query(
    `SELECT pm.report_id, a.module_key, pm.period_type, pm.total_logins, pm.unique_users, pm.total_calls, pm.missed_calls
     FROM app_period_metrics pm
     JOIN app_reports r ON pm.report_id = r.id
     JOIN report_applications a ON r.application_id = a.id
     WHERE r.id IN (?)
     ORDER BY pm.report_id DESC`,
    [reportIds],
  );
  console.log(`\napp_period_metrics for this fetch's reports: ${metrics.length} row(s)`);
  console.table(metrics);

  const [daily] = await pool.query(
    `SELECT dm.report_id, a.module_key, dm.metric_date, dm.logins, dm.active_users, dm.total_calls
     FROM app_daily_metrics dm
     JOIN app_reports r ON dm.report_id = r.id
     JOIN report_applications a ON r.application_id = a.id
     WHERE r.id IN (?)
     ORDER BY dm.report_id DESC, dm.metric_date ASC`,
    [reportIds],
  );
  console.log(`\napp_daily_metrics for this fetch's reports: ${daily.length} row(s)`);
  console.table(daily);

  await pool.end();
}

main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
