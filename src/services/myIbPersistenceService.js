const pool = require('../config/database');
const {
  ensureApplication,
  createReport,
  savePeriodMetrics,
  saveMyIbExtras,
} = require('./dbPersistenceService');

// MyIB has no date-range concept (single ReportDate + Period, not a from/to range),
// so there is no dateRange to build here - period_start/period_end stay NULL, unlike
// LMS/CRM which derive them from the response.
function buildPeriodMetricsPayload(data) {
  return {
    reportPeriod: data.ReportDate ?? null,
    totalLogins: data.TotalLoginCount ?? null,
    uniqueUsers: data.ActiveUsers ?? null,
    averageActiveUsersPerDay: data.AverageActiveUsersPerDay ?? null,
    loginAveragePerUser: data.LoginAverage ?? null,
  };
}

function buildExtrasPayload(data) {
  const utilization = data.UtilizationPerDay || {};
  return {
    lastLoginCount: data.LastLoginCount ?? null,
    itsmTicketsCreated: utilization.ItsmTicketsCreated ?? null,
    travelDeskRequests: utilization.TravelDeskRequestCreated ?? null,
    meetingRoomRequests: utilization.MeetingRoomRequestCreated ?? null,
    gatePassRequests: utilization.GatePassRequestCreated ?? null,
    companyCarRequests: utilization.CompanyCarRequestCreated ?? null,
    leaveRequests: utilization.LeaveRequestCreated ?? null,
  };
}

// Persists one MyIB fetch. Only a 'current' period is saved - the API has no
// previous-period data at all (unlike LMS), so no 'previous' row is ever written.
//
// This function is expected to be called from within a try/catch by its caller
// (myIbService.js) - a thrown error here must never propagate into the MyIB API
// response returned to the frontend.
async function persistMyIbReport(rawResponse, { reportUpdateDate, period } = {}) {
  const data = rawResponse?.Data || {};
  const connection = await pool.getConnection();
  let reportId;

  try {
    await connection.beginTransaction();

    const applicationId = await ensureApplication(
      {
        moduleKey: 'myib',
        moduleName: 'MyIB',
        appFamily: 'MYIB',
        hasPreviousPeriod: false,
        hasEmployeeStats: false,
        hasCallStats: false,
        hasServiceRequests: true,
        hasTrainingStats: false,
      },
      connection,
    );

    reportId = await createReport(
      {
        applicationId,
        requestedStartDate: null,
        requestedEndDate: null,
        reportUpdateDate: reportUpdateDate || null,
        periodParam: period || null,
        sourceLastUpdateAt: null, // MyIB response has no lastReportUpdateDate-style field
        rawResponse,
      },
      connection,
    );

    await savePeriodMetrics(reportId, 'current', buildPeriodMetricsPayload(data), connection);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  // saveMyIbExtras() has no connection-sharing support (unlike the calls above), so it
  // runs after the transaction commits - by then app_reports.id is visible to it, which
  // it needs to satisfy myib_report_extras' foreign key.
  await saveMyIbExtras(reportId, buildExtrasPayload(data));
}

module.exports = { persistMyIbReport };
