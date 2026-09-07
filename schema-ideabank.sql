-- =====================================================================
-- IdeaBank - schema addition
-- Registers IdeaBank in report_applications so requireAppAccess(['ideabank'])
-- can grant non-Admin users access via user_application_access.
-- Admin users bypass this table entirely and already have access.
-- No IdeaBank-specific persistence tables: the utilization-report response
-- (single-period totals) doesn't fit the existing current/previous-period
-- generic tables, matching the scope of the GRIM integration.
-- =====================================================================

USE reporting_dashboard;

ALTER TABLE report_applications
  MODIFY COLUMN app_family ENUM('LMS', 'CRM', 'MYIB', 'IBREMS', 'GRIM', 'IB_GROUP', 'AIO', 'IDEABANK') NOT NULL;

INSERT INTO report_applications (app_family, module_key, module_name)
VALUES ('IDEABANK', 'ideabank', 'IdeaBank')
ON DUPLICATE KEY UPDATE module_name = VALUES(module_name);
