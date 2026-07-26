-- GoldenSoft HR — Phase 8B core schema (PREVIEW ONLY).
-- Do NOT apply without explicit approval. No prisma migrate deploy / db push / migrate reset.
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
    (gen_random_uuid(), 'DAILY', 'รายวัน', 'Daily', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'MONTHLY', 'รายเดือน', 'Monthly', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'CONTRACT', 'สัญญาจ้าง', 'Contract', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'TEMPORARY', 'ชั่วคราว', 'Temporary', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- SeedMaster employee_statuses
INSERT INTO "hr"."employee_statuses" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'ACTIVE', 'ปฏิบัติงาน', 'Active', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'INACTIVE', 'ไม่ปฏิบัติงาน', 'Inactive', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'RESIGNED', 'ลาออก', 'Resigned', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'TERMINATED', 'เลิกจ้าง', 'Terminated', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'SUSPENDED', 'พักงาน', 'Suspended', 5, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- SeedMaster shift_types
INSERT INTO "hr"."shift_types" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'REGULAR', 'กะปกติ', 'Regular', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'NIGHT', 'กะกลางคืน', 'Night', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'SPLIT', 'กะแบ่งช่วง', 'Split', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'OFF', 'วันหยุด', 'Day off', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'LEAVE', 'วันลา', 'Leave', 5, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- SeedMaster pay_frequencies
INSERT INTO "hr"."pay_frequencies" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'SEMIMONTHLY', 'รายครึ่งเดือน', 'Semi-monthly', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'MONTHLY', 'รายเดือน', 'Monthly', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'WEEKLY', 'รายสัปดาห์', 'Weekly', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'DAILY', 'รายวัน', 'Daily', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- SeedMaster wage_types
INSERT INTO "hr"."wage_types" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'DAILY', 'ค่าจ้างรายวัน', 'Daily wage', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'MONTHLY', 'เงินเดือน', 'Monthly salary', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'HOURLY', 'ค่าจ้างรายชั่วโมง', 'Hourly wage', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- SeedMaster overtime_rate_types
INSERT INTO "hr"."overtime_rate_types" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'NORMAL_DAY', 'วันทำงานปกติ', 'Normal working day', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'HOLIDAY', 'วันหยุดนักขัตฤกษ์', 'Holiday', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'REST_DAY', 'วันหยุดประจำสัปดาห์', 'Weekly rest day', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'SPECIAL', 'อัตราพิเศษ', 'Special rate', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- SeedMaster payroll_period_statuses
INSERT INTO "hr"."payroll_period_statuses" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'DRAFT', 'ร่าง', 'Draft', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'OPEN', 'เปิดงวด', 'Open', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'CALCULATING', 'กำลังคำนวณ', 'Calculating', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'REVIEW', 'รอตรวจสอบ', 'Review', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'APPROVED', 'อนุมัติแล้ว', 'Approved', 5, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'PAID', 'จ่ายแล้ว', 'Paid', 6, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'LOCKED', 'ล็อกงวด', 'Locked', 7, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- SeedMaster audit_action_types
INSERT INTO "hr"."audit_action_types" ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'employee.create', 'สร้างพนักงาน', 'Create employee', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.update', 'แก้ไขข้อมูลพนักงาน', 'Update employee', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.deactivate', 'ปิดการใช้งานพนักงาน', 'Deactivate employee', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.link_user', 'เชื่อมบัญชีผู้ใช้กับพนักงาน', 'Link user account to employee', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.unlink_user', 'ยกเลิกการเชื่อมบัญชีผู้ใช้', 'Unlink user account from employee', 5, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'compensation.add', 'เพิ่มข้อมูลค่าจ้าง', 'Add compensation record', 6, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'department.create', 'สร้างแผนก', 'Create department', 7, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'department.update', 'แก้ไขแผนก', 'Update department', 8, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'department.deactivate', 'ปิดการใช้งานแผนก', 'Deactivate department', 9, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'position.create', 'สร้างตำแหน่ง', 'Create position', 10, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'position.update', 'แก้ไขตำแหน่ง', 'Update position', 11, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'position.deactivate', 'ปิดการใช้งานตำแหน่ง', 'Deactivate position', 12, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'shift.create', 'สร้างกะการทำงาน', 'Create shift', 13, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'shift.update', 'แก้ไขกะการทำงาน', 'Update shift', 14, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'shift.deactivate', 'ปิดการใช้งานกะการทำงาน', 'Deactivate shift', 15, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'payroll_schedule.create', 'สร้างรอบการจ่ายเงินเดือน', 'Create payroll schedule', 16, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'payroll_schedule.update', 'แก้ไขรอบการจ่ายเงินเดือน', 'Update payroll schedule', 17, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'payroll_period.create', 'สร้างงวดจ่ายเงินเดือน', 'Create payroll period', 18, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'payroll_period.status_change', 'เปลี่ยนสถานะงวดจ่ายเงินเดือน', 'Change payroll period status', 19, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'overtime_rule.create', 'สร้างกฎค่าล่วงเวลา', 'Create overtime rule', 20, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'overtime_rule.update', 'แก้ไขกฎค่าล่วงเวลา', 'Update overtime rule', 21, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'overtime_rule.deactivate', 'ปิดการใช้งานกฎค่าล่วงเวลา', 'Deactivate overtime rule', 22, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
