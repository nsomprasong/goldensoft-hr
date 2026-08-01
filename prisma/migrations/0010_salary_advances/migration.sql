-- Salary advances (เบิกล่วงหน้า): record → approve → deduct on payroll → report

INSERT INTO "hr"."deduction_types" ("id", "code", "name", "is_taxable_reduction", "is_recurring_allowed", "is_active", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'ADVANCE', 'เบิกล่วงหน้า', false, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE IF NOT EXISTS "hr"."salary_advances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "amount" DECIMAL(14, 2) NOT NULL,
    "advance_date" DATE NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "deducted_payroll_run_id" UUID,
    "deducted_at" TIMESTAMPTZ(6),
    "created_by_auth_user_id" UUID NOT NULL,
    "approved_by_auth_user_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salary_advances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "salary_advances_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "salary_advances_status_check" CHECK (
      "status" IN ('RECORDED', 'APPROVED', 'DEDUCTED', 'CANCELLED')
    )
);

CREATE INDEX IF NOT EXISTS "salary_advances_org_status_idx"
  ON "hr"."salary_advances" ("organization_id", "status", "advance_date" DESC);

CREATE INDEX IF NOT EXISTS "salary_advances_employee_idx"
  ON "hr"."salary_advances" ("employee_id", "status");

ALTER TABLE "hr"."salary_advances"
  ADD CONSTRAINT "salary_advances_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE;

ALTER TABLE "hr"."salary_advances"
  ADD CONSTRAINT "salary_advances_run_id_fkey"
  FOREIGN KEY ("deducted_payroll_run_id") REFERENCES "hr"."payroll_runs"("id") ON DELETE SET NULL;
