-- Salary advances: request/approve, disbursement mode, multi-period installments

INSERT INTO "hr"."earning_types" ("id", "code", "name", "is_taxable", "is_recurring_allowed", "is_active", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'ADVANCE_PAYOUT', 'จ่ายเบิกล่วงหน้า', false, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "hr"."salary_advances"
  ADD COLUMN IF NOT EXISTS "installment_count" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "start_payroll_period_id" UUID,
  ADD COLUMN IF NOT EXISTS "disbursement_mode" TEXT,
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "review_note" TEXT,
  ADD COLUMN IF NOT EXISTS "credited_payroll_run_id" UUID,
  ADD COLUMN IF NOT EXISTS "credited_at" TIMESTAMPTZ(6);

ALTER TABLE "hr"."salary_advances" DROP CONSTRAINT IF EXISTS "salary_advances_status_check";
ALTER TABLE "hr"."salary_advances"
  ADD CONSTRAINT "salary_advances_status_check" CHECK (
    "status" IN (
      'SUBMITTED',
      'APPROVED',
      'PARTIALLY_DEDUCTED',
      'DEDUCTED',
      'REJECTED',
      'CANCELLED',
      'RECORDED'
    )
  );

ALTER TABLE "hr"."salary_advances" DROP CONSTRAINT IF EXISTS "salary_advances_installment_count_check";
ALTER TABLE "hr"."salary_advances"
  ADD CONSTRAINT "salary_advances_installment_count_check"
  CHECK ("installment_count" >= 1 AND "installment_count" <= 24);

ALTER TABLE "hr"."salary_advances" DROP CONSTRAINT IF EXISTS "salary_advances_disbursement_mode_check";
ALTER TABLE "hr"."salary_advances"
  ADD CONSTRAINT "salary_advances_disbursement_mode_check"
  CHECK (
    "disbursement_mode" IS NULL
    OR "disbursement_mode" IN ('CASH_ALREADY', 'WITH_SALARY')
  );

UPDATE "hr"."salary_advances"
SET
  "installment_count" = COALESCE("installment_count", 1),
  "disbursement_mode" = COALESCE("disbursement_mode", 'CASH_ALREADY'),
  "submitted_at" = COALESCE("submitted_at", "created_at")
WHERE "status" IN ('APPROVED', 'DEDUCTED', 'RECORDED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "hr"."salary_advance_installments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "salary_advance_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "amount" DECIMAL(14, 2) NOT NULL,
    "payroll_period_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deducted_payroll_run_id" UUID,
    "deducted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salary_advance_installments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "salary_advance_installments_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "salary_advance_installments_sequence_positive" CHECK ("sequence" >= 1),
    CONSTRAINT "salary_advance_installments_status_check" CHECK (
      "status" IN ('PENDING', 'DEDUCTED', 'CANCELLED')
    ),
    CONSTRAINT "salary_advance_installments_advance_seq_key"
      UNIQUE ("salary_advance_id", "sequence")
);

CREATE INDEX IF NOT EXISTS "salary_advance_installments_period_status_idx"
  ON "hr"."salary_advance_installments" ("organization_id", "payroll_period_id", "status");

CREATE INDEX IF NOT EXISTS "salary_advance_installments_advance_idx"
  ON "hr"."salary_advance_installments" ("salary_advance_id", "sequence");

ALTER TABLE "hr"."salary_advance_installments"
  DROP CONSTRAINT IF EXISTS "salary_advance_installments_advance_fkey";
ALTER TABLE "hr"."salary_advance_installments"
  ADD CONSTRAINT "salary_advance_installments_advance_fkey"
  FOREIGN KEY ("salary_advance_id") REFERENCES "hr"."salary_advances"("id") ON DELETE CASCADE;

ALTER TABLE "hr"."salary_advance_installments"
  DROP CONSTRAINT IF EXISTS "salary_advance_installments_period_fkey";
ALTER TABLE "hr"."salary_advance_installments"
  ADD CONSTRAINT "salary_advance_installments_period_fkey"
  FOREIGN KEY ("payroll_period_id") REFERENCES "hr"."payroll_periods"("id") ON DELETE RESTRICT;

ALTER TABLE "hr"."salary_advance_installments"
  DROP CONSTRAINT IF EXISTS "salary_advance_installments_run_fkey";
ALTER TABLE "hr"."salary_advance_installments"
  ADD CONSTRAINT "salary_advance_installments_run_fkey"
  FOREIGN KEY ("deducted_payroll_run_id") REFERENCES "hr"."payroll_runs"("id") ON DELETE SET NULL;

ALTER TABLE "hr"."salary_advances"
  DROP CONSTRAINT IF EXISTS "salary_advances_start_period_fkey";
ALTER TABLE "hr"."salary_advances"
  ADD CONSTRAINT "salary_advances_start_period_fkey"
  FOREIGN KEY ("start_payroll_period_id") REFERENCES "hr"."payroll_periods"("id") ON DELETE SET NULL;

ALTER TABLE "hr"."salary_advances"
  DROP CONSTRAINT IF EXISTS "salary_advances_credited_run_fkey";
ALTER TABLE "hr"."salary_advances"
  ADD CONSTRAINT "salary_advances_credited_run_fkey"
  FOREIGN KEY ("credited_payroll_run_id") REFERENCES "hr"."payroll_runs"("id") ON DELETE SET NULL;

-- Backfill one installment for legacy approved/deducted rows that have a start period
-- (rows without a period stay deductable via legacy full-amount path until re-approved).
