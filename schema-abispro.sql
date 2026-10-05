-- ABIS Pro - schema addition
-- Registers ABIS Pro in report_applications so requireAppAccess(['abispro'])
-- can match a real application row in the database.

ALTER TABLE report_applications
  MODIFY COLUMN app_family ENUM(
    'LMS',
    'CRM',
    'MYIB',
    'IBREMS',
    'GRIM',
    'IB_GROUP',
    'AIO',
    'IDEABANK',
    'ABISPRO'
  ) NOT NULL;

INSERT INTO report_applications (app_family, module_key, module_name)
VALUES ('ABISPRO', 'abispro', 'ABIS Pro')
ON DUPLICATE KEY UPDATE
  module_name = VALUES(module_name);
