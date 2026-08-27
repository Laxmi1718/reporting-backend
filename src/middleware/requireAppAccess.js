const { hasAnyModuleAccess } = require('../services/applicationAccessService');

// Admin always passes. A User needs at least one of moduleKeys assigned -
// this is deliberately "any", not "all": it's what lets a single CRM
// vendor grant (e.g. just Traders CRM) unlock the one /api/crm route
// that covers all 5 vendors. Per-vendor filtering of the CRM response
// body happens separately, inside crmReportController.
function requireAppAccess(moduleKeys) {
  return async function (req, res, next) {
    if (req.user?.role === 'Admin') return next();

    try {
      const allowed = await hasAnyModuleAccess(req.user?.id, moduleKeys);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this application',
        });
      }
      return next();
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to verify application access' });
    }
  };
}

module.exports = requireAppAccess;
