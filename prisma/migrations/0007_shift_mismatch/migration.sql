-- Wrong-shift clock-in approval support

ALTER TABLE "hr"."attendance_days"
  ADD COLUMN IF NOT EXISTS "shift_mismatch_status" TEXT;

INSERT INTO "hr"."attendance_statuses" ("id", "code", "name", "sort_order", "is_active", "is_system", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'WRONG_SHIFT', 'ลงผิดกะ', 11, true, true, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = NOW();

CREATE TABLE IF NOT EXISTS "hr"."shift_mismatch_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "work_date" DATE NOT NULL,
  "schedule_period_id" UUID NOT NULL,
  "from_shift_id" UUID NOT NULL,
  "to_shift_id" UUID NOT NULL,
  "attendance_day_id" UUID,
  "attendance_event_id" UUID,
  "reason" TEXT NOT NULL,
  "status_id" UUID NOT NULL,
  "requested_by_auth_user_id" UUID NOT NULL,
  "reviewed_by_auth_user_id" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "review_note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "shift_mismatch_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "shift_mismatch_requests_organization_id_status_id_created_at_idx"
  ON "hr"."shift_mismatch_requests" ("organization_id", "status_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "shift_mismatch_requests_employee_id_work_date_status_id_idx"
  ON "hr"."shift_mismatch_requests" ("employee_id", "work_date" DESC, "status_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_mismatch_requests_employee_id_fkey'
  ) THEN
    ALTER TABLE "hr"."shift_mismatch_requests"
      ADD CONSTRAINT "shift_mismatch_requests_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_mismatch_requests_schedule_period_id_fkey'
  ) THEN
    ALTER TABLE "hr"."shift_mismatch_requests"
      ADD CONSTRAINT "shift_mismatch_requests_schedule_period_id_fkey"
      FOREIGN KEY ("schedule_period_id") REFERENCES "hr"."schedule_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_mismatch_requests_from_shift_id_fkey'
  ) THEN
    ALTER TABLE "hr"."shift_mismatch_requests"
      ADD CONSTRAINT "shift_mismatch_requests_from_shift_id_fkey"
      FOREIGN KEY ("from_shift_id") REFERENCES "hr"."shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_mismatch_requests_to_shift_id_fkey'
  ) THEN
    ALTER TABLE "hr"."shift_mismatch_requests"
      ADD CONSTRAINT "shift_mismatch_requests_to_shift_id_fkey"
      FOREIGN KEY ("to_shift_id") REFERENCES "hr"."shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_mismatch_requests_attendance_day_id_fkey'
  ) THEN
    ALTER TABLE "hr"."shift_mismatch_requests"
      ADD CONSTRAINT "shift_mismatch_requests_attendance_day_id_fkey"
      FOREIGN KEY ("attendance_day_id") REFERENCES "hr"."attendance_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_mismatch_requests_status_id_fkey'
  ) THEN
    ALTER TABLE "hr"."shift_mismatch_requests"
      ADD CONSTRAINT "shift_mismatch_requests_status_id_fkey"
      FOREIGN KEY ("status_id") REFERENCES "hr"."leave_request_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
