-- Snapshot display name of the approver at review time.
ALTER TABLE "hr"."leave_requests"
  ADD COLUMN IF NOT EXISTS "reviewed_by_name" TEXT;

ALTER TABLE "hr"."overtime_requests"
  ADD COLUMN IF NOT EXISTS "reviewed_by_name" TEXT;

ALTER TABLE "hr"."attendance_adjustments"
  ADD COLUMN IF NOT EXISTS "reviewed_by_name" TEXT;

ALTER TABLE "hr"."shift_mismatch_requests"
  ADD COLUMN IF NOT EXISTS "reviewed_by_name" TEXT;
