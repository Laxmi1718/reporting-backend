-- =====================================================================
-- GRIM - schema addition
-- Registers GRIM in report_applications so requireAppAccess(['grim'])
-- can grant non-Admin users access via user_application_access.
-- Admin users bypass this table entirely and already have access.
-- No GRIM-specific persistence tables: the app_usage_stats response
-- (single-period totals + nested brill stats) doesn't fit the existing
-- current/previous-period generic tables, and GRIM persistence was not
-- part of this integration's scope.
-- =====================================================================

USE reporting_dashboard;

ALTER TABLE report_applications
  MODIFY COLUMN app_family ENUM('LMS', 'CRM', 'MYIB', 'IBREMS', 'GRIM') NOT NULL;

INSERT INTO report_applications (app_family, module_key, module_name)
VALUES ('GRIM', 'grim', 'GRIM')
ON DUPLICATE KEY UPDATE module_name = VALUES(module_name);
