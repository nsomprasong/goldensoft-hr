-- Phase 4 (2B): org-configurable tax / social-security deduction rates.
-- Not a claim of Thai legal completeness — rates are tenant settings for estimates.

CREATE TABLE IF NOT EXISTS "hr"."payroll_deduction_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "tax_enabled" BOOLEAN NOT NULL DEFAULT true,
    "tax_rate_percent" DECIMAL(8, 4) NOT NULL DEFAULT 0,
    "social_security_enabled" BOOLEAN NOT NULL DEFAULT true,
    "social_security_rate_percent" DECIMAL(8, 4) NOT NULL DEFAULT 5,
    "social_security_max_amount" DECIMAL(14, 2) NOT NULL DEFAULT 750,
    "updated_by_auth_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payroll_deduction_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_deduction_settings_org_key" UNIQUE ("organization_id"),
    CONSTRAINT "payroll_deduction_settings_tax_rate_nonneg" CHECK ("tax_rate_percent" >= 0),
    CONSTRAINT "payroll_deduction_settings_sso_rate_nonneg" CHECK ("social_security_rate_percent" >= 0),
    CONSTRAINT "payroll_deduction_settings_sso_max_nonneg" CHECK ("social_security_max_amount" >= 0)
);

CREATE INDEX IF NOT EXISTS "payroll_deduction_settings_org_idx"
  ON "hr"."payroll_deduction_settings" ("organization_id");
