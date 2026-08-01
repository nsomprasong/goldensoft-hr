-- Employee supporting documents (files stored on disk; metadata in DB).
CREATE TABLE IF NOT EXISTS "hr"."employee_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_by_auth_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "employee_documents_employee_id_created_at_idx"
  ON "hr"."employee_documents"("employee_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "employee_documents_organization_id_idx"
  ON "hr"."employee_documents"("organization_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_documents_employee_id_fkey'
  ) THEN
    ALTER TABLE "hr"."employee_documents"
      ADD CONSTRAINT "employee_documents_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
