-- Multi-org Auth ↔ Employee (additive). Do NOT apply without explicit approval.
-- - Account access + onboarding method masters (no enums)
-- - Nullable employee columns (backward compatible)
-- - Partial unique indexes so terminated+rehire can share auth within an org
-- - Activation challenges for OTP / invitation (mockable in app)

-- ─── Masters: account access ───────────────────────────────────────────────
CREATE TABLE "hr"."employee_account_access_statuses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_account_access_statuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_account_access_statuses_code_key"
    ON "hr"."employee_account_access_statuses"("code");

INSERT INTO "hr"."employee_account_access_statuses"
    ("id", "code", "name_th", "name_en", "sort_order", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'NOT_LINKED', 'ยังไม่เชื่อมบัญชี', 'Not linked', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'PENDING_ACTIVATION', 'รอเปิดใช้งาน', 'Pending activation', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'ACTIVE', 'เปิดใช้งานแล้ว', 'Active', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'DISABLED', 'ปิดบัญชีเข้าใช้', 'Disabled', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- ─── Masters: onboarding method ──────────────────────────────────────────
CREATE TABLE "hr"."employee_onboarding_methods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_onboarding_methods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_onboarding_methods_code_key"
    ON "hr"."employee_onboarding_methods"("code");

INSERT INTO "hr"."employee_onboarding_methods"
    ("id", "code", "name_th", "name_en", "sort_order", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'OTP_VERIFICATION', 'ส่ง OTP', 'OTP verification', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'INVITATION', 'ส่งคำเชิญ', 'Invitation', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'NO_NOTIFICATION', 'ไม่ส่งในตอนนี้', 'No notification', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- ─── Masters: activation challenge status ────────────────────────────────
CREATE TABLE "hr"."employee_activation_statuses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_activation_statuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_activation_statuses_code_key"
    ON "hr"."employee_activation_statuses"("code");

INSERT INTO "hr"."employee_activation_statuses"
    ("id", "code", "name_th", "name_en", "sort_order", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'PENDING', 'รอยืนยัน', 'Pending', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'VERIFIED', 'ยืนยันแล้ว', 'Verified', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'EXPIRED', 'หมดอายุ', 'Expired', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'CANCELLED', 'ยกเลิก', 'Cancelled', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- ─── Employee additive columns ───────────────────────────────────────────
ALTER TABLE "hr"."employees"
    ADD COLUMN IF NOT EXISTS "account_access_status_id" UUID,
    ADD COLUMN IF NOT EXISTS "onboarding_method_id" UUID,
    ADD COLUMN IF NOT EXISTS "account_activated_at" TIMESTAMPTZ(6),
    ADD COLUMN IF NOT EXISTS "account_disabled_at" TIMESTAMPTZ(6);

-- Backfill account access for existing rows (idempotent-friendly).
UPDATE "hr"."employees" e
SET "account_access_status_id" = s."id"
FROM "hr"."employee_account_access_statuses" s
WHERE e."account_access_status_id" IS NULL
  AND s."code" = CASE
    WHEN e."auth_user_id" IS NOT NULL AND e."is_active" = true THEN 'ACTIVE'
    WHEN e."auth_user_id" IS NOT NULL AND e."is_active" = false THEN 'DISABLED'
    ELSE 'NOT_LINKED'
  END;

ALTER TABLE "hr"."employees"
    ADD CONSTRAINT "employees_account_access_status_id_fkey"
    FOREIGN KEY ("account_access_status_id")
    REFERENCES "hr"."employee_account_access_statuses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hr"."employees"
    ADD CONSTRAINT "employees_onboarding_method_id_fkey"
    FOREIGN KEY ("onboarding_method_id")
    REFERENCES "hr"."employee_onboarding_methods"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "employees_account_access_status_id_idx"
    ON "hr"."employees"("account_access_status_id");

CREATE INDEX IF NOT EXISTS "employees_onboarding_method_id_idx"
    ON "hr"."employees"("onboarding_method_id");

-- Replace full uniques with partial uniques (active + linked only).
DROP INDEX IF EXISTS "hr"."employees_organization_id_auth_user_id_key";
DROP INDEX IF EXISTS "hr"."employees_organization_id_platform_user_id_key";

CREATE UNIQUE INDEX "employees_org_auth_active_uidx"
    ON "hr"."employees"("organization_id", "auth_user_id")
    WHERE "is_active" = true AND "auth_user_id" IS NOT NULL;

CREATE UNIQUE INDEX "employees_org_platform_user_active_uidx"
    ON "hr"."employees"("organization_id", "platform_user_id")
    WHERE "is_active" = true AND "platform_user_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "employees_organization_id_auth_user_id_idx"
    ON "hr"."employees"("organization_id", "auth_user_id");

CREATE INDEX IF NOT EXISTS "employees_organization_id_platform_user_id_idx"
    ON "hr"."employees"("organization_id", "platform_user_id");

-- ─── Activation challenges (OTP / invitation tokens) ─────────────────────
CREATE TABLE "hr"."employee_activation_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "onboarding_method_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "phone_normalized" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "consumed_at" TIMESTAMPTZ(6),
    "created_by_auth_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_activation_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "employee_activation_challenges_employee_id_fkey"
        FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employee_activation_challenges_onboarding_method_id_fkey"
        FOREIGN KEY ("onboarding_method_id") REFERENCES "hr"."employee_onboarding_methods"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "employee_activation_challenges_status_id_fkey"
        FOREIGN KEY ("status_id") REFERENCES "hr"."employee_activation_statuses"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "employee_activation_challenges_org_employee_idx"
    ON "hr"."employee_activation_challenges"("organization_id", "employee_id");

CREATE INDEX "employee_activation_challenges_status_idx"
    ON "hr"."employee_activation_challenges"("status_id");

CREATE INDEX "employee_activation_challenges_token_hash_idx"
    ON "hr"."employee_activation_challenges"("token_hash");

-- ─── Audit action types (additive codes) ─────────────────────────────────
INSERT INTO "hr"."audit_action_types"
    ("id", "code", "name_th", "name_en", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'employee.auth_detected', 'พบบัญชี Auth เดิม', 'Existing auth detected', 40, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.auth_linked', 'เชื่อม Auth กับพนักงาน', 'Auth linked', 41, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.auth_unlinked', 'ยกเลิกการเชื่อม Auth', 'Auth unlinked', 42, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.otp_requested', 'ขอ OTP เปิดบัญชี', 'OTP requested', 43, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.otp_verified', 'ยืนยัน OTP สำเร็จ', 'OTP verified', 44, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.invitation_created', 'สร้างคำเชิญพนักงาน', 'Invitation created', 45, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.invitation_accepted', 'ยอมรับคำเชิญพนักงาน', 'Invitation accepted', 46, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.no_notification_selected', 'เลือกไม่ส่งการแจ้งเตือน', 'No notification selected', 47, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.account_activated', 'เปิดบัญชีเข้าใช้งาน', 'Account activated', 48, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.account_disabled', 'ปิดบัญชีเข้าใช้งาน', 'Account disabled', 49, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'context.organization_switched', 'เปลี่ยนบริษัทในบริบท', 'Organization switched', 50, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'context.branch_switched', 'เปลี่ยนสาขาในบริบท', 'Branch switched', 51, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'face.enrolled', 'ลงทะเบียนใบหน้า', 'Face enrolled', 52, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'face.duplicate_blocked', 'บล็อกใบหน้าซ้ำในบริษัท', 'Face duplicate blocked', 53, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'face.revoked', 'ยกเลิกใบหน้า', 'Face revoked', 54, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.employment_terminated', 'สิ้นสุดการจ้างงาน', 'Employment terminated', 55, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'employee.employment_reactivated', 'เปิดการจ้างงานใหม่', 'Employment reactivated', 56, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
