const pool = require('../config/database');
const {
  ensureApplication,
  createReport,
  savePeriodMetrics,
  saveFormSubmitStats,
  saveDashboardViewStats,
} = require('./dbPersistenceService');

// IBREMS dates are DD/MM/YYYY (date-only, no time) - same convention as LMS.
function toIsoDate(ddmmyyyy) {
  if (!ddmmyyyy || typeof ddmmyyyy !== 'string') return null;
  const [day, month, year] = ddmmyyyy.split('/');
  if (!day || !month || !year) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// reportPeriod comes as a single string range, e.g. "01/08/2026 - 24/08/2026" - same
// shape as LMS's reportPeriod, reuses the identical split-and-convert approach.
function parseReportPeriodRange(reportPeriod) {
  if (!reportPeriod || typeof reportPeriod !== 'string') return { from: null, to: null };
  const [fromStr, toStr] = reportPeriod.split(' - ').map((part) => part && part.trim());
  return { from: toIsoDate(fromStr), to: toIsoDate(toStr) };
}

function buildPeriodMetricsPayload(period) {
  return {
    dateRange: parseReportPeriodRange(period.reportPeriod),
    reportPeriod: period.reportPeriod ?? null,
    lastLogin: toIsoDate(period.lastLogin),
    totalLogins: period.totalLogin ?? null,
    uniqueUsers: period.activeUsers ?? null,
    newLogins: period.newUsers ?? null, // IBREMS gives this directly - no daily array to sum, unlike LMS
    averageActiveUsersPerDay: period.averageActiveUsersPerDay ?? null,
    loginAveragePerUser: period.loginAveragePerUser ?? null,
  };
}

// Persists one IBREMS fetch as a single atomic transaction: the application lookup,
// the report row, and both periods' metrics/formSubmit/dashboardView rows either all
// commit together or all roll back together.
//
// This function is expected to be called from within a try/catch by its caller
// (ibremsService.js) - a thrown error here must never propagate into the IBREMS API
// response returned to the frontend.
async function persistIbremsReport(rawResponse, { startDate, endDate } = {}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const applicationId = await ensureApplication(
      {
        moduleKey: 'ibrems',
        moduleName: 'IBREMS',
        appFamily: 'IBREMS',
        hasPreviousPeriod: true,
        hasEmployeeStats: false,
        hasCallStats: false,
        hasServiceRequests: false,
        hasTrainingStats: false,
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
        sourceLastUpdateAt: null, // IBREMS response has no lastReportUpdateDate-style field
        rawResponse,
      },
      connection,
    );

    const currentPeriod = rawResponse?.currentPeriod;
    const previousPeriod = rawResponse?.previousPeriod;

    if (currentPeriod) {
      await savePeriodMetrics(reportId, 'current', buildPeriodMetricsPayload(currentPeriod), connection);
      await saveFormSubmitStats(reportId, 'current', currentPeriod.formSubmit || {}, connection);
      await saveDashboardViewStats(reportId, 'current', currentPeriod.dashboardView || {}, connection);
    }

    if (previousPeriod) {
      await savePeriodMetrics(reportId, 'previous', buildPeriodMetricsPayload(previousPeriod), connection);
      await saveFormSubmitStats(reportId, 'previous', previousPeriod.formSubmit || {}, connection);
      await saveDashboardViewStats(reportId, 'previous', previousPeriod.dashboardView || {}, connection);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { persistIbremsReport };
