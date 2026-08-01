-- Late / absence pay settings on org payroll deduction settings.
-- LATE deduction type for payslip line mapping.

ALTER TABLE "hr"."payroll_deduction_settings"
  ADD COLUMN IF NOT EXISTS "late_deduction_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "late_baht_per_minute" DECIMAL(14, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "absence_deduction_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "absence_baht_per_day" DECIMAL(14, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_deduction_settings_late_rate_nonneg'
  ) THEN
    ALTER TABLE "hr"."payroll_deduction_settings"
      ADD CONSTRAINT "payroll_deduction_settings_late_rate_nonneg"
      CHECK ("late_baht_per_minute" >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_deduction_settings_absence_rate_nonneg'
  ) THEN
    ALTER TABLE "hr"."payroll_deduction_settings"
      ADD CONSTRAINT "payroll_deduction_settings_absence_rate_nonneg"
      CHECK ("absence_baht_per_day" >= 0);
  END IF;
END $$;

INSERT INTO "hr"."deduction_types" (
  "id", "code", "name", "is_taxable_reduction", "is_recurring_allowed",
  "is_active", "created_at", "updated_at"
)
VALUES (
  gen_random_uuid(), 'LATE', 'หักสาย', false, true, true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;
