-- Allow advance installment plans without pre-created payroll periods.
-- Periods are bound when a payroll run is calculated.

ALTER TABLE "hr"."salary_advance_installments"
  ALTER COLUMN "payroll_period_id" DROP NOT NULL;
