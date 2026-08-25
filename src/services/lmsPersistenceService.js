const pool = require('../config/database');
const {
  ensureApplication,
  createReport,
  savePeriodMetrics,
  saveDailyMetrics,
  saveTrainingStats,
  saveElearningStats,
} = require('./dbPersistenceService');

// LMS dates are DD/MM/YYYY (date-only, no time) - converts to a plain YYYY-MM-DD
// string so it can be handed straight to dbPersistenceService's existing
// toDateValue() without any new date-parsing logic there.
function toIsoDate(ddmmyyyy) {
  if (!ddmmyyyy || typeof ddmmyyyy !== 'string') return null;
  const [day, month, year] = ddmmyyyy.split('/');
  if (!day || !month || !year) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// reportPeriod comes as a single string range, e.g. "01/08/2026 - 23/08/2026",
// unlike the CRM modules which provide a {from, to} object directly.
function parseReportPeriodRange(reportPeriod) {
  if (!reportPeriod || typeof reportPeriod !== 'string') return { from: null, to: null };
  const [fromStr, toStr] = reportPeriod.split(' - ').map((part) => part && part.trim());
  return { from: toIsoDate(fromStr), to: toIsoDate(toStr) };
}

function sumDailyCounts(entries) {
  if (!Array.isArray(entries)) return null;
  return entries.reduce((sum, entry) => sum + (Number(entry?.count) || 0), 0);
}

// dailyLogin[].count is the total logins for that day - maps to app_daily_metrics.logins.
// dailyNewLogin's per-day detail has no dedicated column (see mapping discussion);
// only its period-level SUM is captured, via buildPeriodMetricsPayload's newLogins.
function mapDailyLoginRows(dailyLogin) {
  if (!Array.isArray(dailyLogin)) return [];
  return dailyLogin
    .map((entry) => ({ date: toIsoDate(entry?.date), logins: entry?.count }))
    .filter((row) => row.date);
}

function buildPeriodMetricsPayload(period) {
  return {
    dateRange: parseReportPeriodRange(period.reportPeriod),
    reportPeriod: period.reportPeriod ?? null,
    lastLogin: toIsoDate(period.lastLogin),
    totalUsers: null, // not provided by LMS
    uniqueUsers: period.activeUsers ?? null,
    totalLogins: period.totalLogin ?? null,
    newLogins: sumDailyCounts(period.dailyNewLogin),
    averageActiveUsersPerDay: period.averageActiveUsersPerDay ?? null,
    loginAveragePerUser: period.loginAveragePerUser ?? null,
    utilizationPerDay: null, // not provided by LMS
    totalEmployees: null,
    totalActiveEmployees: null,
    totalInactiveEmployees: null,
    totalCalls: null,
    totalIncomingCalls: null,
    totalOutgoingCalls: null,
    connectedCalls: null,
    missedCalls: null,
    connectedIncomingCalls: null,
    missedIncomingCalls: null,
    connectedOutgoingCalls: null,
    missedOutgoingCalls: null,
  };
}

// Persists one LMS fetch as a single atomic transaction: the application lookup,
// the report row, both periods' metrics/training/e-learning rows, and the combined
// daily rows either all commit together or all roll back together.
//
// This function is expected to be called from within a try/catch by its caller
// (lmsService.js) - a thrown error here must never propagate into the LMS API
// response returned to the frontend.
async function persistLmsReport(rawResponse, { startDate, endDate } = {}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const applicationId = await ensureApplication(
      {
        moduleKey: 'lms',
        moduleName: 'LMS',
        appFamily: 'LMS',
        hasPreviousPeriod: true,
        hasEmployeeStats: false,
        hasCallStats: false,
        hasServiceRequests: false,
        hasTrainingStats: true,
      },
      connection,
    );

    const reportId = await createReport(
      {
        applicationId,
        requestedStartDate: startDate,
        requestedEndDate: endDate,
        reportUpdateDate: null,
        periodParam: null,
        sourceLastUpdateAt: null, // LMS response has no lastReportUpdateDate-style field
        rawResponse,
      },
      connection,
    );

    const currentPeriod = rawResponse?.currentPeriod;
    const previousPeriod = rawResponse?.previousPeriod;

    if (currentPeriod) {
      await savePeriodMetrics(reportId, 'current', buildPeriodMetricsPayload(currentPeriod), connection);
      await saveTrainingStats(reportId, 'current', currentPeriod.trainingSessions || {}, connection);
      await saveElearningStats(reportId, 'current', currentPeriod.eLearning || {}, connection);
    }

    if (previousPeriod) {
      await savePeriodMetrics(reportId, 'previous', buildPeriodMetricsPayload(previousPeriod), connection);
      await saveTrainingStats(reportId, 'previous', previousPeriod.trainingSessions || {}, connection);
      await saveElearningStats(reportId, 'previous', previousPeriod.eLearning || {}, connection);
    }

    const dailyRows = [
      ...mapDailyLoginRows(currentPeriod?.dailyLogin),
      ...mapDailyLoginRows(previousPeriod?.dailyLogin),
    ];
    await saveDailyMetrics(reportId, dailyRows, connection);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { persistLmsReport };
