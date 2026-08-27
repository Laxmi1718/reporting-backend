-- =====================================================================
-- IBREMS persistence - schema addition
-- Adds IBREMS to report_applications.app_family and two IBREMS-only
-- extension tables (formSubmit / dashboardView have no home in the
-- existing generic tables).
-- =====================================================================

USE reporting_dashboard;

ALTER TABLE report_applications
  MODIFY COLUMN app_family ENUM('LMS', 'CRM', 'MYIB', 'IBREMS') NOT NULL;

-- ---------------------------------------------------------------------
-- ibrems_form_submit_stats
-- IBREMS-only. currentPeriod.formSubmit / previousPeriod.formSubmit.
-- ---------------------------------------------------------------------
CREATE TABLE ibrems_form_submit_stats (
  id                       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id                BIGINT UNSIGNED NOT NULL,
  period_type              ENUM('current', 'previous') NOT NULL,
  total_submit             INT NULL,
  failed_submit            INT NULL,
  active_users             INT NULL,
  submit_average_per_user  DECIMAL(10,2) NULL,
  CONSTRAINT fk_formsubmit_report FOREIGN KEY (report_id)
    REFERENCES app_reports(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_formsubmit_report_period UNIQUE (report_id, period_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- ibrems_dashboard_view_stats
-- IBREMS-only. currentPeriod.dashboardView / previousPeriod.dashboardView.
-- ---------------------------------------------------------------------
CREATE TABLE ibrems_dashboard_view_stats (
  id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id              BIGINT UNSIGNED NOT NULL,
  period_type            ENUM('current', 'previous') NOT NULL,
  total_view             INT NULL,
  failed_view            INT NULL,
  active_users           INT NULL,
  view_average_per_user  DECIMAL(10,2) NULL,
  CONSTRAINT fk_dashboardview_report FOREIGN KEY (report_id)
    REFERENCES app_reports(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_dashboardview_report_period UNIQUE (report_id, period_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
