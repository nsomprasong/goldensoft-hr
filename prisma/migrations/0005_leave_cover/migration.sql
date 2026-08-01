-- Leave cover employee + shift assignment "covers for" marker

ALTER TABLE "hr"."leave_requests"
  ADD COLUMN IF NOT EXISTS "cover_employee_id" UUID;

ALTER TABLE "hr"."shift_assignments"
  ADD COLUMN IF NOT EXISTS "covers_for_employee_id" UUID;

CREATE INDEX IF NOT EXISTS "leave_requests_cover_employee_id_idx"
  ON "hr"."leave_requests" ("cover_employee_id");

CREATE INDEX IF NOT EXISTS "shift_assignments_covers_for_employee_id_idx"
  ON "hr"."shift_assignments" ("covers_for_employee_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_cover_employee_id_fkey'
  ) THEN
    ALTER TABLE "hr"."leave_requests"
      ADD CONSTRAINT "leave_requests_cover_employee_id_fkey"
      FOREIGN KEY ("cover_employee_id") REFERENCES "hr"."employees"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_assignments_covers_for_employee_id_fkey'
  ) THEN
    ALTER TABLE "hr"."shift_assignments"
      ADD CONSTRAINT "shift_assignments_covers_for_employee_id_fkey"
      FOREIGN KEY ("covers_for_employee_id") REFERENCES "hr"."employees"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
