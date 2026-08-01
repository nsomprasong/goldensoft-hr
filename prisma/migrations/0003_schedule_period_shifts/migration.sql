-- Shifts attached to a schedule period (period → shifts → employees).

CREATE TABLE IF NOT EXISTS "hr"."schedule_period_shifts" (
    "id" UUID NOT NULL,
    "schedule_period_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schedule_period_shifts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "schedule_period_shifts_schedule_period_id_shift_id_key"
  ON "hr"."schedule_period_shifts"("schedule_period_id", "shift_id");

CREATE INDEX IF NOT EXISTS "schedule_period_shifts_schedule_period_id_idx"
  ON "hr"."schedule_period_shifts"("schedule_period_id");

CREATE INDEX IF NOT EXISTS "schedule_period_shifts_shift_id_idx"
  ON "hr"."schedule_period_shifts"("shift_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schedule_period_shifts_schedule_period_id_fkey'
  ) THEN
    ALTER TABLE "hr"."schedule_period_shifts"
      ADD CONSTRAINT "schedule_period_shifts_schedule_period_id_fkey"
      FOREIGN KEY ("schedule_period_id") REFERENCES "hr"."schedule_periods"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schedule_period_shifts_shift_id_fkey'
  ) THEN
    ALTER TABLE "hr"."schedule_period_shifts"
      ADD CONSTRAINT "schedule_period_shifts_shift_id_fkey"
      FOREIGN KEY ("shift_id") REFERENCES "hr"."shifts"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill from existing assignments so periods already in use show their shifts.
INSERT INTO "hr"."schedule_period_shifts" ("id", "schedule_period_id", "shift_id")
SELECT gen_random_uuid(), sa.schedule_period_id, sa.shift_id
FROM (
  SELECT DISTINCT schedule_period_id, shift_id
  FROM "hr"."shift_assignments"
  WHERE shift_id IS NOT NULL
) sa
ON CONFLICT ("schedule_period_id", "shift_id") DO NOTHING;
