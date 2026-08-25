-- =====================================================================
-- Reporting Dashboard - Proposed MySQL 8+ Schema
-- Database: reporting_dashboard
-- Status: PROPOSAL ONLY - NOT YET EXECUTED, NOT YET APPROVED FOR RUN
-- Covers: LMS, 5 CRM modules (Parivartan/Abis Pro/Traders/Chicks/Doctor), MyIB
-- =====================================================================

USE reporting_dashboard;

-- ---------------------------------------------------------------------
-- 1. report_applications
-- Lookup table for all 7 apps. Capability flags encode which extension
-- tables/columns each app actually populates (see inspection notes).
-- ---------------------------------------------------------------------
CREATE TABLE report_applications (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  app_family           ENUM('LMS', 'CRM', 'MYIB') NOT NULL,
  module_key           VARCHAR(30)  NOT NULL,
  module_name          VARCHAR(100) NOT NULL,
  has_previous_period  TINYINT(1)   NOT NULL DEFAULT 1,
  has_employee_stats   TINYINT(1)   NOT NULL DEFAULT 0,
  has_call_stats       TINYINT(1)   NOT NULL DEFAULT 0,
  has_service_requests TINYINT(1)   NOT NULL DEFAULT 0,
  has_training_stats   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_module_key UNIQUE (module_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 2. app_reports
-- One row per (application, fetch). requested_start_date/end_date are
-- NULL for MyIB (single anchor date + Period, not a range).
-- ---------------------------------------------------------------------
CREATE TABLE app_reports (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id        INT UNSIGNED NOT NULL,
  requested_start_date  DATE NULL,
  requested_end_date    DATE NULL,
  report_update_date    VARCHAR(20) NULL,
  period_param          VARCHAR(20) NULL,
  source_last_update_at DATETIME NULL,
  fetched_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raw_response          JSON NULL,
  CONSTRAINT fk_reports_app FOREIGN KEY (application_id)
    REFERENCES report_applications(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_app_dates (application_id, requested_start_date, requested_end_date),
  INDEX idx_fetched_at (fetched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 3. crm_employees
-- CRM-only. Stores full employee identity as approved, scoped per
-- application (external_employee_id is not assumed globally unique
-- across the 5 different upstream CRM systems).
-- ---------------------------------------------------------------------
CREATE TABLE crm_employees (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id        INT UNSIGNED NOT NULL,
  external_employee_id  BIGINT NOT NULL,
  employee_name         VARCHAR(255) NULL,
  employee_phone        VARCHAR(20) NULL,
  employee_email        VARCHAR(255) NULL,
  role_name             VARCHAR(50) NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_employee_app FOREIGN KEY (application_id)
    REFERENCES report_applications(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT uq_app_employee UNIQUE (application_id, external_employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 4. app_period_metrics
-- Core normalized numbers shared by all 7 apps - one row per
-- current/previous period per report. NULL means "this app does not
-- report this metric" (not zero) - mirrors normalizeLoginData() in code.
-- ---------------------------------------------------------------------
CREATE TABLE app_period_metrics (
  id                             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id                      BIGINT UNSIGNED NOT NULL,
  period_type                    ENUM('current', 'previous') NOT NULL,
  period_start                   DATE NULL,
  period_end                     DATE NULL,
  report_period_label            VARCHAR(100) NULL,

  total_users                    INT NULL,
  unique_users                   INT NULL,
  total_logins                   INT NULL,
  new_logins                     INT NULL,
  last_login                     DATETIME NULL,
  average_active_users_per_day   DECIMAL(10,2) NULL,
  login_average_per_user         DECIMAL(10,2) NULL,
  utilization_per_day            DECIMAL(10,2) NULL,

  total_employees                INT NULL,
  total_active_employees         INT NULL,
  total_inactive_employees       INT NULL,

  total_calls                    INT NULL,
  total_incoming_calls           INT NULL,
  total_outgoing_calls           INT NULL,
  connected_calls                INT NULL,
  missed_calls                   INT NULL,
  connected_incoming_calls       INT NULL,
  missed_incoming_calls          INT NULL,
  connected_outgoing_calls       INT NULL,
  missed_outgoing_calls          INT NULL,

  created_at                     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_metrics_report FOREIGN KEY (report_id)
    REFERENCES app_reports(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_report_period UNIQUE (report_id, period_type),
  INDEX idx_period_dates (period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 5. app_daily_metrics
-- Per-day breakdown for charts. Populated by Abis Pro, Traders, Doctor
-- CRM (real daily arrays). Parivartan, Chicks, MyIB have no rows here.
-- ---------------------------------------------------------------------
CREATE TABLE app_daily_metrics (
  id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id               BIGINT UNSIGNED NOT NULL,
  metric_date             DATE NOT NULL,
  logins                  INT NULL,
  active_users            INT NULL,
  total_calls             INT NULL,
  incoming_calls          INT NULL,
  outgoing_calls          INT NULL,
  connected_calls         INT NULL,
  missed_calls            INT NULL,
  utilization_percentage  DECIMAL(10,2) NULL,
  CONSTRAINT fk_daily_report FOREIGN KEY (report_id)
    REFERENCES app_reports(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_report_date UNIQUE (report_id, metric_date),
  INDEX idx_metric_date (metric_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 6. crm_login_history
-- CRM-only. Individual login events. employee_id is nullable because
-- Chicks CRM returns failed-login rows with no resolved employee
-- (only an attempted_username).
-- ---------------------------------------------------------------------
CREATE TABLE crm_login_history (
  id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id            BIGINT UNSIGNED NOT NULL,
  employee_id          BIGINT UNSIGNED NULL,
  attempted_username   VARCHAR(100) NULL,
  login_time           DATETIME NOT NULL,
  login_status         VARCHAR(20) NULL,
  login_type           VARCHAR(20) NULL,
  failure_reason       VARCHAR(255) NULL,
  ip_address           VARCHAR(45) NULL,
  user_agent           VARCHAR(512) NULL,
  external_record_id   VARCHAR(50) NULL,
  CONSTRAINT fk_history_report FOREIGN KEY (report_id)
    REFERENCES app_reports(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_history_employee FOREIGN KEY (employee_id)
    REFERENCES crm_employees(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_employee_login_time (employee_id, login_time),
  INDEX idx_login_time (login_time),
  INDEX idx_history_report (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 7. crm_employee_call_stats
-- CRM-only. Per-employee aggregate call/login counts. No API returns
-- individual call log records anywhere, so this is aggregate-only.
-- ---------------------------------------------------------------------
CREATE TABLE crm_employee_call_stats (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id             BIGINT UNSIGNED NOT NULL,
  employee_id           BIGINT UNSIGNED NOT NULL,
  total_logins          INT NULL,
  last_login            DATETIME NULL,
  total_calls           INT NULL,
  total_incoming_calls  INT NULL,
  total_outgoing_calls  INT NULL,
  connected_calls       INT NULL,
  missed_calls          INT NULL,
  CONSTRAINT fk_empcalls_report FOREIGN KEY (report_id)
    REFERENCES app_reports(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_empcalls_employee FOREIGN KEY (employee_id)
    REFERENCES crm_employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_report_employee UNIQUE (report_id, employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 8. lms_training_stats
-- LMS-only. Frontend currently only reads currentPeriod.trainingSessions
-- (never previousPeriod), so 'previous' rows may go unpopulated in
-- practice even though the schema supports both.
-- ---------------------------------------------------------------------
CREATE TABLE lms_training_stats (
  id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id            BIGINT UNSIGNED NOT NULL,
  period_type          ENUM('current', 'previous') NOT NULL,
  trainings_created    INT NULL,
  trainings_completed  INT NULL,
  assigned_users       INT NULL,
  completed_users      INT NULL,
  CONSTRAINT fk_training_report FOREIGN KEY (report_id)
    REFERENCES app_reports(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_training_report_period UNIQUE (report_id, period_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 9. lms_elearning_stats
-- LMS-only. Same current/previous caveat as lms_training_stats.
-- ---------------------------------------------------------------------
CREATE TABLE lms_elearning_stats (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id          BIGINT UNSIGNED NOT NULL,
  period_type        ENUM('current', 'previous') NOT NULL,
  active_courses     INT NULL,
  assigned_users     INT NULL,
  completed_users    INT NULL,
  in_progress_users  INT NULL,
  CONSTRAINT fk_elearning_report FOREIGN KEY (report_id)
    REFERENCES app_reports(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_elearning_report_period UNIQUE (report_id, period_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 10. myib_report_extras
-- MyIB-only. One row per report (no previous period exists for MyIB).
-- last_login_count is a COUNT despite its name, not a date - do not
-- confuse with app_period_metrics.last_login (DATETIME).
-- ---------------------------------------------------------------------
CREATE TABLE myib_report_extras (
  id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id              BIGINT UNSIGNED NOT NULL,
  last_login_count       INT NULL,
  itsm_tickets_created   INT NULL,
  travel_desk_requests   INT NULL,
  meeting_room_requests  INT NULL,
  gate_pass_requests     INT NULL,
  company_car_requests   INT NULL,
  leave_requests         INT NULL,
  CONSTRAINT fk_myib_report FOREIGN KEY (report_id)
    REFERENCES app_reports(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_myib_report UNIQUE (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- End of proposed schema. Nothing above has been executed.
-- Seed rows for report_applications (the 7 apps) are NOT included here
-- since they weren't requested - ask if you want that INSERT statement
-- prepared separately before/after running this DDL.
-- =====================================================================
