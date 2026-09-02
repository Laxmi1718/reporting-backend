-- =====================================================================
-- IB Group - schema addition
-- Registers IB Group in report_applications so requireAppAccess(['ib_group'])
-- can grant non-Admin users access via user_application_access.
-- Admin users bypass this table entirely and already have access.
-- No persistence tables: this integration only surfaces the live snapshot,
-- matching the scope of the GRIM integration.
-- =====================================================================

USE reporting_dashboard;

ALTER TABLE report_applications
  MODIFY COLUMN app_family ENUM('LMS', 'CRM', 'MYIB', 'IBREMS', 'GRIM', 'IB_GROUP') NOT NULL;

INSERT INTO report_applications (app_family, module_key, module_name)
VALUES ('IB_GROUP', 'ib_group', 'IB Group')
ON DUPLICATE KEY UPDATE module_name = VALUES(module_name);
