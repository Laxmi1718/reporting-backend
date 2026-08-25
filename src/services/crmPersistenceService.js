const {
  ensureApplication,
  createReport,
  savePeriodMetrics,
  saveDailyMetrics,
} = require('./dbPersistenceService');

// Capability flags mirror what we've verified against real API responses this session -
// see report_applications.has_* columns.
const MODULE_METADATA = {
  'Parivartan': { key: 'parivartan', name: 'Parivartan', hasPrev: true, hasEmp: true, hasCalls: true },
  'Abis Pro (CRM)': { key: 'abis_pro', name: 'Abis Pro (CRM)', hasPrev: false, hasEmp: true, hasCalls: true },
  'Traders CRM': { key: 'traders', name: 'Traders CRM', hasPrev: true, hasEmp: true, hasCalls: true },
  'Chicks CRM': { key: 'chicks', name: 'Chicks CRM', hasPrev: false, hasEmp: false, hasCalls: true },
  'Doctor CRM': { key: 'doctor', name: 'Doctor CRM', hasPrev: false, hasEmp: false, hasCalls: false },
};

function hasAnyValue(period) {
  return !!period && Object.values(period).some((value) => value !== null && value !== undefined);
}

// Phase 1: core metrics only (report_applications, app_reports, app_period_metrics,
// app_daily_metrics). Employee/login-history tables are a separate follow-up phase -
// each CRM API names its per-employee data differently and needs bespoke parsing.
//
// This function never throws - a DB failure for one module (or all of them) must never
// break the live dashboard response, which is why every step is wrapped per-module.
async function persistCrmAppReports(appReports, { startDate, endDate } = {}) {
  if (!Array.isArray(appReports)) return;

  for (const report of appReports) {
    const meta = MODULE_METADATA[report?.app];
    if (!meta) continue; // unrecognized module - skip persistence, don't guess

    try {
      const applicationId = await ensureApplication({
        moduleKey: meta.key,
        moduleName: meta.name,
        appFamily: 'CRM',
        hasPreviousPeriod: meta.hasPrev,
        hasEmployeeStats: meta.hasEmp,
        hasCallStats: meta.hasCalls,
      });

      const reportId = await createReport({
        applicationId,
        requestedStartDate: startDate,
        requestedEndDate: endDate,
        sourceLastUpdateAt: report.raw?.lastReportUpdateDate,
        rawResponse: report.raw,
      });

      await savePeriodMetrics(reportId, 'current', report.currentPeriod || {});

      if (meta.hasPrev && hasAnyValue(report.previousPeriod)) {
        await savePeriodMetrics(reportId, 'previous', report.previousPeriod);
      }

      await saveDailyMetrics(reportId, report.dailyData);
    } catch (error) {
      console.error(`[DB persistence] Failed to save ${report.app}: ${error.message}`);
    }
  }
}

module.exports = { persistCrmAppReports };
