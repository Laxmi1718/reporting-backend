const { fetchParivartanReport } = require('./parivartanService');
const { fetchAbisProCrmReport } = require('./abisProCrmService');
const { fetchTradersCrmReport } = require('./tradersCrmService');
const { fetchChicksCrmReport } = require('./chicksCrmService');
const { fetchDoctorCrmReport } = require('./doctorCrmService');
const { persistCrmAppReports } = require('./crmPersistenceService');
const { persistCrmEmployeeData } = require('./crmEmployeePersistenceService');

// Runs the two persistence steps in the background, in order, without blocking
// the caller. persistCrmAppReports() already catches its own per-module errors
// (it "never throws" by design) - these try/catches are defense-in-depth, kept
// identical to what previously guarded the awaited calls.
async function persistCrmInBackground(appReports, results, { startDate, endDate }) {
  try {
    await persistCrmAppReports(appReports, { startDate, endDate });
  } catch (error) {
    console.error(`[DB persistence] CRM persistence step failed: ${error.message}`);
  }

  try {
    await persistCrmEmployeeData(results, { startDate, endDate });
  } catch (error) {
    console.error(`[DB persistence] CRM employee persistence step failed: ${error.message}`);
  }
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  if (!value) return null;

  if (typeof value === 'object') {
    const nested = value.login_at || value.loginAt || value.date || value.created_at || value.createdAt;
    return normalizeDate(nested);
  }

  if (typeof value === 'string' && value.includes('/')) {
    const [day, month, year] = value.split('/');
    if (day && month && year) {
      return `${year}-${month}-${day}`;
    }
  }

  return value;
}

function parseAwareNumber(value) {
  if (Array.isArray(value)) {
    return safeNumber(value[0]);
  }
  return safeNumber(value);
}

function parsePercent(value) {
  if (Array.isArray(value)) {
    return parsePercent(value[0]);
  }
  if (typeof value === 'string') {
    return safeNumber(value.replace('%', '').trim());
  }
  return safeNumber(value);
}

function normalizeDateRange(range) {
  if (!range || typeof range !== 'object') return null;
  const from = range.from ?? range.startDate ?? range.start ?? null;
  const to = range.to ?? range.endDate ?? range.end ?? null;
  if (!from && !to) return null;
  return { from, to };
}

function normalizeLoginData(source, appName, requestedDateRange) {
  const payload = (source && source.data && typeof source.data === 'object' && !Array.isArray(source.data))
    ? source.data
    : source || {};

  const current = payload.currentPeriod || payload.current || payload.summary || payload;
  const previousContainer = payload.previousPeriod || payload.previous || payload.comparison?.previousPeriod || null;
  const previous = previousContainer?.summary || previousContainer || {};

  const currentTotalUsers = parseAwareNumber(current.totalUsers ?? current.total_users ?? current.users ?? current.userCount ?? current.totalUserCount ?? current.totalUsersCount ?? current.totalRegisteredEmployees ?? current.totalRegisteredUsers ?? current.employeeStats?.total ?? payload.totalUsers ?? payload.users);
  const currentUniqueUsers = parseAwareNumber(current.uniqueUsers ?? current.unique_users ?? current.activeUsers ?? current.uniqueUserCount ?? current.activeUserCount ?? current.userCount ?? payload.activeUsers ?? payload.uniqueUsers ?? payload.uniqueUserCount);
  const currentTotalLogins = parseAwareNumber(current.totalLogins ?? current.totalLogin ?? current.total_logins ?? current.loginCount ?? current.totalLoginCount ?? current.loginCountTotal ?? payload.totalLogins ?? payload.totalLogin ?? payload.totalLoginCount ?? payload.total_login ?? payload.logins);
  const currentLastLogin = normalizeDate(current.lastLogin ?? current.lastLoginOverall ?? current.last_login ?? current.latestLogin ?? current.lastLoginDate ?? current.login_at ?? payload.lastLogin ?? payload.last_login ?? payload.lastLoginDate ?? payload.lastLoginAt ?? payload.login_at ?? payload.loginAt);
  const currentAverageActiveUsersPerDay = parseAwareNumber(current.averageActiveUsersPerDay ?? current.avgActiveUsersPerDay ?? current.averageActiveUsersPerDayCount ?? current.averageDailyActiveUsers ?? payload.avgActiveUsersPerDay ?? payload.averageActiveUsersPerDay ?? payload.activeUsersPerDay ?? payload.avgActiveUsersPerDayCount);
  const currentLoginAverageRaw = typeof current.loginAverage === 'object' && current.loginAverage !== null
    ? current.loginAverage.perActiveUser
    : current.loginAverage;
  const currentLoginAveragePerUser = parseAwareNumber(current.loginAveragePerUser ?? current.avgLoginsPerUser ?? currentLoginAverageRaw ?? current.loginsPerUser ?? payload.loginAverage ?? payload.loginAveragePerUser ?? payload.avgLoginsPerUser);
  const currentUtilization = parsePercent(current.utilizationPerDay ?? current.utilization ?? current.utilizationPerDayAverage ?? current.overallUtilization ?? payload.utilizationPerDay ?? payload.utilization ?? payload.utilizationPerDayAverage);

  const previousTotalUsers = parseAwareNumber(previous.totalUsers ?? previous.total_users ?? previous.users ?? previous.userCount ?? previous.totalUsersCount ?? previous.totalRegisteredUsers ?? previous.employeeStats?.total);
  const previousUniqueUsers = parseAwareNumber(previous.uniqueUsers ?? previous.unique_users ?? previous.activeUsers ?? previous.uniqueUserCount ?? previous.userCount ?? previous.activeUserCount);
  const previousTotalLogins = parseAwareNumber(previous.totalLogins ?? previous.total_logins ?? previous.loginCount ?? previous.totalLoginCount ?? previous.totalLogin);
  const previousLastLogin = normalizeDate(previous.lastLogin ?? previous.last_login ?? previous.latestLogin ?? previous.lastLoginDate ?? previous.login_at);
  const previousAverageActiveUsersPerDay = parseAwareNumber(previous.averageActiveUsersPerDay ?? previous.avgActiveUsersPerDay ?? previous.averageDailyActiveUsers);
  const previousLoginAverageRaw = typeof previous.loginAverage === 'object' && previous.loginAverage !== null
    ? previous.loginAverage.perActiveUser
    : previous.loginAverage;
  const previousLoginAveragePerUser = parseAwareNumber(previous.loginAveragePerUser ?? previous.avgLoginsPerUser ?? previousLoginAverageRaw);

  // employeeStats.total is the real headcount (active + inactive) - it takes priority
  // over totalRegisteredUsers/totalRegisteredEmployees, which describe login-capable
  // users and can differ from raw headcount (e.g. Traders CRM: 42 registered vs 52 total).
  const currentTotalEmployees = parseAwareNumber(current.totalEmployees ?? current.employeeStats?.total ?? current.totalRegisteredEmployees ?? current.totalRegisteredUsers ?? payload.totalEmployees);
  const currentTotalActiveEmployees = parseAwareNumber(current.totalActiveEmployees ?? current.employeeStats?.active ?? payload.totalActiveEmployees);
  const currentTotalInactiveEmployees = parseAwareNumber(current.totalInactiveEmployees ?? current.employeeStats?.inactive ?? payload.totalInactiveEmployees);
  const previousTotalEmployees = parseAwareNumber(previous.totalEmployees ?? previous.employeeStats?.total ?? previous.totalRegisteredUsers);
  const previousTotalActiveEmployees = parseAwareNumber(previous.totalActiveEmployees ?? previous.employeeStats?.active);
  const previousTotalInactiveEmployees = parseAwareNumber(previous.totalInactiveEmployees ?? previous.employeeStats?.inactive);

  const CALL_FIELDS = [
    'totalCalls',
    'totalIncomingCalls',
    'totalOutgoingCalls',
    'connectedCalls',
    'missedCalls',
    'connectedIncomingCalls',
    'missedIncomingCalls',
    'connectedOutgoingCalls',
    'missedOutgoingCalls',
  ];

  function readCallField(period, field) {
    if (period[field] !== undefined) return period[field];
    if (period.callStats?.[field] !== undefined) return period.callStats[field];

    const breakdown = period.callMetrics?.breakdown || {};
    switch (field) {
      case 'totalIncomingCalls':
        return period.callMetrics?.totalIncomingCalls ?? breakdown.incoming?.total;
      case 'totalOutgoingCalls':
        return period.callMetrics?.totalOutgoingCalls ?? breakdown.outgoing?.total;
      case 'connectedIncomingCalls':
        return breakdown.incoming?.connected;
      case 'missedIncomingCalls':
        return breakdown.incoming?.missed;
      case 'connectedOutgoingCalls':
        return breakdown.outgoing?.connected;
      case 'missedOutgoingCalls':
        return breakdown.outgoing?.missed;
      default:
        return period.callMetrics?.[field];
    }
  }

  const currentCallMetrics = {};
  const previousCallMetrics = {};
  CALL_FIELDS.forEach((field) => {
    // Leave unresolved fields as null (not 0) - the frontend treats null as "no data"
    // for card display and as 0 for comparison math, so a failed/unavailable fetch
    // doesn't masquerade as genuine zero call activity.
    currentCallMetrics[field] = parseAwareNumber(readCallField(current, field));
    previousCallMetrics[field] = parseAwareNumber(readCallField(previous, field));
  });

  return {
    app: appName,
    currentPeriod: {
      totalUsers: currentTotalUsers,
      uniqueUsers: currentUniqueUsers,
      totalLogins: currentTotalLogins,
      lastLogin: currentLastLogin,
      averageActiveUsersPerDay: currentAverageActiveUsersPerDay,
      loginAveragePerUser: currentLoginAveragePerUser,
      utilizationPerDay: currentUtilization,
      totalEmployees: currentTotalEmployees,
      totalActiveEmployees: currentTotalActiveEmployees,
      totalInactiveEmployees: currentTotalInactiveEmployees,
      dateRange: normalizeDateRange(current.dateRange || payload.dateRange) || normalizeDateRange(requestedDateRange) || null,
      ...currentCallMetrics,
    },
    previousPeriod: {
      totalUsers: previousTotalUsers,
      uniqueUsers: previousUniqueUsers,
      totalLogins: previousTotalLogins,
      lastLogin: previousLastLogin,
      averageActiveUsersPerDay: previousAverageActiveUsersPerDay,
      loginAveragePerUser: previousLoginAveragePerUser,
      totalEmployees: previousTotalEmployees,
      totalActiveEmployees: previousTotalActiveEmployees,
      totalInactiveEmployees: previousTotalInactiveEmployees,
      dateRange: normalizeDateRange(previous.dateRange || previousContainer),
      ...previousCallMetrics,
    },
    dailyData: Array.isArray(payload.dailyData || payload.dailyDataTrend || payload.trend || payload.dailyTrend || payload.utilizationPerDay || payload.utilizationPerDayBreakdown)
      ? (payload.dailyData || payload.dailyDataTrend || payload.trend || payload.dailyTrend || payload.utilizationPerDay || payload.utilizationPerDayBreakdown)
      : [],
    raw: payload,
  };
}

const CALL_METRIC_FIELDS = [
  'totalCalls',
  'totalIncomingCalls',
  'totalOutgoingCalls',
  'connectedCalls',
  'missedCalls',
  'connectedIncomingCalls',
  'missedIncomingCalls',
  'connectedOutgoingCalls',
  'missedOutgoingCalls',
];

function aggregatePeriod(valid, periodKey) {
  const totalUsers = valid.reduce((sum, item) => sum + (Number(item[periodKey]?.totalUsers) || 0), 0);
  const uniqueUsers = valid.reduce((sum, item) => sum + (Number(item[periodKey]?.uniqueUsers) || 0), 0);
  const totalLogins = valid.reduce((sum, item) => sum + (Number(item[periodKey]?.totalLogins) || 0), 0);
  const averageActiveUsersPerDay = valid.reduce((sum, item) => sum + (Number(item[periodKey]?.averageActiveUsersPerDay) || 0), 0);
  const totalEmployees = valid.reduce((sum, item) => sum + (Number(item[periodKey]?.totalEmployees) || 0), 0);
  const totalActiveEmployees = valid.reduce((sum, item) => sum + (Number(item[periodKey]?.totalActiveEmployees) || 0), 0);
  const totalInactiveEmployees = valid.reduce((sum, item) => sum + (Number(item[periodKey]?.totalInactiveEmployees) || 0), 0);
  const loginAveragePerUser = valid.length ? totalLogins / Math.max(totalUsers, 1) : null;

  const lastLoginValues = valid
    .map((item) => item[periodKey]?.lastLogin)
    .filter(Boolean)
    .sort();

  const callMetrics = {};
  CALL_METRIC_FIELDS.forEach((field) => {
    callMetrics[field] = valid.reduce((sum, item) => sum + (Number(item[periodKey]?.[field]) || 0), 0);
  });

  const dateRanges = valid.map((item) => item[periodKey]?.dateRange).filter(Boolean);

  return {
    totalUsers,
    uniqueUsers,
    totalLogins,
    lastLogin: lastLoginValues.length ? lastLoginValues[lastLoginValues.length - 1] : null,
    averageActiveUsersPerDay: Number(averageActiveUsersPerDay.toFixed(2)),
    loginAveragePerUser: loginAveragePerUser == null ? null : Number(loginAveragePerUser.toFixed(2)),
    totalEmployees,
    totalActiveEmployees,
    totalInactiveEmployees,
    dateRange: dateRanges[0] || null,
    ...callMetrics,
  };
}

function aggregateMetrics(appReports) {
  const valid = appReports.filter((item) => item && item.currentPeriod);

  const overall = aggregatePeriod(valid, 'currentPeriod');
  const overallPrevious = aggregatePeriod(valid, 'previousPeriod');

  const dailyData = [];
  valid.forEach((item) => {
    if (!Array.isArray(item.dailyData)) return;
    item.dailyData.forEach((entry) => {
      const match = dailyData.find((row) => row.label === entry.label || row.date === entry.date);
      const entryActiveUsers = Number(entry.activeUsers ?? entry.uniqueUsers) || 0;
      const entryLogins = Number(entry.logins ?? entry.totalLogins ?? entry.loginCount) || 0;
      if (match) {
        match.logins = (Number(match.logins) || 0) + entryLogins;
        match.uniqueUsers = (Number(match.uniqueUsers) || 0) + entryActiveUsers;
        match.activeUsers = match.uniqueUsers;
      } else {
        dailyData.push({
          label: entry.label || entry.date || 'N/A',
          logins: entryLogins,
          uniqueUsers: entryActiveUsers,
          activeUsers: entryActiveUsers,
        });
      }
    });
  });

  return {
    overall,
    overallPrevious,
    dailyData,
    applications: valid.map((item) => ({
      app: item.app,
      totalUsers: item.currentPeriod.totalUsers,
      uniqueUsers: item.currentPeriod.uniqueUsers,
      totalLogins: item.currentPeriod.totalLogins,
      lastLogin: item.currentPeriod.lastLogin,
      averageActiveUsersPerDay: item.currentPeriod.averageActiveUsersPerDay,
      loginAveragePerUser: item.currentPeriod.loginAveragePerUser,
      totalEmployees: item.currentPeriod.totalEmployees,
      totalActiveEmployees: item.currentPeriod.totalActiveEmployees,
      totalInactiveEmployees: item.currentPeriod.totalInactiveEmployees,
      ...CALL_METRIC_FIELDS.reduce((acc, field) => {
        acc[field] = item.currentPeriod[field];
        return acc;
      }, {}),
    })),
  };
}

// Mirrors crmEmployeePersistenceService.js's date conversion for Abis Pro's
// "DD-MM-YYYY HH:mm:ss" login timestamps - duplicated locally (not imported)
// so this file stays fully independent of that persistence-only module.
function parseAbisProDateTime(value) {
  if (!value || typeof value !== 'string') return null;
  const [datePart, timePart] = value.split(' ');
  const [day, month, year] = (datePart || '').split('-');
  if (!day || !month || !year) return null;
  return `${year}-${month}-${day}${timePart ? 'T' + timePart : ''}`;
}

// Pulls real per-login {date, employeeId} events out of each module's raw
// upstream payload (already fetched for the main report - no extra calls),
// so quarterly/yearly chart totals can be computed from actual records
// instead of dividing an aggregate. Shapes verified against the parsers in
// crmEmployeePersistenceService.js. Doctor CRM's upstream API has no
// per-login timestamp anywhere - returns null (not []) to distinguish
// "no data available" from "zero real events this range".
function extractLoginEvents(report) {
  switch (report.app) {
    case 'Parivartan': {
      const records = report.loginHistory?.data?.records || [];
      return records
        .filter((r) => r.employee_id && r.login_at)
        .map((r) => ({ date: r.login_at, employeeId: String(r.employee_id) }));
    }
    case 'Abis Pro (CRM)': {
      const records = Array.isArray(report.loginHistory?.data) ? report.loginHistory.data : [];
      return records
        .filter((r) => r.employeeId && (r.loginAtISO || r.loginAt))
        .map((r) => ({ date: r.loginAtISO || parseAbisProDateTime(r.loginAt), employeeId: String(r.employeeId) }))
        .filter((r) => r.date);
    }
    case 'Traders CRM': {
      const records = report.loginStats?.data?.recentLogins || [];
      return records
        .filter((r) => r.employee?.employeeId && r.loginTime)
        .map((r) => ({ date: r.loginTime, employeeId: String(r.employee.employeeId) }));
    }
    case 'Chicks CRM': {
      const events = [];
      (report.loginStats?.perUser || []).forEach((u) => {
        (u.loginHistory || []).forEach((h) => {
          if (u.employeeId && h.loginTime) events.push({ date: h.loginTime, employeeId: String(u.employeeId) });
        });
      });
      return events;
    }
    default:
      return null;
  }
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Calendar-quarter buckets clipped to [startDate, endDate], with each label
// derived from the CLIPPED boundaries - not the full calendar quarter - so a
// range ending mid-quarter reads e.g. "Jul - Aug '26", never "Jul - Sep '26".
function buildQuarterlyBuckets(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59.999`);
  const buckets = [];

  let cursorYear = start.getFullYear();
  let cursorMonth = Math.floor(start.getMonth() / 3) * 3;

  while (new Date(cursorYear, cursorMonth, 1) <= end) {
    const quarterStart = new Date(cursorYear, cursorMonth, 1);
    const quarterEnd = new Date(cursorYear, cursorMonth + 3, 0, 23, 59, 59, 999);
    const bucketStart = quarterStart < start ? start : quarterStart;
    const bucketEnd = quarterEnd > end ? end : quarterEnd;

    const startMonth = MONTH_NAMES[bucketStart.getMonth()];
    const endMonth = MONTH_NAMES[bucketEnd.getMonth()];
    const yearSuffix = String(bucketStart.getFullYear()).slice(-2);
    const label = startMonth === endMonth ? `${startMonth} '${yearSuffix}` : `${startMonth} - ${endMonth} '${yearSuffix}`;

    buckets.push({ label, startDate: toISODate(bucketStart), endDate: toISODate(bucketEnd), rangeStart: bucketStart, rangeEnd: bucketEnd });

    cursorMonth += 3;
    if (cursorMonth >= 12) { cursorMonth -= 12; cursorYear += 1; }
  }

  return buckets;
}

// Builds real per-quarter Login Trend/Active Users from actual login events -
// never a division of an overall total. activeUsers is a per-bucket Set of
// employeeIds, so the same employee active in two quarters counts once in each.
function buildQuarterlyTrend(events, startDate, endDate) {
  if (!events) return null;

  const buckets = buildQuarterlyBuckets(startDate, endDate).map((b) => ({ ...b, totalLogins: 0, activeUserIds: new Set() }));

  events.forEach((event) => {
    if (!event?.date) return;
    const eventDate = new Date(event.date);
    if (Number.isNaN(eventDate.getTime())) return;
    const bucket = buckets.find((b) => eventDate >= b.rangeStart && eventDate <= b.rangeEnd);
    if (!bucket) return;
    bucket.totalLogins += 1;
    if (event.employeeId) bucket.activeUserIds.add(event.employeeId);
  });

  return buckets.map((b) => ({ label: b.label, startDate: b.startDate, endDate: b.endDate, totalLogins: b.totalLogins, activeUsers: b.activeUserIds.size }));
}

// Combined CRM-overview quarterly trend: every module builds buckets from the
// same startDate/endDate, so buckets line up positionally by construction -
// sum totalLogins/activeUsers across modules that have real data (quarterlyTrend
// is an array); a module without data (Doctor CRM: null) is excluded from the
// sum, never treated as a genuine zero.
function buildCombinedQuarterlyTrend(appReports, startDate, endDate) {
  const withData = appReports.filter((r) => Array.isArray(r.quarterlyTrend));
  if (!withData.length) return null;

  return buildQuarterlyBuckets(startDate, endDate).map((bucket, index) => {
    let totalLogins = 0;
    let activeUsers = 0;
    withData.forEach((report) => {
      const entry = report.quarterlyTrend[index];
      if (!entry) return;
      totalLogins += Number(entry.totalLogins) || 0;
      activeUsers += Number(entry.activeUsers) || 0;
    });
    return { label: bucket.label, startDate: bucket.startDate, endDate: bucket.endDate, totalLogins, activeUsers };
  });
}

async function fetchCrmOverallReport({ startDate, endDate, allowedAppLabels }) {
  const sources = [
    fetchParivartanReport({ startDate, endDate }),
    fetchAbisProCrmReport({ startDate, endDate }),
    fetchTradersCrmReport({ startDate, endDate }),
    fetchChicksCrmReport({ startDate, endDate }),
    fetchDoctorCrmReport({ startDate, endDate }),
  ];

  const results = await Promise.allSettled(sources);

  const appReports = results.map((result) => {
    if (result.status === 'fulfilled' && result.value) {
      const report = result.value;
      // loginStats and loginHistory come from separate upstream calls with different
      // shapes - never substitute one for the other, or call/login fields silently
      // resolve to 0 (looking like real zero-activity data) instead of "unavailable".
      const statsSource = report.loginStats?.data || report.loginStats || null;
      const normalized = normalizeLoginData(statsSource || {}, report.app, { startDate, endDate });
      const loginHistory = Array.isArray(report.loginHistory?.data?.records)
        ? report.loginHistory.data.records
        : Array.isArray(report.loginHistory?.records)
          ? report.loginHistory.records
          : [];

      return {
        app: report.app,
        ...normalized,
        loginHistory,
        quarterlyTrend: buildQuarterlyTrend(extractLoginEvents(report), startDate, endDate),
        unavailable: !!report.error || !statsSource,
      };
    }
    return null;
  }).filter(Boolean);

  // Persist to MySQL as a side effect only - never allowed to alter or block the
  // response the dashboard receives. Fired without awaiting: with hundreds of
  // per-employee/login-history rows across 5 modules, this was measured taking
  // several seconds of pure sequential DB round-trips that had nothing to do with
  // building the response, so the response no longer waits on it. Employee/login-
  // history persistence still runs strictly after persistCrmAppReports() internally
  // (it looks up the report_id that step creates) - only the ordering relative to
  // the HTTP response changed, not the ordering between the two persistence steps.
  persistCrmInBackground(appReports, results, { startDate, endDate });

  // allowedAppLabels restricts everything derived below (aggregate totals,
  // daily trend, per-module breakdown) to a User's assigned CRM modules.
  // Persistence above already ran against the full, unfiltered appReports -
  // what a given caller is allowed to see must never affect what gets
  // written to the database.
  const visibleAppReports = allowedAppLabels
    ? appReports.filter((report) => allowedAppLabels.has(report.app))
    : appReports;

  const aggregated = aggregateMetrics(visibleAppReports);

  const previousDateRange = aggregated.overallPrevious.dateRange;

  return {
    success: true,
    app: 'CRM',
    currentPeriod: {
      ...aggregated.overall,
      reportPeriod: `${startDate} - ${endDate}`,
    },
    previousPeriod: {
      ...aggregated.overallPrevious,
      reportPeriod: previousDateRange ? `${previousDateRange.from} - ${previousDateRange.to}` : 'Previous Period',
    },
    dailyData: aggregated.dailyData,
    quarterlyTrend: buildCombinedQuarterlyTrend(visibleAppReports, startDate, endDate),
    applications: aggregated.applications,
    appReports: visibleAppReports,
  };
}

module.exports = {
  fetchCrmOverallReport,
};
