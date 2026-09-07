-- =====================================================================
-- AIO - schema addition
-- Registers AIO in report_applications so requireAppAccess(['aio'])
-- can grant non-Admin users access via user_application_access.
-- Admin users bypass this table entirely and already have access.
-- No persistence tables: this integration only surfaces the live
-- snapshot from scm-api.abisaio.com, matching the scope of the GRIM
-- and IB Group integrations.
-- =====================================================================

USE reporting_dashboard;

ALTER TABLE report_applications
  MODIFY COLUMN app_family ENUM('LMS', 'CRM', 'MYIB', 'IBREMS', 'GRIM', 'IB_GROUP', 'AIO') NOT NULL;

INSERT INTO report_applications (app_family, module_key, module_name)
VALUES ('AIO', 'aio', 'AIO')
ON DUPLICATE KEY UPDATE module_name = VALUES(module_name);
