-- Evidence: bank transfer slip for immediate salary-advance payout

ALTER TABLE "hr"."salary_advances"
  ADD COLUMN IF NOT EXISTS "transfer_slip_document_id" UUID;

ALTER TABLE "hr"."salary_advances"
  DROP CONSTRAINT IF EXISTS "salary_advances_transfer_slip_document_fkey";
ALTER TABLE "hr"."salary_advances"
  ADD CONSTRAINT "salary_advances_transfer_slip_document_fkey"
  FOREIGN KEY ("transfer_slip_document_id")
  REFERENCES "hr"."employee_documents"("id")
  ON DELETE SET NULL;
