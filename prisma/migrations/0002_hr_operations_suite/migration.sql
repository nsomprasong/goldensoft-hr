-- GoldenSoft HR Operations Suite (Phase HR 100%)
-- PREVIEW ONLY — NOT APPLIED. Additive PostgreSQL migration for schema hr.
-- Cross-schema identifiers (organization_id, branch_id, auth_user_id) are UUID soft references.

CREATE SCHEMA IF NOT EXISTS "hr";

-- Employee profile additions
ALTER TABLE "hr"."employees" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;
ALTER TABLE "hr"."employees" ADD COLUMN IF NOT EXISTS "emergency_contact_name" TEXT;
ALTER TABLE "hr"."employees" ADD COLUMN IF NOT EXISTS "emergency_contact_phone" TEXT;
ALTER TABLE "hr"."employees" ADD COLUMN IF NOT EXISTS "terminated_at" TIMESTAMPTZ;

-- Immutable-code master tables
CREATE TABLE "hr"."attendance_statuses" (
    "id" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_statuses_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."attendance_event_types" (
    "id" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_event_types_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."leave_request_statuses" (
    "id" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leave_request_statuses_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."overtime_request_statuses" (
    "id" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "overtime_request_statuses_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."schedule_period_statuses" (
    "id" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schedule_period_statuses_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."holiday_types" (
    "id" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "holiday_types_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."leave_units" (
    "id" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leave_units_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."approval_entity_types" (
    "id" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_entity_types_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."notification_types" (
    "id" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_types_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."notification_statuses" (
    "id" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_statuses_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."leave_balance_tx_types" (
    "id" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leave_balance_tx_types_pkey" PRIMARY KEY ("id")
);

-- Calendar, location, and scheduling
CREATE TABLE "hr"."work_calendars" (
    "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "branch_id" UUID, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok', "work_days" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_calendars_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."holidays" (
    "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "branch_id" UUID, "work_calendar_id" UUID,
    "holiday_type_id" UUID NOT NULL, "holiday_date" DATE NOT NULL, "name" TEXT NOT NULL, "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."employee_work_calendars" (
    "id" UUID NOT NULL, "employee_id" UUID NOT NULL, "work_calendar_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL, "effective_to" DATE, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_work_calendars_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."employee_work_locations" (
    "id" UUID NOT NULL, "employee_id" UUID NOT NULL, "work_location_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL, "effective_to" DATE, "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_work_locations_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."employee_assignment_history" (
    "id" UUID NOT NULL, "employee_id" UUID NOT NULL, "branch_id" UUID, "department_id" UUID, "position_id" UUID,
    "effective_from" DATE NOT NULL, "effective_to" DATE, "reason" TEXT, "notes" TEXT, "changed_by_auth_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_assignment_history_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."schedule_periods" (
    "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "branch_id" UUID, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
    "period_start" DATE NOT NULL, "period_end" DATE NOT NULL, "status_id" UUID NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok', "published_at" TIMESTAMPTZ, "published_by_auth_user_id" UUID,
    "locked_at" TIMESTAMPTZ, "locked_by_auth_user_id" UUID, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schedule_periods_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "schedule_periods_date_range" CHECK ("period_end" >= "period_start")
);
CREATE TABLE "hr"."shift_assignments" (
    "id" UUID NOT NULL, "schedule_period_id" UUID NOT NULL, "employee_id" UUID NOT NULL, "shift_id" UUID,
    "work_date" DATE NOT NULL, "sequence_no" INTEGER NOT NULL DEFAULT 1, "work_location_id" UUID,
    "is_rest_day" BOOLEAN NOT NULL DEFAULT false, "is_leave_day" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT, "created_by_auth_user_id" UUID, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shift_assignments_sequence_positive" CHECK ("sequence_no" >= 1)
);
CREATE TABLE "hr"."shift_assignment_segments" (
    "id" UUID NOT NULL, "shift_assignment_id" UUID NOT NULL, "segment_order" INTEGER NOT NULL,
    "start_time" TIME NOT NULL, "end_time" TIME NOT NULL, "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "crosses_midnight" BOOLEAN NOT NULL DEFAULT false, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_assignment_segments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shift_assignment_segments_break_non_negative" CHECK ("break_minutes" >= 0)
);

-- Attendance
CREATE TABLE "hr"."attendance_events" (
    "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "branch_id" UUID, "employee_id" UUID NOT NULL,
    "event_type_id" UUID NOT NULL, "occurred_at" TIMESTAMPTZ NOT NULL, "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "latitude" DECIMAL(10,7), "longitude" DECIMAL(10,7), "work_location_id" UUID, "geofence_distance_meters" DECIMAL(10,2),
    "source" TEXT NOT NULL DEFAULT 'WEB', "device_id" TEXT, "idempotency_key" TEXT NOT NULL, "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."attendance_days" (
    "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "branch_id" UUID, "employee_id" UUID NOT NULL,
    "work_date" DATE NOT NULL, "schedule_period_id" UUID, "shift_assignment_id" UUID, "status_id" UUID NOT NULL,
    "clock_in_at" TIMESTAMPTZ, "clock_out_at" TIMESTAMPTZ, "scheduled_minutes" INTEGER NOT NULL DEFAULT 0,
    "worked_minutes" INTEGER NOT NULL DEFAULT 0, "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_leave_minutes" INTEGER NOT NULL DEFAULT 0, "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_locked" BOOLEAN NOT NULL DEFAULT false, "notes" TEXT, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_days_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."attendance_adjustments" (
    "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "employee_id" UUID NOT NULL, "attendance_day_id" UUID,
    "work_date" DATE NOT NULL, "requested_clock_in_at" TIMESTAMPTZ, "requested_clock_out_at" TIMESTAMPTZ,
    "reason" TEXT NOT NULL, "status_id" UUID NOT NULL, "requested_by_auth_user_id" UUID NOT NULL,
    "reviewed_by_auth_user_id" UUID, "reviewed_at" TIMESTAMPTZ, "review_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_adjustments_pkey" PRIMARY KEY ("id")
);

-- Leave and overtime
CREATE TABLE "hr"."leave_types" (
    "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
    "unit_id" UUID NOT NULL, "is_paid" BOOLEAN NOT NULL DEFAULT true, "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."leave_policies" (
    "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "leave_type_id" UUID NOT NULL, "code" TEXT NOT NULL,
    "name" TEXT NOT NULL, "annual_entitlement" DECIMAL(14,2) NOT NULL DEFAULT 0, "carry_forward_limit" DECIMAL(14,2),
    "accrual_per_period" DECIMAL(14,2), "minimum_notice_days" INTEGER NOT NULL DEFAULT 0,
    "effective_from" DATE NOT NULL, "effective_to" DATE, "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."employee_leave_balances" (
    "id" UUID NOT NULL, "employee_id" UUID NOT NULL, "leave_type_id" UUID NOT NULL, "balance_year" INTEGER NOT NULL,
    "opening_balance" DECIMAL(14,2) NOT NULL DEFAULT 0, "accrued_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "used_balance" DECIMAL(14,2) NOT NULL DEFAULT 0, "adjusted_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "available_balance" DECIMAL(14,2) NOT NULL DEFAULT 0, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_leave_balances_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."leave_balance_transactions" (
    "id" UUID NOT NULL, "employee_leave_balance_id" UUID NOT NULL, "transaction_type_id" UUID NOT NULL,
    "leave_request_id" UUID, "occurred_on" DATE NOT NULL, "amount" DECIMAL(14,2) NOT NULL,
    "balance_after" DECIMAL(14,2) NOT NULL, "reference" TEXT, "notes" TEXT, "created_by_auth_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leave_balance_transactions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."leave_requests" (
    "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "employee_id" UUID NOT NULL, "leave_type_id" UUID NOT NULL,
    "status_id" UUID NOT NULL, "start_date" DATE NOT NULL, "end_date" DATE NOT NULL, "start_unit_id" UUID NOT NULL,
    "end_unit_id" UUID NOT NULL, "requested_amount" DECIMAL(14,2) NOT NULL, "reason" TEXT, "attachment_url" TEXT,
    "submitted_at" TIMESTAMPTZ, "reviewed_at" TIMESTAMPTZ, "reviewed_by_auth_user_id" UUID, "review_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "leave_requests_date_range" CHECK ("end_date" >= "start_date")
);
CREATE TABLE "hr"."overtime_requests" (
    "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "branch_id" UUID, "employee_id" UUID NOT NULL,
    "attendance_day_id" UUID, "overtime_rule_id" UUID, "status_id" UUID NOT NULL, "work_date" DATE NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL, "end_at" TIMESTAMPTZ NOT NULL, "requested_minutes" INTEGER NOT NULL,
    "approved_minutes" INTEGER, "reason" TEXT, "submitted_at" TIMESTAMPTZ, "reviewed_at" TIMESTAMPTZ,
    "reviewed_by_auth_user_id" UUID, "review_note" TEXT, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "overtime_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "overtime_requests_time_range" CHECK ("end_at" > "start_at")
);

-- Compensation and payroll
CREATE TABLE "hr"."earning_types" (
    "id" UUID NOT NULL, "organization_id" UUID, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
    "is_taxable" BOOLEAN NOT NULL DEFAULT true, "is_recurring_allowed" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "earning_types_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."deduction_types" (
    "id" UUID NOT NULL, "organization_id" UUID, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
    "is_taxable_reduction" BOOLEAN NOT NULL DEFAULT false, "is_recurring_allowed" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deduction_types_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."employee_recurring_pay_items" (
    "id" UUID NOT NULL, "employee_id" UUID NOT NULL, "earning_type_id" UUID, "deduction_type_id" UUID,
    "amount" DECIMAL(14,2) NOT NULL, "effective_from" DATE NOT NULL, "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true, "created_by_auth_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_recurring_pay_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "employee_recurring_pay_items_one_type" CHECK (num_nonnulls("earning_type_id", "deduction_type_id") = 1)
);
CREATE TABLE "hr"."payroll_adjustments" (
    "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "employee_id" UUID NOT NULL, "payroll_period_id" UUID,
    "earning_type_id" UUID, "deduction_type_id" UUID, "amount" DECIMAL(14,2) NOT NULL, "reason" TEXT NOT NULL,
    "effective_date" DATE NOT NULL, "created_by_auth_user_id" UUID NOT NULL, "approved_by_auth_user_id" UUID,
    "approved_at" TIMESTAMPTZ, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payroll_adjustments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_adjustments_one_type" CHECK (num_nonnulls("earning_type_id", "deduction_type_id") = 1)
);
CREATE TABLE "hr"."payroll_runs" (
    "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "payroll_period_id" UUID NOT NULL, "run_number" INTEGER NOT NULL,
    "status_id" UUID NOT NULL, "started_at" TIMESTAMPTZ, "completed_at" TIMESTAMPTZ, "approved_at" TIMESTAMPTZ,
    "approved_by_auth_user_id" UUID, "created_by_auth_user_id" UUID NOT NULL, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."payroll_run_employees" (
    "id" UUID NOT NULL, "payroll_run_id" UUID NOT NULL, "employee_id" UUID NOT NULL,
    "gross_earnings" DECIMAL(14,2) NOT NULL DEFAULT 0, "total_deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_pay" DECIMAL(14,2) NOT NULL DEFAULT 0, "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0, "status_id" UUID NOT NULL, "calculated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payroll_run_employees_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."payroll_run_items" (
    "id" UUID NOT NULL, "payroll_run_employee_id" UUID NOT NULL, "earning_type_id" UUID, "deduction_type_id" UUID,
    "source_type" TEXT NOT NULL, "description" TEXT, "quantity" DECIMAL(14,2), "rate" DECIMAL(14,2),
    "amount" DECIMAL(14,2) NOT NULL, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payroll_run_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_run_items_one_type" CHECK (num_nonnulls("earning_type_id", "deduction_type_id") = 1)
);
CREATE TABLE "hr"."payslips" (
    "id" UUID NOT NULL, "payroll_run_employee_id" UUID NOT NULL, "employee_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ, "issued_by_auth_user_id" UUID, "snapshot" JSONB NOT NULL,
    "gross_earnings" DECIMAL(14,2) NOT NULL, "total_deductions" DECIMAL(14,2) NOT NULL, "net_pay" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- Approvals and notifications
CREATE TABLE "hr"."approval_actions" (
    "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "entity_type_id" UUID NOT NULL, "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL, "actor_auth_user_id" UUID NOT NULL, "comment" TEXT, "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "hr"."notifications" (
    "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "branch_id" UUID, "recipient_auth_user_id" UUID,
    "recipient_employee_id" UUID, "type_id" UUID NOT NULL, "status_id" UUID NOT NULL, "title" TEXT NOT NULL,
    "body" TEXT NOT NULL, "entity_type" TEXT, "entity_id" UUID, "data" JSONB, "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "delivered_at" TIMESTAMPTZ,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_recipient_present" CHECK (num_nonnulls("recipient_auth_user_id", "recipient_employee_id") >= 1)
);
CREATE TABLE "hr"."notification_outbox" (
    "id" UUID NOT NULL, "notification_id" UUID NOT NULL, "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "payload" JSONB NOT NULL, "status_id" UUID NOT NULL, "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "processed_at" TIMESTAMPTZ, "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- Master uniqueness
CREATE UNIQUE INDEX "attendance_statuses_code_key" ON "hr"."attendance_statuses" ("code");
CREATE UNIQUE INDEX "attendance_event_types_code_key" ON "hr"."attendance_event_types" ("code");
CREATE UNIQUE INDEX "leave_request_statuses_code_key" ON "hr"."leave_request_statuses" ("code");
CREATE UNIQUE INDEX "overtime_request_statuses_code_key" ON "hr"."overtime_request_statuses" ("code");
CREATE UNIQUE INDEX "schedule_period_statuses_code_key" ON "hr"."schedule_period_statuses" ("code");
CREATE UNIQUE INDEX "holiday_types_code_key" ON "hr"."holiday_types" ("code");
CREATE UNIQUE INDEX "leave_units_code_key" ON "hr"."leave_units" ("code");
CREATE UNIQUE INDEX "approval_entity_types_code_key" ON "hr"."approval_entity_types" ("code");
CREATE UNIQUE INDEX "notification_types_code_key" ON "hr"."notification_types" ("code");
CREATE UNIQUE INDEX "notification_statuses_code_key" ON "hr"."notification_statuses" ("code");
CREATE UNIQUE INDEX "leave_balance_tx_types_code_key" ON "hr"."leave_balance_tx_types" ("code");

-- Operational uniqueness and pagination indexes
CREATE UNIQUE INDEX "work_calendars_organization_code_key" ON "hr"."work_calendars" ("organization_id", "code");
CREATE INDEX "work_calendars_org_branch_active_idx" ON "hr"."work_calendars" ("organization_id", "branch_id", "is_active");
CREATE UNIQUE INDEX "holidays_calendar_date_name_key" ON "hr"."holidays" ("work_calendar_id", "holiday_date", "name");
CREATE INDEX "holidays_org_branch_date_idx" ON "hr"."holidays" ("organization_id", "branch_id", "holiday_date");
CREATE UNIQUE INDEX "employee_work_calendars_effective_key" ON "hr"."employee_work_calendars" ("employee_id", "work_calendar_id", "effective_from");
CREATE INDEX "employee_work_calendars_employee_dates_idx" ON "hr"."employee_work_calendars" ("employee_id", "effective_from", "effective_to");
CREATE UNIQUE INDEX "employee_work_locations_effective_key" ON "hr"."employee_work_locations" ("employee_id", "work_location_id", "effective_from");
CREATE UNIQUE INDEX "employee_work_locations_one_primary_current_key" ON "hr"."employee_work_locations" ("employee_id") WHERE "is_primary" = true AND "effective_to" IS NULL;
CREATE INDEX "employee_assignment_history_employee_dates_idx" ON "hr"."employee_assignment_history" ("employee_id", "effective_from" DESC);
CREATE INDEX "employee_assignment_history_branch_idx" ON "hr"."employee_assignment_history" ("branch_id", "effective_from" DESC);
CREATE UNIQUE INDEX "schedule_periods_org_code_key" ON "hr"."schedule_periods" ("organization_id", "code");
CREATE INDEX "schedule_periods_org_branch_dates_status_idx" ON "hr"."schedule_periods" ("organization_id", "branch_id", "period_start" DESC, "status_id");
CREATE UNIQUE INDEX "shift_assignments_employee_date_seq_key" ON "hr"."shift_assignments" ("employee_id", "work_date", "sequence_no");
CREATE INDEX "shift_assignments_period_date_idx" ON "hr"."shift_assignments" ("schedule_period_id", "work_date");
CREATE UNIQUE INDEX "shift_assignment_segments_assignment_order_key" ON "hr"."shift_assignment_segments" ("shift_assignment_id", "segment_order");
CREATE UNIQUE INDEX "attendance_events_employee_idempotency_key" ON "hr"."attendance_events" ("employee_id", "idempotency_key");
CREATE INDEX "attendance_events_org_branch_occurred_idx" ON "hr"."attendance_events" ("organization_id", "branch_id", "occurred_at" DESC);
CREATE INDEX "attendance_events_employee_occurred_idx" ON "hr"."attendance_events" ("employee_id", "occurred_at" DESC);
CREATE UNIQUE INDEX "attendance_days_employee_date_key" ON "hr"."attendance_days" ("employee_id", "work_date");
CREATE INDEX "attendance_days_org_branch_date_status_idx" ON "hr"."attendance_days" ("organization_id", "branch_id", "work_date" DESC, "status_id");
CREATE INDEX "attendance_adjustments_employee_date_status_idx" ON "hr"."attendance_adjustments" ("employee_id", "work_date" DESC, "status_id");
CREATE UNIQUE INDEX "leave_types_org_code_key" ON "hr"."leave_types" ("organization_id", "code");
CREATE INDEX "leave_types_org_active_idx" ON "hr"."leave_types" ("organization_id", "is_active");
CREATE UNIQUE INDEX "leave_policies_org_code_key" ON "hr"."leave_policies" ("organization_id", "code");
CREATE INDEX "leave_policies_type_effective_idx" ON "hr"."leave_policies" ("leave_type_id", "effective_from" DESC);
CREATE UNIQUE INDEX "employee_leave_balances_employee_type_year_key" ON "hr"."employee_leave_balances" ("employee_id", "leave_type_id", "balance_year");
CREATE INDEX "leave_balance_transactions_balance_date_idx" ON "hr"."leave_balance_transactions" ("employee_leave_balance_id", "occurred_on" DESC);
CREATE INDEX "leave_requests_org_status_created_idx" ON "hr"."leave_requests" ("organization_id", "status_id", "created_at" DESC);
CREATE INDEX "leave_requests_employee_dates_idx" ON "hr"."leave_requests" ("employee_id", "start_date", "end_date");
CREATE INDEX "overtime_requests_org_status_date_idx" ON "hr"."overtime_requests" ("organization_id", "status_id", "work_date" DESC);
CREATE INDEX "overtime_requests_employee_date_idx" ON "hr"."overtime_requests" ("employee_id", "work_date" DESC);
CREATE UNIQUE INDEX "earning_types_code_key" ON "hr"."earning_types" ("code");
CREATE INDEX "earning_types_organization_active_idx" ON "hr"."earning_types" ("organization_id", "is_active");
CREATE UNIQUE INDEX "deduction_types_code_key" ON "hr"."deduction_types" ("code");
CREATE INDEX "deduction_types_organization_active_idx" ON "hr"."deduction_types" ("organization_id", "is_active");
CREATE INDEX "employee_recurring_pay_items_employee_active_idx" ON "hr"."employee_recurring_pay_items" ("employee_id", "is_active", "effective_from");
CREATE INDEX "payroll_adjustments_employee_period_idx" ON "hr"."payroll_adjustments" ("employee_id", "payroll_period_id", "effective_date");
CREATE UNIQUE INDEX "payroll_runs_period_run_number_key" ON "hr"."payroll_runs" ("payroll_period_id", "run_number");
CREATE INDEX "payroll_runs_org_status_created_idx" ON "hr"."payroll_runs" ("organization_id", "status_id", "created_at" DESC);
CREATE UNIQUE INDEX "payroll_run_employees_run_employee_key" ON "hr"."payroll_run_employees" ("payroll_run_id", "employee_id");
CREATE INDEX "payroll_run_employees_employee_idx" ON "hr"."payroll_run_employees" ("employee_id");
CREATE INDEX "payroll_run_items_run_employee_idx" ON "hr"."payroll_run_items" ("payroll_run_employee_id");
CREATE UNIQUE INDEX "payslips_run_employee_key" ON "hr"."payslips" ("payroll_run_employee_id");
CREATE INDEX "payslips_employee_issued_idx" ON "hr"."payslips" ("employee_id", "issued_at" DESC);
CREATE INDEX "approval_actions_org_entity_created_idx" ON "hr"."approval_actions" ("organization_id", "entity_type_id", "entity_id", "created_at" DESC);
CREATE INDEX "notifications_recipient_status_created_idx" ON "hr"."notifications" ("recipient_auth_user_id", "status_id", "created_at" DESC);
CREATE INDEX "notifications_employee_status_created_idx" ON "hr"."notifications" ("recipient_employee_id", "status_id", "created_at" DESC);
CREATE INDEX "notification_outbox_status_available_idx" ON "hr"."notification_outbox" ("status_id", "available_at");

-- Internal hr foreign keys only
ALTER TABLE "hr"."holidays" ADD CONSTRAINT "holidays_work_calendar_id_fkey" FOREIGN KEY ("work_calendar_id") REFERENCES "hr"."work_calendars"("id") ON DELETE SET NULL;
ALTER TABLE "hr"."holidays" ADD CONSTRAINT "holidays_holiday_type_id_fkey" FOREIGN KEY ("holiday_type_id") REFERENCES "hr"."holiday_types"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."employee_work_calendars" ADD CONSTRAINT "employee_work_calendars_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."employee_work_calendars" ADD CONSTRAINT "employee_work_calendars_calendar_id_fkey" FOREIGN KEY ("work_calendar_id") REFERENCES "hr"."work_calendars"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."employee_work_locations" ADD CONSTRAINT "employee_work_locations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."employee_work_locations" ADD CONSTRAINT "employee_work_locations_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "hr"."work_locations"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."employee_assignment_history" ADD CONSTRAINT "employee_assignment_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."employee_assignment_history" ADD CONSTRAINT "employee_assignment_history_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "hr"."departments"("id") ON DELETE SET NULL;
ALTER TABLE "hr"."employee_assignment_history" ADD CONSTRAINT "employee_assignment_history_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "hr"."positions"("id") ON DELETE SET NULL;
ALTER TABLE "hr"."schedule_periods" ADD CONSTRAINT "schedule_periods_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "hr"."schedule_period_statuses"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."shift_assignments" ADD CONSTRAINT "shift_assignments_period_id_fkey" FOREIGN KEY ("schedule_period_id") REFERENCES "hr"."schedule_periods"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "hr"."shifts"("id") ON DELETE SET NULL;
ALTER TABLE "hr"."shift_assignments" ADD CONSTRAINT "shift_assignments_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "hr"."work_locations"("id") ON DELETE SET NULL;
ALTER TABLE "hr"."shift_assignment_segments" ADD CONSTRAINT "shift_assignment_segments_assignment_id_fkey" FOREIGN KEY ("shift_assignment_id") REFERENCES "hr"."shift_assignments"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."attendance_events" ADD CONSTRAINT "attendance_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."attendance_events" ADD CONSTRAINT "attendance_events_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "hr"."attendance_event_types"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."attendance_events" ADD CONSTRAINT "attendance_events_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "hr"."work_locations"("id") ON DELETE SET NULL;
ALTER TABLE "hr"."attendance_days" ADD CONSTRAINT "attendance_days_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."attendance_days" ADD CONSTRAINT "attendance_days_period_id_fkey" FOREIGN KEY ("schedule_period_id") REFERENCES "hr"."schedule_periods"("id") ON DELETE SET NULL;
ALTER TABLE "hr"."attendance_days" ADD CONSTRAINT "attendance_days_assignment_id_fkey" FOREIGN KEY ("shift_assignment_id") REFERENCES "hr"."shift_assignments"("id") ON DELETE SET NULL;
ALTER TABLE "hr"."attendance_days" ADD CONSTRAINT "attendance_days_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "hr"."attendance_statuses"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_day_id_fkey" FOREIGN KEY ("attendance_day_id") REFERENCES "hr"."attendance_days"("id") ON DELETE SET NULL;
ALTER TABLE "hr"."attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "hr"."leave_request_statuses"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."leave_types" ADD CONSTRAINT "leave_types_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "hr"."leave_units"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."leave_policies" ADD CONSTRAINT "leave_policies_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "hr"."leave_types"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "hr"."leave_types"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_balance_id_fkey" FOREIGN KEY ("employee_leave_balance_id") REFERENCES "hr"."employee_leave_balances"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_type_id_fkey" FOREIGN KEY ("transaction_type_id") REFERENCES "hr"."leave_balance_tx_types"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "hr"."leave_requests"("id") ON DELETE SET NULL;
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "hr"."leave_types"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "hr"."leave_request_statuses"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_start_unit_id_fkey" FOREIGN KEY ("start_unit_id") REFERENCES "hr"."leave_units"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_end_unit_id_fkey" FOREIGN KEY ("end_unit_id") REFERENCES "hr"."leave_units"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."overtime_requests" ADD CONSTRAINT "overtime_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."overtime_requests" ADD CONSTRAINT "overtime_requests_day_id_fkey" FOREIGN KEY ("attendance_day_id") REFERENCES "hr"."attendance_days"("id") ON DELETE SET NULL;
ALTER TABLE "hr"."overtime_requests" ADD CONSTRAINT "overtime_requests_rule_id_fkey" FOREIGN KEY ("overtime_rule_id") REFERENCES "hr"."overtime_rules"("id") ON DELETE SET NULL;
ALTER TABLE "hr"."overtime_requests" ADD CONSTRAINT "overtime_requests_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "hr"."overtime_request_statuses"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."employee_recurring_pay_items" ADD CONSTRAINT "employee_recurring_pay_items_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."employee_recurring_pay_items" ADD CONSTRAINT "employee_recurring_pay_items_earning_id_fkey" FOREIGN KEY ("earning_type_id") REFERENCES "hr"."earning_types"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."employee_recurring_pay_items" ADD CONSTRAINT "employee_recurring_pay_items_deduction_id_fkey" FOREIGN KEY ("deduction_type_id") REFERENCES "hr"."deduction_types"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "hr"."payroll_periods"("id") ON DELETE SET NULL;
ALTER TABLE "hr"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_earning_id_fkey" FOREIGN KEY ("earning_type_id") REFERENCES "hr"."earning_types"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_deduction_id_fkey" FOREIGN KEY ("deduction_type_id") REFERENCES "hr"."deduction_types"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."payroll_runs" ADD CONSTRAINT "payroll_runs_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "hr"."payroll_periods"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."payroll_runs" ADD CONSTRAINT "payroll_runs_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "hr"."payroll_period_statuses"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "hr"."payroll_runs"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "hr"."payroll_period_statuses"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."payroll_run_items" ADD CONSTRAINT "payroll_run_items_run_employee_id_fkey" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "hr"."payroll_run_employees"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."payroll_run_items" ADD CONSTRAINT "payroll_run_items_earning_id_fkey" FOREIGN KEY ("earning_type_id") REFERENCES "hr"."earning_types"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."payroll_run_items" ADD CONSTRAINT "payroll_run_items_deduction_id_fkey" FOREIGN KEY ("deduction_type_id") REFERENCES "hr"."deduction_types"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."payslips" ADD CONSTRAINT "payslips_run_employee_id_fkey" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "hr"."payroll_run_employees"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."approval_actions" ADD CONSTRAINT "approval_actions_entity_type_id_fkey" FOREIGN KEY ("entity_type_id") REFERENCES "hr"."approval_entity_types"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."notifications" ADD CONSTRAINT "notifications_employee_id_fkey" FOREIGN KEY ("recipient_employee_id") REFERENCES "hr"."employees"("id") ON DELETE SET NULL;
ALTER TABLE "hr"."notifications" ADD CONSTRAINT "notifications_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "hr"."notification_types"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."notifications" ADD CONSTRAINT "notifications_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "hr"."notification_statuses"("id") ON DELETE RESTRICT;
ALTER TABLE "hr"."notification_outbox" ADD CONSTRAINT "notification_outbox_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "hr"."notifications"("id") ON DELETE CASCADE;
ALTER TABLE "hr"."notification_outbox" ADD CONSTRAINT "notification_outbox_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "hr"."notification_statuses"("id") ON DELETE RESTRICT;

-- Idempotent immutable master seeds
INSERT INTO "hr"."attendance_statuses" ("id","code","name","sort_order") VALUES
  (gen_random_uuid(),'PRESENT','Present',1),(gen_random_uuid(),'LATE','Late',2),(gen_random_uuid(),'EARLY_LEAVE','Early leave',3),(gen_random_uuid(),'ABSENT','Absent',4),(gen_random_uuid(),'LEAVE','Leave',5),(gen_random_uuid(),'HOLIDAY','Holiday',6),(gen_random_uuid(),'REST_DAY','Rest day',7),(gen_random_uuid(),'INCOMPLETE','Incomplete',8),(gen_random_uuid(),'MISSING_CLOCK_IN','Missing clock in',9),(gen_random_uuid(),'MISSING_CLOCK_OUT','Missing clock out',10) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "hr"."attendance_event_types" ("id","code","name","sort_order") VALUES
  (gen_random_uuid(),'CLOCK_IN','Clock in',1),(gen_random_uuid(),'CLOCK_OUT','Clock out',2),(gen_random_uuid(),'BREAK_START','Break start',3),(gen_random_uuid(),'BREAK_END','Break end',4),(gen_random_uuid(),'OT_START','Overtime start',5),(gen_random_uuid(),'OT_END','Overtime end',6) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "hr"."leave_request_statuses" ("id","code","name","sort_order") VALUES
  (gen_random_uuid(),'DRAFT','Draft',1),(gen_random_uuid(),'SUBMITTED','Submitted',2),(gen_random_uuid(),'APPROVED','Approved',3),(gen_random_uuid(),'REJECTED','Rejected',4),(gen_random_uuid(),'CANCELLED','Cancelled',5) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "hr"."overtime_request_statuses" ("id","code","name","sort_order") VALUES
  (gen_random_uuid(),'DRAFT','Draft',1),(gen_random_uuid(),'SUBMITTED','Submitted',2),(gen_random_uuid(),'APPROVED','Approved',3),(gen_random_uuid(),'REJECTED','Rejected',4),(gen_random_uuid(),'CANCELLED','Cancelled',5) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "hr"."schedule_period_statuses" ("id","code","name","sort_order") VALUES
  (gen_random_uuid(),'DRAFT','Draft',1),(gen_random_uuid(),'PUBLISHED','Published',2),(gen_random_uuid(),'LOCKED','Locked',3) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "hr"."holiday_types" ("id","code","name","sort_order") VALUES
  (gen_random_uuid(),'PUBLIC','Public holiday',1),(gen_random_uuid(),'COMPANY','Company holiday',2),(gen_random_uuid(),'BRANCH','Branch holiday',3),(gen_random_uuid(),'SPECIAL','Special holiday',4) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "hr"."leave_units" ("id","code","name","sort_order") VALUES
  (gen_random_uuid(),'DAY','Day',1),(gen_random_uuid(),'HALF_DAY','Half day',2),(gen_random_uuid(),'HOUR','Hour',3) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "hr"."approval_entity_types" ("id","code","name","sort_order") VALUES
  (gen_random_uuid(),'LEAVE','Leave',1),(gen_random_uuid(),'OVERTIME','Overtime',2),(gen_random_uuid(),'ATTENDANCE_ADJUSTMENT','Attendance adjustment',3),(gen_random_uuid(),'PAYROLL','Payroll',4) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "hr"."notification_types" ("id","code","name","sort_order") VALUES
  (gen_random_uuid(),'LEAVE_SUBMITTED','Leave submitted',1),(gen_random_uuid(),'LEAVE_APPROVED','Leave approved',2),(gen_random_uuid(),'LEAVE_REJECTED','Leave rejected',3),(gen_random_uuid(),'OT_SUBMITTED','Overtime submitted',4),(gen_random_uuid(),'OT_APPROVED','Overtime approved',5),(gen_random_uuid(),'OT_REJECTED','Overtime rejected',6),(gen_random_uuid(),'SCHEDULE_PUBLISHED','Schedule published',7),(gen_random_uuid(),'SCHEDULE_CHANGED','Schedule changed',8),(gen_random_uuid(),'ATTENDANCE_MISSING','Attendance missing',9),(gen_random_uuid(),'PAYROLL_APPROVED','Payroll approved',10),(gen_random_uuid(),'PAYSLIP_ISSUED','Payslip issued',11) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "hr"."notification_statuses" ("id","code","name","sort_order") VALUES
  (gen_random_uuid(),'PENDING','Pending',1),(gen_random_uuid(),'DELIVERED','Delivered',2),(gen_random_uuid(),'FAILED','Failed',3),(gen_random_uuid(),'CANCELLED','Cancelled',4) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "hr"."leave_balance_tx_types" ("id","code","name","sort_order") VALUES
  (gen_random_uuid(),'OPENING','Opening balance',1),(gen_random_uuid(),'ACCRUAL','Accrual',2),(gen_random_uuid(),'USED','Used',3),(gen_random_uuid(),'ADJUSTMENT','Adjustment',4),(gen_random_uuid(),'CARRY_FORWARD','Carry forward',5) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "hr"."earning_types" ("id","code","name") VALUES
  (gen_random_uuid(),'BASE_SALARY','Base salary'),(gen_random_uuid(),'OVERTIME','Overtime'),(gen_random_uuid(),'ALLOWANCE','Allowance'),(gen_random_uuid(),'BONUS','Bonus'),(gen_random_uuid(),'COMMISSION','Commission') ON CONFLICT ("code") DO NOTHING;
INSERT INTO "hr"."deduction_types" ("id","code","name") VALUES
  (gen_random_uuid(),'TAX','Tax'),(gen_random_uuid(),'SOCIAL_SECURITY','Social security'),(gen_random_uuid(),'LOAN','Loan repayment'),(gen_random_uuid(),'ABSENCE','Absence deduction'),(gen_random_uuid(),'OTHER','Other deduction') ON CONFLICT ("code") DO NOTHING;
