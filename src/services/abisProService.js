const axios = require('axios');

function toAbisProMonthNumber(dateString) {
  if (!dateString) return null;
  const [year, month] = String(dateString).split('-');
  if (year && month) {
    return { month: Number(month), year: Number(year) };
  }
  return null;
}

async function fetchAbisProAnalytics({ month, year, fromDate, toDate, startDate, endDate } = {}) {
  const baseURL = process.env.ABISPRO_API_BASE_URL || 'https://prd-api.abispro.com';

  const effectiveFromDate = startDate || fromDate || null;
  const effectiveToDate = endDate || toDate || null;

  const activeMonth = effectiveToDate ? toAbisProMonthNumber(effectiveToDate)?.month : null;
  const activeYear = effectiveToDate ? toAbisProMonthNumber(effectiveToDate)?.year : null;
  const fallbackMonth = effectiveFromDate ? toAbisProMonthNumber(effectiveFromDate)?.month : null;
  const fallbackYear = effectiveFromDate ? toAbisProMonthNumber(effectiveFromDate)?.year : null;

  const resolvedMonth = Number(month ?? activeMonth ?? fallbackMonth ?? new Date().getMonth() + 1);
  const resolvedYear = Number(year ?? activeYear ?? fallbackYear ?? new Date().getFullYear());

  if (!baseURL) {
    const error = new Error('ABIS Pro API configuration is missing');
    error.statusCode = 500;
    throw error;
  }

  const url = `${baseURL.replace(/\/$/, '')}/services/v1/analytics.json`;

  try {
    const response = await axios.get(url, {
      params: {
        ...(effectiveFromDate && effectiveToDate ? { start_date: effectiveFromDate, end_date: effectiveToDate } : {}),
        ...(effectiveFromDate && effectiveToDate ? {} : { month: resolvedMonth, year: resolvedYear }),
      },
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    const status = error?.response?.status;
    const detail = status ? `HTTP ${status}` : (error?.code || error?.message || 'unknown error');
    console.error(`[ABIS Pro] analytics failed for ${effectiveFromDate || resolvedMonth}/${effectiveToDate || resolvedYear}: ${detail}`);
    throw error;
  }
}

module.exports = { fetchAbisProAnalytics, toAbisProMonthNumber };
