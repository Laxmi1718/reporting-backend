-- =====================================================================
-- User Application Access - many-to-many between users and
-- report_applications. Governs which apps a User can call report APIs
-- for; Admin bypasses this table entirely (always full access).
--
-- "Full CRM access" is not a separate row here - it's a frontend/API
-- convenience that assigns all 5 CRM report_applications rows at once.
-- Enforcement only ever checks membership in this table, so full vs.
-- individual CRM access is indistinguishable to the backend by design.
-- =====================================================================

USE reporting_dashboard;

CREATE TABLE user_application_access (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED NOT NULL,
  application_id INT UNSIGNED NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_user_application UNIQUE (user_id, application_id),
  CONSTRAINT fk_uaa_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_uaa_application FOREIGN KEY (application_id) REFERENCES report_applications(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
