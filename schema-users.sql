-- =====================================================================
-- Reporting Dashboard authentication - users table
-- Status: PROPOSAL ONLY - NOT YET EXECUTED, NOT YET APPROVED FOR RUN
-- Login identity is the MyIB Employee ID (8 digits, unique). Password is
-- a Reporting-Dashboard-only credential (bcrypt hash), unrelated to
-- whatever password the same employee uses in MyIB.
-- =====================================================================

USE reporting_dashboard;

CREATE TABLE users (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id    CHAR(8)      NOT NULL,
  password_hash  VARCHAR(60)  NOT NULL,
  role           ENUM('Admin', 'User') NOT NULL DEFAULT 'User',
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_employee_id UNIQUE (employee_id),
  CONSTRAINT chk_users_employee_id_format CHECK (employee_id REGEXP '^[0-9]{8}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- Notes
-- - employee_id is CHAR(8), not INT: it's an identity/login string, not
--   a quantity, and CHAR preserves any leading zero instead of silently
--   dropping it the way an integer type would.
-- - password_hash is VARCHAR(60): bcrypt output is always exactly 60
--   characters, so this is a precise fit, not an arbitrary limit.
-- - role has no third value and no default that bypasses the two roles;
--   DEFAULT 'User' only matters if a row is ever inserted without an
--   explicit role, which the seed script below never does.
-- - No name/email/status columns: nothing beyond what was asked for.
-- - Nothing above has been executed against the database yet.
-- =====================================================================
