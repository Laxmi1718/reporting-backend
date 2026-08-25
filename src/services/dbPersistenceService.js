const pool = require('../config/database');

function toDateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function ensureApplication({
  moduleKey,
  moduleName,
  appFamily,
  hasPreviousPeriod = false,
  hasEmployeeStats = false,
  hasCallStats = false,
  hasServiceRequests = false,
  hasTrainingStats = false,
}, connection) {
  const db = connection || pool;
  const [existing] = await db.query(
    'SELECT id FROM report_applications WHERE module_key = ?',
    [moduleKey],
  );
  if (existing.length) return existing[0].id;

  const [result] = await db.query(
    `INSERT INTO report_applications
      (app_family, module_key, module_name, has_previous_period, has_employee_stats, has_call_stats, has_service_requests, has_training_stats)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      appFamily,
      moduleKey,
      moduleName,
      hasPreviousPeriod ? 1 : 0,
      hasEmployeeStats ? 1 : 0,
      hasCallStats ? 1 : 0,
      hasServiceRequests ? 1 : 0,
      hasTrainingStats ? 1 : 0,
    ],
  );
  return result.insertId;
}

async function createReport({
  applicationId,
  requestedStartDate,
  requestedEndDate,
  reportUpdateDate,
  periodParam,
  sourceLastUpdateAt,
  rawResponse,
}, connection) {
  const db = connection || pool;
  const [result] = await db.query(
    `INSERT INTO app_reports
      (application_id, requested_start_date, requested_end_date, report_update_date, period_param, source_last_update_at, raw_response)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      applicationId,
      toDateValue(requestedStartDate),
      toDateValue(requestedEndDate),
      reportUpdateDate || null,
      periodParam || null,
      toDateValue(sourceLastUpdateAt),
      rawResponse !== undefined && rawResponse !== null ? JSON.stringify(rawResponse) : null,
    ],
  );
  return result.insertId;
}

async function savePeriodMetrics(reportId, periodType, metrics = {}, connection) {
  const db = connection || pool;
  const dateRange = metrics.dateRange || {};

  await db.query(
    `INSERT INTO app_period_metrics
      (report_id, period_type, period_start, period_end, report_period_label,
       total_users, unique_users, total_logins, new_logins, last_login,
       average_active_users_per_day, login_average_per_user, utilization_per_day,
       total_employees, total_active_employees, total_inactive_employees,
       total_calls, total_incoming_calls, total_outgoing_calls, connected_calls, missed_calls,
       connected_incoming_calls, missed_incoming_calls, connected_outgoing_calls, missed_outgoing_calls)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       period_start = VALUES(period_start), period_end = VALUES(period_end), report_period_label = VALUES(report_period_label),
       total_users = VALUES(total_users), unique_users = VALUES(unique_users), total_logins = VALUES(total_logins),
       new_logins = VALUES(new_logins), last_login = VALUES(last_login),
       average_active_users_per_day = VALUES(average_active_users_per_day), login_average_per_user = VALUES(login_average_per_user),
       utilization_per_day = VALUES(utilization_per_day),
       total_employees = VALUES(total_employees), total_active_employees = VALUES(total_active_employees), total_inactive_employees = VALUES(total_inactive_employees),
       total_calls = VALUES(total_calls), total_incoming_calls = VALUES(total_incoming_calls), total_outgoing_calls = VALUES(total_outgoing_calls),
       connected_calls = VALUES(connected_calls), missed_calls = VALUES(missed_calls),
       connected_incoming_calls = VALUES(connected_incoming_calls), missed_incoming_calls = VALUES(missed_incoming_calls),
       connected_outgoing_calls = VALUES(connected_outgoing_calls), missed_outgoing_calls = VALUES(missed_outgoing_calls)`,
    [
      reportId,
      periodType,
      toDateValue(dateRange.from ?? metrics.periodStart),
      toDateValue(dateRange.to ?? metrics.periodEnd),
      metrics.reportPeriod ?? metrics.reportPeriodLabel ?? null,
      metrics.totalUsers ?? null,
      metrics.uniqueUsers ?? null,
      metrics.totalLogins ?? null,
      metrics.newLogins ?? null,
      toDateValue(metrics.lastLogin),
      metrics.averageActiveUsersPerDay ?? null,
      metrics.loginAveragePerUser ?? null,
      metrics.utilizationPerDay ?? null,
      metrics.totalEmployees ?? null,
      metrics.totalActiveEmployees ?? null,
      metrics.totalInactiveEmployees ?? null,
      metrics.totalCalls ?? null,
      metrics.totalIncomingCalls ?? null,
      metrics.totalOutgoingCalls ?? null,
      metrics.connectedCalls ?? null,
      metrics.missedCalls ?? null,
      metrics.connectedIncomingCalls ?? null,
      metrics.missedIncomingCalls ?? null,
      metrics.connectedOutgoingCalls ?? null,
      metrics.missedOutgoingCalls ?? null,
    ],
  );
}

async function saveDailyMetrics(reportId, dailyRows, connection) {
  if (!Array.isArray(dailyRows) || !dailyRows.length) return;
  const db = connection || pool;

  for (const row of dailyRows) {
    const metricDate = toDateValue(row.date || row.label);
    if (!metricDate) continue;

    await db.query(
      `INSERT INTO app_daily_metrics
        (report_id, metric_date, logins, active_users, total_calls, incoming_calls, outgoing_calls, connected_calls, missed_calls, utilization_percentage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         logins = VALUES(logins), active_users = VALUES(active_users), total_calls = VALUES(total_calls),
         incoming_calls = VALUES(incoming_calls), outgoing_calls = VALUES(outgoing_calls),
         connected_calls = VALUES(connected_calls), missed_calls = VALUES(missed_calls),
         utilization_percentage = VALUES(utilization_percentage)`,
      [
        reportId,
        metricDate,
        row.logins ?? row.totalLogins ?? row.loginCount ?? null,
        row.activeUsers ?? row.uniqueUsers ?? null,
        row.totalCalls ?? null,
        row.incomingCalls ?? null,
        row.outgoingCalls ?? null,
        row.connectedCalls ?? null,
        row.missedCalls ?? null,
        row.utilizationPercentage ?? null,
      ],
    );
  }
}

async function upsertEmployee({ applicationId, externalEmployeeId, employeeName, employeePhone, employeeEmail, roleName }) {
  if (!applicationId || !externalEmployeeId) return null;

  const [existing] = await pool.query(
    'SELECT id FROM crm_employees WHERE application_id = ? AND external_employee_id = ?',
    [applicationId, externalEmployeeId],
  );

  if (existing.length) {
    await pool.query(
      'UPDATE crm_employees SET employee_name = ?, employee_phone = ?, employee_email = ?, role_name = ? WHERE id = ?',
      [employeeName || null, employeePhone || null, employeeEmail || null, roleName || null, existing[0].id],
    );
    return existing[0].id;
  }

  const [result] = await pool.query(
    `INSERT INTO crm_employees (application_id, external_employee_id, employee_name, employee_phone, employee_email, role_name)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [applicationId, externalEmployeeId, employeeName || null, employeePhone || null, employeeEmail || null, roleName || null],
  );
  return result.insertId;
}

async function saveLoginHistoryEvent({
  reportId,
  employeeId,
  attemptedUsername,
  loginTime,
  loginStatus,
  loginType,
  failureReason,
  ipAddress,
  userAgent,
  externalRecordId,
}) {
  const time = toDateValue(loginTime);
  if (!time) return;

  await pool.query(
    `INSERT INTO crm_login_history
      (report_id, employee_id, attempted_username, login_time, login_status, login_type, failure_reason, ip_address, user_agent, external_record_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reportId,
      employeeId || null,
      attemptedUsername || null,
      time,
      loginStatus || null,
      loginType || null,
      failureReason || null,
      ipAddress || null,
      userAgent || null,
      externalRecordId || null,
    ],
  );
}

async function saveEmployeeCallStats({
  reportId,
  employeeId,
  totalLogins,
  lastLogin,
  totalCalls,
  totalIncomingCalls,
  totalOutgoingCalls,
  connectedCalls,
  missedCalls,
}) {
  if (!employeeId) return;

  await pool.query(
    `INSERT INTO crm_employee_call_stats
      (report_id, employee_id, total_logins, last_login, total_calls, total_incoming_calls, total_outgoing_calls, connected_calls, missed_calls)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_logins = VALUES(total_logins), last_login = VALUES(last_login), total_calls = VALUES(total_calls),
       total_incoming_calls = VALUES(total_incoming_calls), total_outgoing_calls = VALUES(total_outgoing_calls),
       connected_calls = VALUES(connected_calls), missed_calls = VALUES(missed_calls)`,
    [
      reportId,
      employeeId,
      totalLogins ?? null,
      toDateValue(lastLogin),
      totalCalls ?? null,
      totalIncomingCalls ?? null,
      totalOutgoingCalls ?? null,
      connectedCalls ?? null,
      missedCalls ?? null,
    ],
  );
}

async function saveTrainingStats(reportId, periodType, stats = {}, connection) {
  const db = connection || pool;
  await db.query(
    `INSERT INTO lms_training_stats (report_id, period_type, trainings_created, trainings_completed, assigned_users, completed_users)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       trainings_created = VALUES(trainings_created), trainings_completed = VALUES(trainings_completed),
       assigned_users = VALUES(assigned_users), completed_users = VALUES(completed_users)`,
    [reportId, periodType, stats.created ?? null, stats.completed ?? null, stats.assignedUsers ?? null, stats.completedUsers ?? null],
  );
}

async function saveElearningStats(reportId, periodType, stats = {}, connection) {
  const db = connection || pool;
  await db.query(
    `INSERT INTO lms_elearning_stats (report_id, period_type, active_courses, assigned_users, completed_users, in_progress_users)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       active_courses = VALUES(active_courses), assigned_users = VALUES(assigned_users),
       completed_users = VALUES(completed_users), in_progress_users = VALUES(in_progress_users)`,
    [reportId, periodType, stats.activeCourses ?? null, stats.assignedUsers ?? null, stats.completedUsers ?? null, stats.inProgressUsers ?? null],
  );
}

async function saveMyIbExtras(reportId, extras = {}) {
  await pool.query(
    `INSERT INTO myib_report_extras
      (report_id, last_login_count, itsm_tickets_created, travel_desk_requests, meeting_room_requests, gate_pass_requests, company_car_requests, leave_requests)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_login_count = VALUES(last_login_count), itsm_tickets_created = VALUES(itsm_tickets_created),
       travel_desk_requests = VALUES(travel_desk_requests), meeting_room_requests = VALUES(meeting_room_requests),
       gate_pass_requests = VALUES(gate_pass_requests), company_car_requests = VALUES(company_car_requests),
       leave_requests = VALUES(leave_requests)`,
    [
      reportId,
      extras.lastLoginCount ?? null,
      extras.itsmTicketsCreated ?? null,
      extras.travelDeskRequests ?? null,
      extras.meetingRoomRequests ?? null,
      extras.gatePassRequests ?? null,
      extras.companyCarRequests ?? null,
      extras.leaveRequests ?? null,
    ],
  );
}

module.exports = {
  ensureApplication,
  createReport,
  savePeriodMetrics,
  saveDailyMetrics,
  upsertEmployee,
  saveLoginHistoryEvent,
  saveEmployeeCallStats,
  saveTrainingStats,
  saveElearningStats,
  saveMyIbExtras,
};
