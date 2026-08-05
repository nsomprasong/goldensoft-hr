-- GoldenSoft HR - Phase 8B core schema.
-- Approved for apply (Phase 8B Apply). Additive only - no reset / db push.
--
-- Scope guarantees reviewed in docs/phase8b-schema-review.md:
--   * Every object is created inside schema hr and nowhere else.
--   * No PostgreSQL enum types; status/type columns reference master tables with immutable code.
--   * organization_id / branch_id / platform_user_id / auth_user_id are soft UUID references
--     with no cross-schema foreign keys.
--   * Additive only: no DROP, no TRUNCATE, no destructive ALTER.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "hr";

-- CreateTable
CREATE TABLE "hr"."employment_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employee_statuses" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."shift_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shift_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."pay_frequencies" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pay_frequencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."wage_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wage_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."overtime_rate_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "overtime_rate_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."payroll_period_statuses" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_period_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."audit_action_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "audit_action_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."departments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."positions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "department_id" UUID,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."work_locations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "geofence_radius_meters" INTEGER NOT NULL DEFAULT 50,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employees" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_code" TEXT NOT NULL,
    "platform_user_id" UUID,
    "auth_user_id" UUID,
    "branch_id" UUID NOT NULL,
    "department_id" UUID,
    "position_id" UUID,
    "employment_type_id" UUID NOT NULL,
    "employee_status_id" UUID NOT NULL,
    "first_name_th" TEXT NOT NULL,
    "last_name_th" TEXT NOT NULL,
    "first_name_en" TEXT,
    "last_name_en" TEXT,
    "display_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "hire_date" DATE NOT NULL,
    "probation_end_date" DATE,
    "resignation_date" DATE,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employee_branch_assignments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_branch_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."employee_compensations" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "wage_type_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "standard_hours_per_day" DECIMAL(5,2),
    "standard_days_per_month" DECIMAL(5,2),
    "overtime_eligible" BOOLEAN NOT NULL DEFAULT true,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_compensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."overtime_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate_type_id" UUID NOT NULL,
    "multiplier" DECIMAL(6,3) NOT NULL,
    "fixed_amount" DECIMAL(14,2),
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "overtime_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."shifts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shift_type_id" UUID NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "grace_late_minutes" INTEGER NOT NULL DEFAULT 0,
    "grace_early_leave_minutes" INTEGER NOT NULL DEFAULT 0,
    "crosses_midnight" BOOLEAN NOT NULL DEFAULT false,
    "standard_work_minutes" INTEGER NOT NULL,
    "overtime_after_minutes" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."payroll_schedules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pay_frequency_id" UUID NOT NULL,
    "period_start_rule" TEXT NOT NULL,
    "period_end_rule" TEXT NOT NULL,
    "payment_day_rule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."payroll_periods" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "payroll_schedule_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "payment_date" DATE NOT NULL,
    "status_id" UUID NOT NULL,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "branch_id" UUID,
    "actor_auth_user_id" UUID,
    "action_type_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."demo_seed_markers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "marker_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_seed_markers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employment_types_code_key" ON "hr"."employment_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "employee_statuses_code_key" ON "hr"."employee_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "shift_types_code_key" ON "hr"."shift_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "pay_frequencies_code_key" ON "hr"."pay_frequencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "wage_types_code_key" ON "hr"."wage_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_rate_types_code_key" ON "hr"."overtime_rate_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_period_statuses_code_key" ON "hr"."payroll_period_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "audit_action_types_code_key" ON "hr"."audit_action_types"("code");

-- CreateIndex
CREATE INDEX "departments_organization_id_is_active_idx" ON "hr"."departments"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organization_id_code_key" ON "hr"."departments"("organization_id", "code");

-- CreateIndex
CREATE INDEX "positions_organization_id_is_active_idx" ON "hr"."positions"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "positions_department_id_idx" ON "hr"."positions"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "positions_organization_id_code_key" ON "hr"."positions"("organization_id", "code");

-- CreateIndex
CREATE INDEX "work_locations_organization_id_is_active_idx" ON "hr"."work_locations"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "work_locations_branch_id_idx" ON "hr"."work_locations"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_locations_organization_id_code_key" ON "hr"."work_locations"("organization_id", "code");

-- CreateIndex
CREATE INDEX "employees_organization_id_idx" ON "hr"."employees"("organization_id");

-- CreateIndex
CREATE INDEX "employees_branch_id_idx" ON "hr"."employees"("branch_id");

-- CreateIndex
CREATE INDEX "employees_employee_status_id_idx" ON "hr"."employees"("employee_status_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_is_active_idx" ON "hr"."employees"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "employees_department_id_idx" ON "hr"."employees"("department_id");

-- CreateIndex
CREATE INDEX "employees_position_id_idx" ON "hr"."employees"("position_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_employee_code_key" ON "hr"."employees"("organization_id", "employee_code");

-- CreateIndex
-- NULL platform_user_id values stay distinct in PostgreSQL, so unlinked employees never collide.
CREATE UNIQUE INDEX "employees_organization_id_platform_user_id_key" ON "hr"."employees"("organization_id", "platform_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_auth_user_id_key" ON "hr"."employees"("organization_id", "auth_user_id");

-- CreateIndex
CREATE INDEX "employee_branch_assignments_employee_id_is_primary_idx" ON "hr"."employee_branch_assignments"("employee_id", "is_primary");

-- CreateIndex
CREATE INDEX "employee_branch_assignments_branch_id_idx" ON "hr"."employee_branch_assignments"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_branch_assignments_employee_id_branch_id_effective_key" ON "hr"."employee_branch_assignments"("employee_id", "branch_id", "effective_from");

-- CreateIndex
CREATE INDEX "employee_compensations_employee_id_idx" ON "hr"."employee_compensations"("employee_id");

-- CreateIndex
CREATE INDEX "employee_compensations_employee_id_is_current_idx" ON "hr"."employee_compensations"("employee_id", "is_current");

-- CreateIndex
CREATE INDEX "employee_compensations_wage_type_id_idx" ON "hr"."employee_compensations"("wage_type_id");

-- CreateIndex
CREATE INDEX "overtime_rules_organization_id_is_active_idx" ON "hr"."overtime_rules"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "overtime_rules_rate_type_id_idx" ON "hr"."overtime_rules"("rate_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_rules_organization_id_code_key" ON "hr"."overtime_rules"("organization_id", "code");

-- CreateIndex
CREATE INDEX "shifts_organization_id_is_active_idx" ON "hr"."shifts"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "shifts_branch_id_idx" ON "hr"."shifts"("branch_id");

-- CreateIndex
CREATE INDEX "shifts_shift_type_id_idx" ON "hr"."shifts"("shift_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_organization_id_code_key" ON "hr"."shifts"("organization_id", "code");

-- CreateIndex
CREATE INDEX "payroll_schedules_organization_id_is_active_idx" ON "hr"."payroll_schedules"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "payroll_schedules_pay_frequency_id_idx" ON "hr"."payroll_schedules"("pay_frequency_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_schedules_organization_id_code_key" ON "hr"."payroll_schedules"("organization_id", "code");

-- CreateIndex
CREATE INDEX "payroll_periods_organization_id_status_id_idx" ON "hr"."payroll_periods"("organization_id", "status_id");

-- CreateIndex
CREATE INDEX "payroll_periods_payroll_schedule_id_idx" ON "hr"."payroll_periods"("payroll_schedule_id");

-- CreateIndex
CREATE INDEX "payroll_periods_organization_id_period_start_idx" ON "hr"."payroll_periods"("organization_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_periods_organization_id_payroll_schedule_id_period__key" ON "hr"."payroll_periods"("organization_id", "payroll_schedule_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "hr"."audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "hr"."audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_auth_user_id_idx" ON "hr"."audit_logs"("actor_auth_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_type_id_idx" ON "hr"."audit_logs"("action_type_id");

-- CreateIndex
CREATE INDEX "demo_seed_markers_organization_id_idx" ON "hr"."demo_seed_markers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "demo_seed_markers_organization_id_marker_key_key" ON "hr"."demo_seed_markers"("organization_id", "marker_key");

-- AddForeignKey
ALTER TABLE "hr"."positions" ADD CONSTRAINT "positions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "hr"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "hr"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "hr"."positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_employment_type_id_fkey" FOREIGN KEY ("employment_type_id") REFERENCES "hr"."employment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_employee_status_id_fkey" FOREIGN KEY ("employee_status_id") REFERENCES "hr"."employee_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_branch_assignments" ADD CONSTRAINT "employee_branch_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_compensations" ADD CONSTRAINT "employee_compensations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."employee_compensations" ADD CONSTRAINT "employee_compensations_wage_type_id_fkey" FOREIGN KEY ("wage_type_id") REFERENCES "hr"."wage_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."overtime_rules" ADD CONSTRAINT "overtime_rules_rate_type_id_fkey" FOREIGN KEY ("rate_type_id") REFERENCES "hr"."overtime_rate_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."shifts" ADD CONSTRAINT "shifts_shift_type_id_fkey" FOREIGN KEY ("shift_type_id") REFERENCES "hr"."shift_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."payroll_schedules" ADD CONSTRAINT "payroll_schedules_pay_frequency_id_fkey" FOREIGN KEY ("pay_frequency_id") REFERENCES "hr"."pay_frequencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."payroll_periods" ADD CONSTRAINT "payroll_periods_payroll_schedule_id_fkey" FOREIGN KEY ("payroll_schedule_id") REFERENCES "hr"."payroll_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."payroll_periods" ADD CONSTRAINT "payroll_periods_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "hr"."payroll_period_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."audit_logs" ADD CONSTRAINT "audit_logs_action_type_id_fkey" FOREIGN KEY ("action_type_id") REFERENCES "hr"."audit_action_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint
-- Database-level guards. They are not expressible in the Prisma model, so the
-- application layer validates the same rules before writing.
ALTER TABLE "hr"."employee_compensations" ADD CONSTRAINT "employee_compensations_amount_non_negative" CHECK ("amount" >= 0);

-- AddCheckConstraint
ALTER TABLE "hr"."work_locations" ADD CONSTRAINT "work_locations_geofence_radius_positive" CHECK ("geofence_radius_meters" > 0);

-- SeedMaster employment_types
INSERT INTO "hr"."employment_types" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'DAILY', 'เธฃเธฒเธขเธงเธฑเธ', 'Daily', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'MONTHLY', 'เธฃเธฒเธขเน€เธ”เธทเธญเธ', 'Monthly', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'CONTRACT', 'เธชเธฑเธเธเธฒเธเนเธฒเธ', 'Contract', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'TEMPORARY', 'เธเธฑเนเธงเธเธฃเธฒเธง', 'Temporary', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- SeedMaster employee_statuses
INSERT INTO "hr"."employee_statuses" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'ACTIVE', 'เธเธเธดเธเธฑเธ•เธดเธเธฒเธ', 'Active', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'INACTIVE', 'เนเธกเนเธเธเธดเธเธฑเธ•เธดเธเธฒเธ', 'Inactive', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'RESIGNED', 'เธฅเธฒเธญเธญเธ', 'Resigned', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'TERMINATED', 'เน€เธฅเธดเธเธเนเธฒเธ', 'Terminated', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'SUSPENDED', 'เธเธฑเธเธเธฒเธ', 'Suspended', 5, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- SeedMaster shift_types
INSERT INTO "hr"."shift_types" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'REGULAR', 'เธเธฐเธเธเธ•เธด', 'Regular', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'NIGHT', 'เธเธฐเธเธฅเธฒเธเธเธทเธ', 'Night', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'SPLIT', 'เธเธฐเนเธเนเธเธเนเธงเธ', 'Split', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'OFF', 'เธงเธฑเธเธซเธขเธธเธ”', 'Day off', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'LEAVE', 'เธงเธฑเธเธฅเธฒ', 'Leave', 5, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- SeedMaster pay_frequencies
INSERT INTO "hr"."pay_frequencies" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'SEMIMONTHLY', 'เธฃเธฒเธขเธเธฃเธถเนเธเน€เธ”เธทเธญเธ', 'Semi-monthly', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'MONTHLY', 'เธฃเธฒเธขเน€เธ”เธทเธญเธ', 'Monthly', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'WEEKLY', 'เธฃเธฒเธขเธชเธฑเธเธ”เธฒเธซเน', 'Weekly', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'DAILY', 'เธฃเธฒเธขเธงเธฑเธ', 'Daily', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- SeedMaster wage_types
INSERT INTO "hr"."wage_types" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'DAILY', 'เธเนเธฒเธเนเธฒเธเธฃเธฒเธขเธงเธฑเธ', 'Daily wage', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'MONTHLY', 'เน€เธเธดเธเน€เธ”เธทเธญเธ', 'Monthly salary', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'HOURLY', 'เธเนเธฒเธเนเธฒเธเธฃเธฒเธขเธเธฑเนเธงเนเธกเธ', 'Hourly wage', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- SeedMaster overtime_rate_types
INSERT INTO "hr"."overtime_rate_types" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'NORMAL_DAY', 'เธงเธฑเธเธ—เธณเธเธฒเธเธเธเธ•เธด', 'Normal working day', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'HOLIDAY', 'เธงเธฑเธเธซเธขเธธเธ”เธเธฑเธเธเธฑเธ•เธคเธเธฉเน', 'Holiday', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'REST_DAY', 'เธงเธฑเธเธซเธขเธธเธ”เธเธฃเธฐเธเธณเธชเธฑเธเธ”เธฒเธซเน', 'Weekly rest day', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'SPECIAL', 'เธญเธฑเธ•เธฃเธฒเธเธดเน€เธจเธฉ', 'Special rate', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- SeedMaster payroll_period_statuses
INSERT INTO "hr"."payroll_period_statuses" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'DRAFT', 'เธฃเนเธฒเธ', 'Draft', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'OPEN', 'เน€เธเธดเธ”เธเธงเธ”', 'Open', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'CALCULATING', 'เธเธณเธฅเธฑเธเธเธณเธเธงเธ“', 'Calculating', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'REVIEW', 'เธฃเธญเธ•เธฃเธงเธเธชเธญเธ', 'Review', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'APPROVED', 'เธญเธเธธเธกเธฑเธ•เธดเนเธฅเนเธง', 'Approved', 5, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'PAID', 'เธเนเธฒเธขเนเธฅเนเธง', 'Paid', 6, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'LOCKED', 'เธฅเนเธญเธเธเธงเธ”', 'Locked', 7, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- SeedMaster audit_action_types
INSERT INTO "hr"."audit_action_types" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'employee.create', 'เธชเธฃเนเธฒเธเธเธเธฑเธเธเธฒเธ', 'Create employee', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.update', 'เนเธเนเนเธเธเนเธญเธกเธนเธฅเธเธเธฑเธเธเธฒเธ', 'Update employee', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.deactivate', 'เธเธดเธ”เธเธฒเธฃเนเธเนเธเธฒเธเธเธเธฑเธเธเธฒเธ', 'Deactivate employee', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.link_user', 'เน€เธเธทเนเธญเธกเธเธฑเธเธเธตเธเธนเนเนเธเนเธเธฑเธเธเธเธฑเธเธเธฒเธ', 'Link user account to employee', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.unlink_user', 'เธขเธเน€เธฅเธดเธเธเธฒเธฃเน€เธเธทเนเธญเธกเธเธฑเธเธเธตเธเธนเนเนเธเน', 'Unlink user account from employee', 5, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'compensation.add', 'เน€เธเธดเนเธกเธเนเธญเธกเธนเธฅเธเนเธฒเธเนเธฒเธ', 'Add compensation record', 6, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'department.create', 'เธชเธฃเนเธฒเธเนเธเธเธ', 'Create department', 7, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'department.update', 'เนเธเนเนเธเนเธเธเธ', 'Update department', 8, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'department.deactivate', 'เธเธดเธ”เธเธฒเธฃเนเธเนเธเธฒเธเนเธเธเธ', 'Deactivate department', 9, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'position.create', 'เธชเธฃเนเธฒเธเธ•เธณเนเธซเธเนเธ', 'Create position', 10, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'position.update', 'เนเธเนเนเธเธ•เธณเนเธซเธเนเธ', 'Update position', 11, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'position.deactivate', 'เธเธดเธ”เธเธฒเธฃเนเธเนเธเธฒเธเธ•เธณเนเธซเธเนเธ', 'Deactivate position', 12, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'shift.create', 'เธชเธฃเนเธฒเธเธเธฐเธเธฒเธฃเธ—เธณเธเธฒเธ', 'Create shift', 13, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'shift.update', 'เนเธเนเนเธเธเธฐเธเธฒเธฃเธ—เธณเธเธฒเธ', 'Update shift', 14, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'shift.deactivate', 'เธเธดเธ”เธเธฒเธฃเนเธเนเธเธฒเธเธเธฐเธเธฒเธฃเธ—เธณเธเธฒเธ', 'Deactivate shift', 15, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'payroll_schedule.create', 'เธชเธฃเนเธฒเธเธฃเธญเธเธเธฒเธฃเธเนเธฒเธขเน€เธเธดเธเน€เธ”เธทเธญเธ', 'Create payroll schedule', 16, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'payroll_schedule.update', 'เนเธเนเนเธเธฃเธญเธเธเธฒเธฃเธเนเธฒเธขเน€เธเธดเธเน€เธ”เธทเธญเธ', 'Update payroll schedule', 17, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'payroll_period.create', 'เธชเธฃเนเธฒเธเธเธงเธ”เธเนเธฒเธขเน€เธเธดเธเน€เธ”เธทเธญเธ', 'Create payroll period', 18, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'payroll_period.status_change', 'เน€เธเธฅเธตเนเธขเธเธชเธ–เธฒเธเธฐเธเธงเธ”เธเนเธฒเธขเน€เธเธดเธเน€เธ”เธทเธญเธ', 'Change payroll period status', 19, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'overtime_rule.create', 'เธชเธฃเนเธฒเธเธเธเธเนเธฒเธฅเนเธงเธเน€เธงเธฅเธฒ', 'Create overtime rule', 20, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'overtime_rule.update', 'เนเธเนเนเธเธเธเธเนเธฒเธฅเนเธงเธเน€เธงเธฅเธฒ', 'Update overtime rule', 21, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'overtime_rule.deactivate', 'เธเธดเธ”เธเธฒเธฃเนเธเนเธเธฒเธเธเธเธเนเธฒเธฅเนเธงเธเน€เธงเธฅเธฒ', 'Deactivate overtime rule', 22, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
