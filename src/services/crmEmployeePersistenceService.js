const pool = require('../config/database');
const { getWithProxyFallback } = require('../utils/httpClient');
const {
  ensureApplication,
  upsertEmployee,
  saveLoginHistoryEvent,
  saveEmployeeCallStats,
} = require('./dbPersistenceService');

// Login-history endpoints cap at 50/page by default but accept a `limit` param that
// returns everything in one call (verified live: limit=totalRecords -> totalPages=1).
// Capped defensively so an unusually wide date range can't request an unbounded page size.
const MAX_LOGIN_FETCH_LIMIT = 5000;

// Mirrors crmPersistenceService.js's MODULE_METADATA module_key mapping - duplicated
// locally (not imported) so this file stays fully independent of crmPersistenceService.js.
const MODULE_KEYS = {
  'Parivartan': 'parivartan',
  'Abis Pro (CRM)': 'abis_pro',
  'Traders CRM': 'traders',
  'Chicks CRM': 'chicks',
  'Doctor CRM': 'doctor',
};

function parseAbisProDateTime(value) {
  if (!value || typeof value !== 'string') return null;
  const [datePart, timePart] = value.split(' ');
  const [day, month, year] = (datePart || '').split('-');
  if (!day || !month || !year) return null;
  return `${year}-${month}-${day}${timePart ? 'T' + timePart : ''}`;
}

async function parseParivartan(raw, { startDate, endDate }) {
  const historyPayload = raw?.loginHistory?.data;
  if (!historyPayload) return { employees: [], loginEvents: [], callStats: [] };

  let records = historyPayload.records || [];
  if (historyPayload.totalPages > 1) {
    const total = historyPayload.total;
    const limit = Math.min(total, MAX_LOGIN_FETCH_LIMIT);
    if (total > MAX_LOGIN_FETCH_LIMIT) {
      console.warn(`[CRM employee persistence] Parivartan: ${total} records exceeds cap ${MAX_LOGIN_FETCH_LIMIT} - only first ${MAX_LOGIN_FETCH_LIMIT} will be persisted`);
    }
    const baseURL = process.env.CRM_PARIVARTAN_BASE_URL || 'https://crmapi.abisibg.com/api';
    const response = await getWithProxyFallback(`${baseURL}/admin/login-history`, {
      params: { startDate, endDate, limit },
      timeout: 30000,
    });
    records = response.data?.data?.records || records;
  }

  const employees = new Map();
  const loginEvents = [];
  records.forEach((r) => {
    if (!r.employee_id) return;
    employees.set(r.employee_id, {
      externalEmployeeId: r.employee_id,
      employeeName: r.employee_name || null,
      employeePhone: null,
      employeeEmail: null,
      roleName: r.employee_role_name || null,
    });
    loginEvents.push({
      externalEmployeeId: r.employee_id,
      loginTime: r.login_at,
      loginStatus: 'success', // Parivartan's login-history has no failure concept - every row is a real login
      loginType: r.platform || null,
      failureReason: null,
      ipAddress: r.ip_address || null,
      userAgent: null,
      externalRecordId: r.id != null ? String(r.id) : null,
      attemptedUsername: null,
    });
  });

  return { employees: Array.from(employees.values()), loginEvents, callStats: [] };
}

async function parseAbisPro(raw, { startDate, endDate }) {
  const employees = new Map();
  const callStatsMap = new Map();

  (raw?.loginStats?.data?.userLoginDetails || []).forEach((u) => {
    if (!u.employeeId) return;
    employees.set(u.employeeId, {
      externalEmployeeId: u.employeeId,
      employeeName: u.employeeName || null,
      employeePhone: null,
      employeeEmail: null,
      roleName: null,
    });
    callStatsMap.set(u.employeeId, {
      externalEmployeeId: u.employeeId,
      totalLogins: u.totalLogin ?? null,
      lastLogin: parseAbisProDateTime(u.lastLogin),
      totalCalls: u.calls?.totalCalls ?? null,
      totalIncomingCalls: u.calls?.totalIncomingCalls ?? null,
      totalOutgoingCalls: u.calls?.totalOutgoingCalls ?? null,
      connectedCalls: u.calls?.connectedCalls ?? null,
      missedCalls: u.calls?.missedCalls ?? null,
    });
  });

  const historyPayload = raw?.loginHistory;
  let records = Array.isArray(historyPayload?.data) ? historyPayload.data : [];
  if (historyPayload?.pagination?.totalPages > 1) {
    const total = historyPayload.pagination.totalRecords;
    const limit = Math.min(total, MAX_LOGIN_FETCH_LIMIT);
    if (total > MAX_LOGIN_FETCH_LIMIT) {
      console.warn(`[CRM employee persistence] Abis Pro: ${total} records exceeds cap ${MAX_LOGIN_FETCH_LIMIT} - only first ${MAX_LOGIN_FETCH_LIMIT} will be persisted`);
    }
    const baseURL = process.env.CRM_ABIS_PRO_BASE_URL || 'https://crm.abispro.api.abisibg.com/api';
    const response = await getWithProxyFallback(`${baseURL.replace('/api', '')}/api/reports/login-history`, {
      params: { startDate, endDate, limit },
      timeout: 30000,
    });
    records = Array.isArray(response.data?.data) ? response.data.data : records;
  }

  const loginEvents = [];
  records.forEach((r) => {
    if (!r.employeeId) return;
    const existing = employees.get(r.employeeId) || {
      externalEmployeeId: r.employeeId, employeeName: null, employeePhone: null, employeeEmail: null, roleName: null,
    };
    employees.set(r.employeeId, {
      ...existing,
      employeeName: r.employeeName || existing.employeeName,
      employeePhone: r.employeePhone || existing.employeePhone,
      employeeEmail: r.employeeMail || existing.employeeEmail,
    });
    loginEvents.push({
      externalEmployeeId: r.employeeId,
      loginTime: r.loginAtISO || r.loginAt,
      loginStatus: 'success', // Abis Pro's login-history has no failure concept - every row is a real login
      loginType: r.platform || null,
      failureReason: null,
      ipAddress: r.ipAddress || null,
      userAgent: null,
      externalRecordId: r.id != null ? String(r.id) : null,
      attemptedUsername: null,
    });
  });

  return { employees: Array.from(employees.values()), loginEvents, callStats: Array.from(callStatsMap.values()) };
}

async function parseTraders(raw, { startDate, endDate }) {
  const dataPayload = raw?.loginStats?.data;
  if (!dataPayload) return { employees: [], loginEvents: [], callStats: [] };

  let records = dataPayload.recentLogins || [];
  if (dataPayload.pagination?.totalPages > 1) {
    const total = dataPayload.pagination.totalRecords;
    const limit = Math.min(total, MAX_LOGIN_FETCH_LIMIT);
    if (total > MAX_LOGIN_FETCH_LIMIT) {
      console.warn(`[CRM employee persistence] Traders: ${total} records exceeds cap ${MAX_LOGIN_FETCH_LIMIT} - only first ${MAX_LOGIN_FETCH_LIMIT} will be persisted`);
    }
    const baseURL = process.env.CRM_TRADERS_BASE_URL || 'https://crm-trader-api.abisibg.com/api';
    const response = await getWithProxyFallback(`${baseURL}/reports/login-history-stats`, {
      params: { startDate, endDate, limit },
      timeout: 30000,
    });
    records = response.data?.data?.recentLogins || records;
  }

  const employees = new Map();
  const callStatsMap = new Map();
  const loginEvents = [];

  records.forEach((r) => {
    const emp = r.employee;
    if (!emp?.employeeId) return;
    employees.set(emp.employeeId, {
      externalEmployeeId: emp.employeeId,
      employeeName: emp.employeeName || null,
      employeePhone: emp.employeePhone || null,
      employeeEmail: emp.employeeMailId || null,
      roleName: emp.roleName || null,
    });

    if (emp.callStats) {
      // callStats numbers repeat identically on every row for this employee - only
      // lastLogin varies. Keep the max loginTime seen rather than "last processed",
      // since the array's order isn't something to rely on.
      const existing = callStatsMap.get(emp.employeeId);
      const candidateLastLogin = r.loginTime || null;
      const lastLogin = !existing || (candidateLastLogin && (!existing.lastLogin || candidateLastLogin > existing.lastLogin))
        ? candidateLastLogin
        : existing.lastLogin;
      callStatsMap.set(emp.employeeId, {
        externalEmployeeId: emp.employeeId,
        totalLogins: null, // not provided per-employee; only the module-wide total exists
        lastLogin,
        totalCalls: emp.callStats.totalCalls ?? null,
        totalIncomingCalls: emp.callStats.totalIncomingCalls ?? null,
        totalOutgoingCalls: emp.callStats.totalOutgoingCalls ?? null,
        connectedCalls: emp.callStats.connectedCalls ?? null,
        missedCalls: emp.callStats.missedCalls ?? null,
      });
    }

    loginEvents.push({
      externalEmployeeId: emp.employeeId,
      loginTime: r.loginTime,
      loginStatus: r.status || null,
      loginType: r.loginType || null,
      failureReason: null,
      ipAddress: r.ipAddress || null,
      userAgent: r.deviceInfo || null,
      externalRecordId: r.id != null ? String(r.id) : null,
      attemptedUsername: null,
    });
  });

  return { employees: Array.from(employees.values()), loginEvents, callStats: Array.from(callStatsMap.values()) };
}

function parseChicks(raw) {
  const employees = [];
  const loginEvents = [];

  (raw?.loginStats?.perUser || []).forEach((u) => {
    if (u.employeeId) {
      employees.push({
        externalEmployeeId: u.employeeId,
        employeeName: u.employeeName || null,
        employeePhone: u.employeePhone || null,
        employeeEmail: null,
        roleName: null,
      });
    }
    (u.loginHistory || []).forEach((h) => {
      loginEvents.push({
        externalEmployeeId: u.employeeId || null,
        loginTime: h.loginTime,
        loginStatus: h.loginStatus || null,
        loginType: h.loginType || null,
        failureReason: h.failureReason || null,
        ipAddress: h.ipAddress || null,
        userAgent: h.userAgent || null,
        externalRecordId: h.id != null ? String(h.id) : null,
        attemptedUsername: u.attemptedUsername || null, // fallback identity for unresolved failed logins
      });
    });
  });

  return { employees, loginEvents, callStats: [] };
}

function parseDoctor(raw) {
  const employees = [];
  const callStats = [];

  (raw?.loginStats?.data?.perUserStats || []).forEach((u) => {
    if (!u.employeeId) return;
    employees.push({
      externalEmployeeId: u.employeeId,
      employeeName: u.employeeName || null,
      employeePhone: u.employeePhone || null,
      employeeEmail: u.employeeMailId || null,
      roleName: null,
    });
    callStats.push({
      externalEmployeeId: u.employeeId,
      totalLogins: u.totalLogins ?? null,
      lastLogin: u.lastLogin || null,
      totalCalls: null,
      totalIncomingCalls: null,
      totalOutgoingCalls: null,
      connectedCalls: null,
      missedCalls: null,
    });
  });

  return { employees, loginEvents: [], callStats };
}

const PARSERS = {
  'Parivartan': parseParivartan,
  'Abis Pro (CRM)': parseAbisPro,
  'Traders CRM': parseTraders,
  'Chicks CRM': parseChicks,
  'Doctor CRM': parseDoctor,
};

const MODULE_NAMES = {
  'Parivartan': 'Parivartan CRM',
  'Abis Pro (CRM)': 'Abis Pro CRM',
  'Traders CRM': 'Traders CRM',
  'Chicks CRM': 'Chicks CRM',
  'Doctor CRM': 'Doctor CRM',
};

// Reuses the application_id + latest report_id that persistCrmAppReports() (called just
// before this, in crmAggregatorService.js) already created for this exact fetch - so
// employee/login-history rows attach to the same report as the period metrics, without
// this file needing to touch crmPersistenceService.js at all.
async function getLatestReportId(applicationId) {
  const [rows] = await pool.query(
    'SELECT id FROM app_reports WHERE application_id = ? ORDER BY id DESC LIMIT 1',
    [applicationId],
  );
  return rows[0]?.id || null;
}

// Takes the RAW per-module fetch results (Promise.allSettled output, before
// normalizeLoginData() runs) - the normalized appReports shape already drops fields
// for some modules (e.g. Abis Pro's loginHistory), so this reads straight from source.
//
// Expected to be called from within a try/catch by its caller (crmAggregatorService.js) -
// a thrown error here must never propagate into the CRM API response returned to the
// frontend. Each module is also individually wrapped so one module's failure doesn't
// stop the others from persisting.
async function persistCrmEmployeeData(moduleResults, { startDate, endDate } = {}) {
  for (const result of moduleResults) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    const raw = result.value;
    const parser = PARSERS[raw.app];
    const moduleKey = MODULE_KEYS[raw.app];
    if (!parser || !moduleKey) continue;

    try {
      const applicationId = await ensureApplication({
        moduleKey,
        moduleName: MODULE_NAMES[raw.app],
        appFamily: 'CRM',
      });

      const reportId = await getLatestReportId(applicationId);
      if (!reportId) continue; // persistCrmAppReports() hasn't created a report row yet - nothing to attach to

      const { employees, loginEvents, callStats } = await parser(raw, { startDate, endDate });

      const employeeIdMap = new Map();
      for (const emp of employees) {
        const internalId = await upsertEmployee({
          applicationId,
          externalEmployeeId: emp.externalEmployeeId,
          employeeName: emp.employeeName,
          employeePhone: emp.employeePhone,
          employeeEmail: emp.employeeEmail,
          roleName: emp.roleName,
        });
        if (internalId) employeeIdMap.set(emp.externalEmployeeId, internalId);
      }

      for (const event of loginEvents) {
        await saveLoginHistoryEvent({
          reportId,
          employeeId: employeeIdMap.get(event.externalEmployeeId) || null,
          attemptedUsername: event.attemptedUsername,
          loginTime: event.loginTime,
          loginStatus: event.loginStatus,
          loginType: event.loginType,
          failureReason: event.failureReason,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          externalRecordId: event.externalRecordId,
        });
      }

      for (const stat of callStats) {
        const internalId = employeeIdMap.get(stat.externalEmployeeId);
        if (!internalId) continue;
        await saveEmployeeCallStats({
          reportId,
          employeeId: internalId,
          totalLogins: stat.totalLogins,
          lastLogin: stat.lastLogin,
          totalCalls: stat.totalCalls,
          totalIncomingCalls: stat.totalIncomingCalls,
          totalOutgoingCalls: stat.totalOutgoingCalls,
          connectedCalls: stat.connectedCalls,
          missedCalls: stat.missedCalls,
        });
      }
    } catch (error) {
      console.error(`[CRM employee persistence] Failed for ${raw.app}: ${error.message}`);
    }
  }
}

module.exports = { persistCrmEmployeeData };
