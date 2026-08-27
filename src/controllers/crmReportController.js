const { fetchCrmOverallReport } = require('../services/crmAggregatorService');
const { getUserModuleKeys } = require('../services/applicationAccessService');

// Mirrors crmPersistenceService.js's MODULE_METADATA key->app mapping - the
// `app` label on each appReports/applications entry is one of these values,
// not the report_applications.module_key.
const MODULE_KEY_TO_APP_LABEL = {
  parivartan: 'Parivartan',
  abis_pro: 'Abis Pro (CRM)',
  traders: 'Traders CRM',
  chicks: 'Chicks CRM',
  doctor: 'Doctor CRM',
};

async function getCrmReport(req, res) {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'startDate and endDate are required',
    });
  }

  try {
    let allowedAppLabels;
    if (req.user?.role !== 'Admin') {
      const moduleKeys = await getUserModuleKeys(req.user.id);
      allowedAppLabels = new Set(moduleKeys.map((key) => MODULE_KEY_TO_APP_LABEL[key]).filter(Boolean));
    }

    const result = await fetchCrmOverallReport({ startDate, endDate, allowedAppLabels });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load CRM report',
      apps: [],
    });
  }
}

module.exports = { getCrmReport };
