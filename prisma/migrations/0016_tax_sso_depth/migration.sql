-- Phase 8 Track B: progressive tax method + SSO wage base bounds.
-- Estimates for payroll withholding — not legal advice / full RD compliance.

ALTER TABLE "hr"."payroll_deduction_settings"
  ADD COLUMN IF NOT EXISTS "tax_method" TEXT NOT NULL DEFAULT 'FLAT',
  ADD COLUMN IF NOT EXISTS "tax_personal_allowance" DECIMAL(14, 2) NOT NULL DEFAULT 60000,
  ADD COLUMN IF NOT EXISTS "tax_expense_deduction_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "social_security_wage_base_min" DECIMAL(14, 2) NOT NULL DEFAULT 1650,
  ADD COLUMN IF NOT EXISTS "social_security_wage_base_max" DECIMAL(14, 2) NOT NULL DEFAULT 15000;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_deduction_settings_tax_method_check'
  ) THEN
    ALTER TABLE "hr"."payroll_deduction_settings"
      ADD CONSTRAINT "payroll_deduction_settings_tax_method_check"
      CHECK ("tax_method" IN ('FLAT', 'PROGRESSIVE'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_deduction_settings_tax_allowance_nonneg'
  ) THEN
    ALTER TABLE "hr"."payroll_deduction_settings"
      ADD CONSTRAINT "payroll_deduction_settings_tax_allowance_nonneg"
      CHECK ("tax_personal_allowance" >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_deduction_settings_sso_base_min_nonneg'
  ) THEN
    ALTER TABLE "hr"."payroll_deduction_settings"
      ADD CONSTRAINT "payroll_deduction_settings_sso_base_min_nonneg"
      CHECK ("social_security_wage_base_min" >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_deduction_settings_sso_base_max_nonneg'
  ) THEN
    ALTER TABLE "hr"."payroll_deduction_settings"
      ADD CONSTRAINT "payroll_deduction_settings_sso_base_max_nonneg"
      CHECK ("social_security_wage_base_max" >= 0);
  END IF;
END $$;
