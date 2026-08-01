import { prisma } from "@/lib/prisma";
import { assertBranchInScope, assertHrPermission } from "@/lib/hr/authorize";
import { documentCategoryLabel } from "@/lib/hr/employee-document-types";
import {
  deleteEmployeeDocumentFile,
  documentPublicPath,
  readEmployeeDocumentFile,
  saveEmployeeDocumentFile,
} from "@/lib/hr/employee-documents";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { HrServiceContext } from "@/lib/hr/services/shared";

async function requireEmployee(
  ctx: HrServiceContext,
  employeeId: string,
  options: { allowSelfWithoutBranchScope?: boolean } = {},
) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; branch_id: string; auth_user_id: string | null }>
  >`
    SELECT
      id::text AS id,
      branch_id::text AS branch_id,
      auth_user_id::text AS auth_user_id
    FROM hr.employees
    WHERE id = ${employeeId}::uuid
      AND organization_id = ${ctx.organizationId}::uuid
    LIMIT 1
  `;
  const employee = rows[0];
  if (!employee) throw new HrError("NOT_FOUND", { message: "ไม่พบพนักงาน" });
  const isSelf = Boolean(
    ctx.actorAuthUserId &&
      employee.auth_user_id &&
      employee.auth_user_id === ctx.actorAuthUserId,
  );
  if (!(options.allowSelfWithoutBranchScope && isSelf)) {
    assertBranchInScope(ctx, employee.branch_id);
  }
  return { ...employee, isSelf };
}

export type EmployeeDocumentRow = {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  url: string;
  createdAt: string;
};

type DocDbRow = {
  id: string;
  title: string;
  category: string;
  file_name: string;
  content_type: string;
  byte_size: number;
  storage_key: string;
  employee_id: string;
  created_at: Date;
};

function serialize(row: DocDbRow): EmployeeDocumentRow {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    categoryLabel: documentCategoryLabel(row.category),
    fileName: row.file_name,
    contentType: row.content_type,
    byteSize: Number(row.byte_size),
    url: documentPublicPath(row.employee_id, row.id),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listEmployeeDocuments(
  ctx: HrServiceContext,
  employeeId: string,
): Promise<EmployeeDocumentRow[]> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeRead);
  await requireEmployee(ctx, employeeId);
  try {
    const rows = await prisma.$queryRaw<DocDbRow[]>`
      SELECT
        id::text AS id,
        title,
        category,
        file_name,
        content_type,
        byte_size,
        storage_key,
        employee_id::text AS employee_id,
        created_at
      FROM hr.employee_documents
      WHERE employee_id = ${employeeId}::uuid
        AND organization_id = ${ctx.organizationId}::uuid
      ORDER BY created_at DESC
    `;
    return rows.map(serialize);
  } catch {
    throw new HrError("INTERNAL_ERROR", {
      message: "ยังโหลดเอกสารไม่ได้ — ตรวจว่าตารางเอกสารพร้อมแล้ว",
    });
  }
}

export async function createEmployeeDocument(
  ctx: HrServiceContext,
  employeeId: string,
  input: {
    title: string;
    category: string;
    buffer: Buffer;
    originalName: string;
    contentType?: string | null;
  },
): Promise<EmployeeDocumentRow> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeUpdate);
  await requireEmployee(ctx, employeeId);

  const title = input.title.trim();
  if (!title) {
    throw new HrError("VALIDATION_ERROR", { message: "กรุณาระบุชื่อเอกสาร" });
  }

  let saved;
  try {
    saved = await saveEmployeeDocumentFile({
      organizationId: ctx.organizationId,
      employeeId,
      buffer: input.buffer,
      originalName: input.originalName,
      contentType: input.contentType,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "DOCUMENT_TOO_LARGE") {
      throw new HrError("VALIDATION_ERROR", {
        message: "ไฟล์ใหญ่เกิน 10 MB",
      });
    }
    if (code === "UNSUPPORTED_DOCUMENT_TYPE") {
      throw new HrError("VALIDATION_ERROR", {
        message: "รองรับเฉพาะ PDF, รูปภาพ หรือไฟล์ Word",
      });
    }
    throw new HrError("VALIDATION_ERROR", { message: "อัปโหลดเอกสารไม่สำเร็จ" });
  }

  const category = input.category.trim() || "OTHER";
  const rows = await prisma.$queryRaw<DocDbRow[]>`
    INSERT INTO hr.employee_documents (
      organization_id,
      employee_id,
      title,
      category,
      file_name,
      content_type,
      byte_size,
      storage_key,
      uploaded_by_auth_user_id
    ) VALUES (
      ${ctx.organizationId}::uuid,
      ${employeeId}::uuid,
      ${title},
      ${category},
      ${saved.fileName},
      ${saved.contentType},
      ${saved.byteSize},
      ${saved.storageKey},
      ${ctx.actorAuthUserId}::uuid
    )
    RETURNING
      id::text AS id,
      title,
      category,
      file_name,
      content_type,
      byte_size,
      storage_key,
      employee_id::text AS employee_id,
      created_at
  `;
  const row = rows[0];
  if (!row) {
    throw new HrError("INTERNAL_ERROR", { message: "บันทึกเอกสารไม่สำเร็จ" });
  }
  return serialize(row);
}

export async function getEmployeeDocumentFile(
  ctx: HrServiceContext,
  employeeId: string,
  documentId: string,
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  const employee = await requireEmployee(ctx, employeeId, {
    allowSelfWithoutBranchScope: true,
  });
  // Staff with employee.read may open any in-scope file; employees may open
  // their own (e.g. สลิปโอนเบิกล่วงหน้า on /hr/me/advances).
  if (employee.isSelf) {
    assertHrPermission(ctx, [
      HR_PERMISSIONS.employeeRead,
      HR_PERMISSIONS.advanceSelf,
    ]);
  } else {
    assertHrPermission(ctx, HR_PERMISSIONS.employeeRead);
  }
  const rows = await prisma.$queryRaw<
    Array<{ storage_key: string; file_name: string }>
  >`
    SELECT storage_key, file_name
    FROM hr.employee_documents
    WHERE id = ${documentId}::uuid
      AND employee_id = ${employeeId}::uuid
      AND organization_id = ${ctx.organizationId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) throw new HrError("NOT_FOUND", { message: "ไม่พบเอกสาร" });
  const file = await readEmployeeDocumentFile({
    organizationId: ctx.organizationId,
    storageKey: row.storage_key,
  });
  if (!file) throw new HrError("NOT_FOUND", { message: "ไม่พบไฟล์เอกสาร" });
  return {
    buffer: file.buffer,
    contentType: file.contentType,
    fileName: row.file_name,
  };
}

export async function deleteEmployeeDocument(
  ctx: HrServiceContext,
  employeeId: string,
  documentId: string,
): Promise<{ ok: true }> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeUpdate);
  await requireEmployee(ctx, employeeId);
  const rows = await prisma.$queryRaw<Array<{ storage_key: string }>>`
    DELETE FROM hr.employee_documents
    WHERE id = ${documentId}::uuid
      AND employee_id = ${employeeId}::uuid
      AND organization_id = ${ctx.organizationId}::uuid
    RETURNING storage_key
  `;
  const row = rows[0];
  if (!row) throw new HrError("NOT_FOUND", { message: "ไม่พบเอกสาร" });
  await deleteEmployeeDocumentFile({
    organizationId: ctx.organizationId,
    storageKey: row.storage_key,
  });
  return { ok: true };
}
