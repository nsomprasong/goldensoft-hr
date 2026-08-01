-- Phase 8: org face-match settings + employee face enrollment.

CREATE TABLE IF NOT EXISTS "hr"."attendance_face_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'OFF',
  "match_threshold" DECIMAL(8, 4) NOT NULL DEFAULT 0.55,
  "updated_by_auth_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_face_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_face_settings_organization_id_key" UNIQUE ("organization_id"),
  CONSTRAINT "attendance_face_settings_mode_check"
    CHECK ("mode" IN ('OFF', 'WARN', 'REQUIRE')),
  CONSTRAINT "attendance_face_settings_threshold_check"
    CHECK ("match_threshold" > 0 AND "match_threshold" <= 2)
);

CREATE TABLE IF NOT EXISTS "hr"."employee_face_enrollments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "descriptor" JSONB NOT NULL,
  "descriptor_version" TEXT NOT NULL DEFAULT 'face-api-128',
  "photo_url" TEXT,
  "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enrolled_by_auth_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_face_enrollments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_face_enrollments_employee_id_key" UNIQUE ("employee_id"),
  CONSTRAINT "employee_face_enrollments_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "employee_face_enrollments_organization_id_idx"
  ON "hr"."employee_face_enrollments" ("organization_id");
