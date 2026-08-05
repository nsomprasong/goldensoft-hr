-- Additive draft only. Do not apply without explicit approval.
CREATE TABLE "hr"."position_types" (
  "id" UUID NOT NULL, "code" TEXT NOT NULL, "name_th" TEXT NOT NULL, "name_en" TEXT NOT NULL, "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0, "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_system" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "position_types_pkey" PRIMARY KEY ("id"), CONSTRAINT "position_types_code_key" UNIQUE ("code")
);
CREATE TABLE "hr"."position_scope_types" (
  "id" UUID NOT NULL, "code" TEXT NOT NULL, "name_th" TEXT NOT NULL, "name_en" TEXT NOT NULL, "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0, "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_system" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "position_scope_types_pkey" PRIMARY KEY ("id"), CONSTRAINT "position_scope_types_code_key" UNIQUE ("code")
);
ALTER TABLE "hr"."positions" ADD COLUMN "branch_id" UUID, ADD COLUMN "position_type_id" UUID,
  ADD COLUMN "scope_type_id" UUID, ADD COLUMN "immutable_code" TEXT,
  ADD COLUMN "is_system_standard" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "default_role_id" UUID;
ALTER TABLE "hr"."positions" ALTER COLUMN "organization_id" DROP NOT NULL;
CREATE INDEX "positions_organization_id_branch_id_is_active_idx" ON "hr"."positions"("organization_id","branch_id","is_active");
ALTER TABLE "hr"."positions" ADD CONSTRAINT "positions_position_type_id_fkey" FOREIGN KEY ("position_type_id") REFERENCES "hr"."position_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hr"."positions" ADD CONSTRAINT "positions_scope_type_id_fkey" FOREIGN KEY ("scope_type_id") REFERENCES "hr"."position_scope_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "hr"."position_roles" (
  "id" UUID NOT NULL, "position_id" UUID NOT NULL, "organization_role_id" UUID NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "position_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "position_roles_position_id_organization_role_id_key" UNIQUE ("position_id","organization_role_id"),
  CONSTRAINT "position_roles_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "hr"."positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "position_roles_organization_role_id_idx" ON "hr"."position_roles"("organization_role_id");
CREATE TABLE "hr"."employee_role_assignments" (
  "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "branch_id" UUID, "employee_id" UUID NOT NULL,
  "organization_role_id" UUID NOT NULL, "source_position_id" UUID, "assignment_source_id" UUID, "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true, "assigned_by" UUID NOT NULL,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revoked_at" TIMESTAMPTZ(6),
  CONSTRAINT "employee_role_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_role_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employee_role_assignments_source_position_id_fkey" FOREIGN KEY ("source_position_id") REFERENCES "hr"."positions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "hr"."employee_role_assignment_sources" (
  "id" UUID NOT NULL, "code" TEXT NOT NULL, "name_th" TEXT NOT NULL, "name_en" TEXT NOT NULL, "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0, "is_active" BOOLEAN NOT NULL DEFAULT true, "is_system" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_role_assignment_sources_pkey" PRIMARY KEY ("id"), CONSTRAINT "employee_role_assignment_sources_code_key" UNIQUE ("code")
);
INSERT INTO "hr"."employee_role_assignment_sources" ("id","code","name_th","name_en","sort_order") VALUES
  (gen_random_uuid(),'POSITION_RECOMMENDATION','ใช้บทบาทที่แนะนำจากตำแหน่ง','Position recommendation',10),
  (gen_random_uuid(),'MANUAL_ASSIGNMENT','เลือกบทบาทอื่น','Manual assignment',20),
  (gen_random_uuid(),'KEEP_EXISTING','ใช้บทบาทเดิม','Keep existing role',30);
ALTER TABLE "hr"."employee_role_assignments" ADD CONSTRAINT "employee_role_assignments_assignment_source_id_fkey" FOREIGN KEY ("assignment_source_id") REFERENCES "hr"."employee_role_assignment_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "employee_role_assignments_organization_id_employee_id_is_active_idx" ON "hr"."employee_role_assignments"("organization_id","employee_id","is_active");
CREATE INDEX "employee_role_assignments_organization_role_id_idx" ON "hr"."employee_role_assignments"("organization_role_id");
CREATE INDEX "employee_role_assignments_source_position_id_idx" ON "hr"."employee_role_assignments"("source_position_id");
CREATE INDEX "employee_role_assignments_assignment_source_id_idx" ON "hr"."employee_role_assignments"("assignment_source_id");
INSERT INTO "hr"."position_types" ("id","code","name_th","name_en","sort_order") VALUES
  (gen_random_uuid(),'SYSTEM_STANDARD','ตำแหน่งมาตรฐาน','System standard position',10),
  (gen_random_uuid(),'ORGANIZATION_CUSTOM','ตำแหน่งที่องค์กรสร้าง','Organization position',20);
INSERT INTO "hr"."position_scope_types" ("id","code","name_th","name_en","sort_order") VALUES
  (gen_random_uuid(),'SYSTEM_STANDARD','ตำแหน่งมาตรฐาน','System standard',5),
  (gen_random_uuid(),'ORGANIZATION','ใช้ทุกสาขาในองค์กร','Organization level',10),
  (gen_random_uuid(),'BRANCH','ใช้เฉพาะสาขา','Branch level',20);
UPDATE "hr"."positions" SET "position_type_id"=(SELECT id FROM "hr"."position_types" WHERE code='ORGANIZATION_CUSTOM'), "scope_type_id"=(SELECT id FROM "hr"."position_scope_types" WHERE code='ORGANIZATION');

-- SQL-only invariants. These preserve history while preventing duplicate current state.
ALTER TABLE "hr"."positions" ADD CONSTRAINT "positions_scope_shape_check" CHECK (
  ("is_system_standard" = true AND "organization_id" IS NULL AND "branch_id" IS NULL)
  OR ("is_system_standard" = false AND "organization_id" IS NOT NULL)
);
CREATE UNIQUE INDEX "positions_standard_immutable_code_key" ON "hr"."positions"("immutable_code") WHERE "is_system_standard" = true;
CREATE UNIQUE INDEX "positions_org_name_scope_key" ON "hr"."positions"("organization_id", lower(btrim("name_th"))) WHERE "is_system_standard" = false AND "branch_id" IS NULL;
CREATE UNIQUE INDEX "positions_branch_name_scope_key" ON "hr"."positions"("organization_id", "branch_id", lower(btrim("name_th"))) WHERE "is_system_standard" = false AND "branch_id" IS NOT NULL;
CREATE UNIQUE INDEX "position_roles_one_primary_key" ON "hr"."position_roles"("position_id") WHERE "is_primary" = true;
CREATE UNIQUE INDEX "employee_role_assignments_active_role_key" ON "hr"."employee_role_assignments"("organization_id", "employee_id", "organization_role_id") WHERE "is_active" = true AND "revoked_at" IS NULL;
CREATE UNIQUE INDEX "employee_role_assignments_one_primary_key" ON "hr"."employee_role_assignments"("organization_id", "employee_id") WHERE "is_primary" = true AND "is_active" = true AND "revoked_at" IS NULL;
ALTER TABLE "hr"."employee_role_assignments" ADD CONSTRAINT "employee_role_assignments_active_state_check"
  CHECK (("is_active" = true AND "revoked_at" IS NULL) OR ("is_active" = false AND "revoked_at" IS NOT NULL));
