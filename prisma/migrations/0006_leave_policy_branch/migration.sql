-- Branch override support on leave policies

ALTER TABLE "hr"."leave_policies"
  ADD COLUMN IF NOT EXISTS "branch_id" UUID;

CREATE INDEX IF NOT EXISTS "leave_policies_organization_id_leave_type_id_branch_id_is_active_idx"
  ON "hr"."leave_policies" ("organization_id", "leave_type_id", "branch_id", "is_active");

-- One org default per leave type (branch_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "leave_policies_org_default_unique"
  ON "hr"."leave_policies" ("organization_id", "leave_type_id")
  WHERE "branch_id" IS NULL AND "is_active" = true;

-- One branch override per leave type
CREATE UNIQUE INDEX IF NOT EXISTS "leave_policies_branch_override_unique"
  ON "hr"."leave_policies" ("organization_id", "leave_type_id", "branch_id")
  WHERE "branch_id" IS NOT NULL AND "is_active" = true;
