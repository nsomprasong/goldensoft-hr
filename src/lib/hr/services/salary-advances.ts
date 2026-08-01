import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { assertHrPermission, hrCan } from "@/lib/hr/authorize";
import {
  documentPublicPath,
  saveEmployeeDocumentFile,
} from "@/lib/hr/employee-documents";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { assertNoSelfApproval } from "@/lib/hr/services/operation-guards";
import {
  employeeOwnBranchWhere,
  type HrServiceContext,
} from "@/lib/hr/services/shared";
import { formatThaiDate, formatThaiDateRange } from "@/lib/hr/thai-date";

export type DisbursementMode = "CASH_ALREADY" | "WITH_SALARY";

export type AdvanceTransferSlip = {
  documentId: string;
  url: string;
  fileName: string;
  contentType: string;
};

export type AdvanceInstallmentRow = {
  id: string;
  sequence: number;
  amount: number;
  payrollPeriodId: string | null;
  periodLabel: string;
  paymentDateLabel: string | null;
  status: string;
  statusLabel: string;
};

export type SalaryAdvanceRow = {
  id: string;
  employeeId: string;
  displayName: string;
  photoUrl: string | null;
  branchName: string | null;
  employeeAuthUserId: string | null;
  amount: number;
  advanceDate: string;
  advanceDateLabel: string;
  reason: string | null;
  status: string;
  statusLabel: string;
  installmentCount: number;
  startPayrollPeriodId: string | null;
  startPeriodLabel: string | null;
  disbursementMode: DisbursementMode | null;
  disbursementModeLabel: string | null;
  transferSlip: AdvanceTransferSlip | null;
  installments: AdvanceInstallmentRow[];
  deductedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
};

export type AdvancePeriodOption = {
  id: string;
  label: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
};

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว — รอหัก",
  PARTIALLY_DEDUCTED: "กำลังหักคืน",
  DEDUCTED: "หักครบแล้ว",
  REJECTED: "ไม่อนุมัติ",
  CANCELLED: "ยกเลิก",
  RECORDED: "บันทึกแล้ว",
};

const INSTALLMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "รอหัก",
  DEDUCTED: "หักแล้ว",
  CANCELLED: "ยกเลิก",
};

const DISBURSEMENT_LABEL: Record<DisbursementMode, string> = {
  CASH_ALREADY: "รับเงินเลย",
  WITH_SALARY: "รับพร้อมเงินเดือน",
};

export type AdvanceSlipUpload = {
  buffer: Buffer;
  originalName: string;
  contentType?: string | null;
};

function money(value: { toString(): string } | number): number {
  return Number(value);
}

function isoDate(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function splitInstallmentAmounts(total: number, count: number): number[] {
  const cents = Math.round(total * 100);
  const each = Math.floor(cents / count);
  const amounts: number[] = [];
  let allocated = 0;
  for (let i = 0; i < count - 1; i += 1) {
    amounts.push(each / 100);
    allocated += each;
  }
  amounts.push((cents - allocated) / 100);
  return amounts.map(roundMoney);
}

async function branchNamesById(
  organizationId: string,
): Promise<Map<string, string>> {
  const rows = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id::text AS id, name
    FROM platform.branches
    WHERE organization_id = ${organizationId}::uuid
      AND deleted_at IS NULL
  `;
  return new Map(rows.map((b) => [b.id, b.name]));
}

type DbAdvance = {
  id: string;
  employee_id: string;
  amount: string | number;
  advance_date: Date;
  reason: string | null;
  status: string;
  installment_count: number;
  start_payroll_period_id: string | null;
  disbursement_mode: string | null;
  transfer_slip_document_id: string | null;
  slip_file_name: string | null;
  slip_content_type: string | null;
  deducted_at: Date | null;
  submitted_at: Date | null;
  created_at: Date;
  display_name: string;
  photo_url: string | null;
  branch_id: string;
  auth_user_id: string | null;
  period_start: Date | null;
  period_end: Date | null;
  payment_date: Date | null;
};

type DbInstallment = {
  id: string;
  salary_advance_id: string;
  sequence: number;
  amount: string | number;
  payroll_period_id: string | null;
  status: string;
  period_start: Date | null;
  period_end: Date | null;
  payment_date: Date | null;
};

function periodLabel(start: Date | string, end: Date | string): string {
  return formatThaiDateRange(isoDate(start), isoDate(end));
}

async function queryAdvances(
  ctx: HrServiceContext,
  employeeId?: string | null,
): Promise<DbAdvance[]> {
  const empFilter = employeeId?.trim() || null;
  if (ctx.branchId) {
    return prisma.$queryRaw<DbAdvance[]>`
      SELECT
        a.id::text AS id,
        a.employee_id::text AS employee_id,
        a.amount,
        a.advance_date,
        a.reason,
        a.status,
        a.installment_count,
        a.start_payroll_period_id::text AS start_payroll_period_id,
        a.disbursement_mode,
        a.transfer_slip_document_id::text AS transfer_slip_document_id,
        d.file_name AS slip_file_name,
        d.content_type AS slip_content_type,
        a.deducted_at,
        a.submitted_at,
        a.created_at,
        e.display_name,
        e.photo_url,
        e.branch_id::text AS branch_id,
        e.auth_user_id::text AS auth_user_id,
        p.period_start,
        p.period_end,
        p.payment_date
      FROM hr.salary_advances a
      JOIN hr.employees e ON e.id = a.employee_id
      LEFT JOIN hr.payroll_periods p ON p.id = a.start_payroll_period_id
      LEFT JOIN hr.employee_documents d ON d.id = a.transfer_slip_document_id
      WHERE a.organization_id = ${ctx.organizationId}::uuid
        AND e.branch_id = ${ctx.branchId}::uuid
        AND (${empFilter}::uuid IS NULL OR a.employee_id = ${empFilter}::uuid)
      ORDER BY a.created_at DESC
    `;
  }
  if (ctx.allowedBranchIds != null) {
    const ids = [...ctx.allowedBranchIds];
    return prisma.$queryRaw<DbAdvance[]>`
      SELECT
        a.id::text AS id,
        a.employee_id::text AS employee_id,
        a.amount,
        a.advance_date,
        a.reason,
        a.status,
        a.installment_count,
        a.start_payroll_period_id::text AS start_payroll_period_id,
        a.disbursement_mode,
        a.transfer_slip_document_id::text AS transfer_slip_document_id,
        d.file_name AS slip_file_name,
        d.content_type AS slip_content_type,
        a.deducted_at,
        a.submitted_at,
        a.created_at,
        e.display_name,
        e.photo_url,
        e.branch_id::text AS branch_id,
        e.auth_user_id::text AS auth_user_id,
        p.period_start,
        p.period_end,
        p.payment_date
      FROM hr.salary_advances a
      JOIN hr.employees e ON e.id = a.employee_id
      LEFT JOIN hr.payroll_periods p ON p.id = a.start_payroll_period_id
      LEFT JOIN hr.employee_documents d ON d.id = a.transfer_slip_document_id
      WHERE a.organization_id = ${ctx.organizationId}::uuid
        AND e.branch_id = ANY(${ids}::uuid[])
        AND (${empFilter}::uuid IS NULL OR a.employee_id = ${empFilter}::uuid)
      ORDER BY a.created_at DESC
    `;
  }
  return prisma.$queryRaw<DbAdvance[]>`
    SELECT
      a.id::text AS id,
      a.employee_id::text AS employee_id,
      a.amount,
      a.advance_date,
      a.reason,
      a.status,
      a.installment_count,
      a.start_payroll_period_id::text AS start_payroll_period_id,
      a.disbursement_mode,
      a.transfer_slip_document_id::text AS transfer_slip_document_id,
      d.file_name AS slip_file_name,
      d.content_type AS slip_content_type,
      a.deducted_at,
      a.submitted_at,
      a.created_at,
      e.display_name,
      e.photo_url,
      e.branch_id::text AS branch_id,
      e.auth_user_id::text AS auth_user_id,
      p.period_start,
      p.period_end,
      p.payment_date
    FROM hr.salary_advances a
    JOIN hr.employees e ON e.id = a.employee_id
    LEFT JOIN hr.payroll_periods p ON p.id = a.start_payroll_period_id
    LEFT JOIN hr.employee_documents d ON d.id = a.transfer_slip_document_id
    WHERE a.organization_id = ${ctx.organizationId}::uuid
      AND (${empFilter}::uuid IS NULL OR a.employee_id = ${empFilter}::uuid)
    ORDER BY a.created_at DESC
  `;
}

async function queryInstallments(
  organizationId: string,
  advanceIds: string[],
): Promise<Map<string, AdvanceInstallmentRow[]>> {
  const map = new Map<string, AdvanceInstallmentRow[]>();
  if (advanceIds.length === 0) return map;
  const rows = await prisma.$queryRaw<DbInstallment[]>`
    SELECT
      i.id::text AS id,
      i.salary_advance_id::text AS salary_advance_id,
      i.sequence,
      i.amount,
      i.payroll_period_id::text AS payroll_period_id,
      i.status,
      p.period_start,
      p.period_end,
      p.payment_date
    FROM hr.salary_advance_installments i
    LEFT JOIN hr.payroll_periods p ON p.id = i.payroll_period_id
    WHERE i.organization_id = ${organizationId}::uuid
      AND i.salary_advance_id = ANY(${advanceIds}::uuid[])
    ORDER BY i.salary_advance_id, i.sequence
  `;
  for (const row of rows) {
    const list = map.get(row.salary_advance_id) ?? [];
    list.push({
      id: row.id,
      sequence: row.sequence,
      amount: money(row.amount),
      payrollPeriodId: row.payroll_period_id,
      periodLabel:
        row.period_start && row.period_end
          ? periodLabel(row.period_start, row.period_end)
          : "รอผูกงวดตอนคำนวณ",
      paymentDateLabel: row.payment_date
        ? formatThaiDate(isoDate(row.payment_date))
        : null,
      status: row.status,
      statusLabel: INSTALLMENT_STATUS_LABEL[row.status] ?? row.status,
    });
    map.set(row.salary_advance_id, list);
  }
  return map;
}

function toRow(
  row: DbAdvance,
  branchNameById: Map<string, string>,
  installments: AdvanceInstallmentRow[],
): SalaryAdvanceRow {
  const mode = row.disbursement_mode as DisbursementMode | null;
  return {
    id: row.id,
    employeeId: row.employee_id,
    displayName: row.display_name,
    photoUrl: row.photo_url,
    branchName: branchNameById.get(row.branch_id) ?? null,
    employeeAuthUserId: row.auth_user_id,
    amount: money(row.amount),
    advanceDate: isoDate(row.advance_date),
    advanceDateLabel: formatThaiDate(isoDate(row.advance_date)),
    reason: row.reason,
    status: row.status,
    statusLabel: STATUS_LABEL[row.status] ?? row.status,
    installmentCount: Number(row.installment_count) || 1,
    startPayrollPeriodId: row.start_payroll_period_id,
    startPeriodLabel:
      row.period_start && row.period_end
        ? periodLabel(row.period_start, row.period_end)
        : null,
    disbursementMode: mode,
    disbursementModeLabel: mode ? DISBURSEMENT_LABEL[mode] : null,
    transferSlip:
      row.transfer_slip_document_id && row.slip_file_name
        ? {
            documentId: row.transfer_slip_document_id,
            url: documentPublicPath(
              row.employee_id,
              row.transfer_slip_document_id,
            ),
            fileName: row.slip_file_name,
            contentType: row.slip_content_type ?? "application/octet-stream",
          }
        : null,
    installments,
    deductedAt: row.deducted_at?.toISOString() ?? null,
    submittedAt: row.submitted_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

async function saveAdvanceTransferSlip(
  ctx: HrServiceContext,
  employeeId: string,
  amount: number,
  slip: AdvanceSlipUpload,
): Promise<string> {
  let saved;
  try {
    saved = await saveEmployeeDocumentFile({
      organizationId: ctx.organizationId,
      employeeId,
      buffer: slip.buffer,
      originalName: slip.originalName,
      contentType: slip.contentType,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "DOCUMENT_TOO_LARGE") {
      throw new HrError("VALIDATION_ERROR", { message: "สลิปใหญ่เกิน 10 MB" });
    }
    if (code === "UNSUPPORTED_DOCUMENT_TYPE") {
      throw new HrError("VALIDATION_ERROR", {
        message: "สลิปต้องเป็นรูปภาพหรือ PDF",
      });
    }
    throw new HrError("VALIDATION_ERROR", {
      message: "อัปโหลดสลิปโอนเงินไม่สำเร็จ",
    });
  }

  const title = `สลิปโอนเบิกล่วงหน้า ${formatThbSafe(amount)} บาท`;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
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
      'ADVANCE_SLIP',
      ${saved.fileName},
      ${saved.contentType},
      ${saved.byteSize},
      ${saved.storageKey},
      ${ctx.actorAuthUserId}::uuid
    )
    RETURNING id::text AS id
  `;
  const docId = rows[0]?.id;
  if (!docId) {
    throw new HrError("INTERNAL_ERROR", { message: "บันทึกสลิปไม่สำเร็จ" });
  }
  return docId;
}

function formatThbSafe(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

async function mapRows(
  ctx: HrServiceContext,
  rows: DbAdvance[],
): Promise<SalaryAdvanceRow[]> {
  const [branchNameById, installmentsByAdvance] = await Promise.all([
    branchNamesById(ctx.organizationId),
    queryInstallments(
      ctx.organizationId,
      rows.map((r) => r.id),
    ),
  ]);
  return rows.map((row) =>
    toRow(row, branchNameById, installmentsByAdvance.get(row.id) ?? []),
  );
}

export async function listAdvancePeriodOptions(
  ctx: HrServiceContext,
): Promise<AdvancePeriodOption[]> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.advanceSelf,
    HR_PERMISSIONS.payrollManage,
    HR_PERMISSIONS.advanceApprove,
  ]);
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      period_start: Date;
      period_end: Date;
      payment_date: Date;
      status_code: string;
    }>
  >`
    SELECT
      p.id::text AS id,
      p.period_start,
      p.period_end,
      p.payment_date,
      s.code AS status_code
    FROM hr.payroll_periods p
    JOIN hr.payroll_period_statuses s ON s.id = p.status_id
    WHERE p.organization_id = ${ctx.organizationId}::uuid
      AND s.code NOT IN ('LOCKED', 'PAID')
    ORDER BY p.period_start ASC
    LIMIT 36
  `;
  return rows.map((row) => ({
    id: row.id,
    label: `${periodLabel(row.period_start, row.period_end)} · จ่าย ${formatThaiDate(isoDate(row.payment_date))}`,
    periodStart: isoDate(row.period_start),
    periodEnd: isoDate(row.period_end),
    paymentDate: isoDate(row.payment_date),
  }));
}

async function assertStartPeriodOptional(
  organizationId: string,
  startPeriodId: string | null,
): Promise<void> {
  if (!startPeriodId) return;
  const start = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id::text AS id
    FROM hr.payroll_periods
    WHERE id = ${startPeriodId}::uuid
      AND organization_id = ${organizationId}::uuid
    LIMIT 1
  `;
  if (!start[0]) {
    throw new HrError("NOT_FOUND", { message: "ไม่พบงวดเริ่มหักที่เลือก" });
  }
}

/** Create N installment rows without binding payroll periods yet. */
async function insertInstallments(
  organizationId: string,
  advanceId: string,
  totalAmount: number,
  count: number,
): Promise<void> {
  const amounts = splitInstallmentAmounts(totalAmount, count);
  for (let i = 0; i < count; i += 1) {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO hr.salary_advance_installments (
        id, organization_id, salary_advance_id, sequence, amount,
        payroll_period_id, status
      ) VALUES (
        ${id}::uuid,
        ${organizationId}::uuid,
        ${advanceId}::uuid,
        ${i + 1},
        ${amounts[i]},
        NULL,
        'PENDING'
      )
    `;
  }
}

export async function listSalaryAdvances(
  ctx: HrServiceContext,
): Promise<SalaryAdvanceRow[]> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.payrollRead,
    HR_PERMISSIONS.payrollManage,
    HR_PERMISSIONS.advanceApprove,
    HR_PERMISSIONS.reportRead,
  ]);
  const rows = await queryAdvances(ctx);
  return mapRows(ctx, rows);
}

export async function listMySalaryAdvances(
  ctx: HrServiceContext,
  employeeId: string,
): Promise<SalaryAdvanceRow[]> {
  assertHrPermission(ctx, HR_PERMISSIONS.advanceSelf);
  const rows = await queryAdvances(ctx, employeeId);
  return mapRows(ctx, rows);
}

export async function listPendingSalaryAdvances(
  ctx: HrServiceContext,
): Promise<SalaryAdvanceRow[]> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.advanceApprove,
    HR_PERMISSIONS.payrollManage,
    HR_PERMISSIONS.approvalRead,
  ]);
  const all = await queryAdvances(ctx);
  const pending = all.filter(
    (row) =>
      row.status === "SUBMITTED" ||
      row.status === "APPROVED" ||
      row.status === "PARTIALLY_DEDUCTED",
  );
  return mapRows(ctx, pending);
}

/** Org-scoped lookup for notification deep-links (ignores branch filter). */
export async function getSalaryAdvanceById(
  ctx: HrServiceContext,
  id: string,
): Promise<SalaryAdvanceRow | null> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.advanceApprove,
    HR_PERMISSIONS.payrollManage,
    HR_PERMISSIONS.approvalRead,
    HR_PERMISSIONS.advanceSelf,
  ]);
  const rows = await prisma.$queryRaw<DbAdvance[]>`
    SELECT
      a.id::text AS id,
      a.employee_id::text AS employee_id,
      a.amount,
      a.advance_date,
      a.reason,
      a.status,
      a.installment_count,
      a.start_payroll_period_id::text AS start_payroll_period_id,
      a.disbursement_mode,
      a.transfer_slip_document_id::text AS transfer_slip_document_id,
      d.file_name AS slip_file_name,
      d.content_type AS slip_content_type,
      a.deducted_at,
      a.submitted_at,
      a.created_at,
      e.display_name,
      e.photo_url,
      e.branch_id::text AS branch_id,
      e.auth_user_id::text AS auth_user_id,
      p.period_start,
      p.period_end,
      p.payment_date
    FROM hr.salary_advances a
    JOIN hr.employees e ON e.id = a.employee_id
    LEFT JOIN hr.payroll_periods p ON p.id = a.start_payroll_period_id
    LEFT JOIN hr.employee_documents d ON d.id = a.transfer_slip_document_id
    WHERE a.organization_id = ${ctx.organizationId}::uuid
      AND a.id = ${id}::uuid
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const [mapped] = await mapRows(ctx, [rows[0]]);
  return mapped ?? null;
}

type SubmitInput = {
  employeeId?: string;
  amount: number;
  advanceDate: string;
  reason?: string | null;
  installmentCount: number;
  /** Optional — null means start deducting from the next calculated period. */
  startPayrollPeriodId?: string | null;
  /** When manager records + approves in one step */
  autoApprove?: boolean;
  /** Employee / requester choice — required. Approver may change at review. */
  disbursementMode?: DisbursementMode | null;
  /** Optional; can attach later when รับเงินเลย. */
  transferSlip?: AdvanceSlipUpload | null;
};

async function resolveTargetEmployee(
  ctx: HrServiceContext,
  inputEmployeeId: string | undefined,
  selfOnly: boolean,
) {
  if (selfOnly) {
    const self = await prisma.employee.findFirst({
      where: {
        organizationId: ctx.organizationId,
        isActive: true,
        authUserId: ctx.actorAuthUserId,
      },
    });
    if (!self) {
      throw new HrError("NOT_FOUND", {
        message: "ไม่พบบัญชีพนักงานที่ผูกกับผู้ใช้นี้",
      });
    }
    return self;
  }
  const employeeId = String(inputEmployeeId ?? "").trim();
  if (!employeeId) {
    throw new HrError("VALIDATION_ERROR", { message: "กรุณาเลือกพนักงาน" });
  }
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      organizationId: ctx.organizationId,
      isActive: true,
      ...employeeOwnBranchWhere(ctx),
    },
  });
  if (!employee) {
    throw new HrError("NOT_FOUND", { message: "ไม่พบพนักงานในสาขานี้" });
  }
  return employee;
}

export async function submitSalaryAdvance(
  ctx: HrServiceContext,
  input: SubmitInput,
  options: { selfOnly?: boolean } = {},
): Promise<SalaryAdvanceRow> {
  const selfOnly = Boolean(options.selfOnly);
  if (selfOnly) {
    assertHrPermission(ctx, HR_PERMISSIONS.advanceSelf);
  } else {
    assertHrPermission(ctx, [
      HR_PERMISSIONS.payrollManage,
      HR_PERMISSIONS.advanceApprove,
    ]);
  }

  const amount = Number(input.amount);
  const advanceDate = String(input.advanceDate ?? "").trim();
  const installmentCount = Math.floor(Number(input.installmentCount) || 0);
  const startPayrollPeriodId =
    String(input.startPayrollPeriodId ?? "").trim() || null;
  if (
    !advanceDate ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    installmentCount < 1 ||
    installmentCount > 24
  ) {
    throw new HrError("VALIDATION_ERROR", {
      message: "กรุณาระบุจำนวนเงิน วันที่ และจำนวนงวดหักคืน",
    });
  }

  const employee = await resolveTargetEmployee(
    ctx,
    input.employeeId,
    selfOnly,
  );

  await assertStartPeriodOptional(ctx.organizationId, startPayrollPeriodId);

  const mode = input.disbursementMode;
  if (mode !== "CASH_ALREADY" && mode !== "WITH_SALARY") {
    throw new HrError("VALIDATION_ERROR", {
      message: "กรุณาเลือกวิธีรับเงิน: รับเงินเลย หรือรับพร้อมเงินเดือน",
    });
  }

  const autoApprove = !selfOnly && Boolean(input.autoApprove);

  if (autoApprove) {
    assertHrPermission(ctx, [
      HR_PERMISSIONS.payrollManage,
      HR_PERMISSIONS.advanceApprove,
    ]);
  }

  const id = randomUUID();
  const now = new Date();
  const note = input.reason?.trim() || null;
  const status = autoApprove ? "APPROVED" : "SUBMITTED";
  let slipDocId: string | null = null;
  if (mode === "CASH_ALREADY" && input.transferSlip) {
    slipDocId = await saveAdvanceTransferSlip(
      ctx,
      employee.id,
      amount,
      input.transferSlip,
    );
  }

  await prisma.$executeRaw`
    INSERT INTO hr.salary_advances (
      id, organization_id, employee_id, amount, advance_date, reason, status,
      installment_count, start_payroll_period_id, disbursement_mode,
      transfer_slip_document_id,
      submitted_at, created_by_auth_user_id,
      approved_by_auth_user_id, approved_at
    ) VALUES (
      ${id}::uuid,
      ${ctx.organizationId}::uuid,
      ${employee.id}::uuid,
      ${amount},
      ${advanceDate}::date,
      ${note},
      ${status},
      ${installmentCount},
      ${startPayrollPeriodId}::uuid,
      ${mode},
      ${slipDocId}::uuid,
      ${now},
      ${ctx.actorAuthUserId}::uuid,
      ${autoApprove ? ctx.actorAuthUserId : null}::uuid,
      ${autoApprove ? now : null}
    )
  `;

  if (autoApprove) {
    await insertInstallments(ctx.organizationId, id, amount, installmentCount);
  }

  const rows = await queryAdvances(ctx, employee.id);
  const created = rows.find((row) => row.id === id);
  if (!created) throw new HrError("NOT_FOUND", { message: "บันทึกไม่สำเร็จ" });
  const [mapped] = await mapRows(ctx, [created]);
  if (!autoApprove && mapped) {
    const empName =
      mapped.displayName?.trim() ||
      `${employee.firstNameTh} ${employee.lastNameTh}`.trim();
    const { formatThaiDate } = await import("@/lib/hr/thai-date");
    const advanceDateLabel = formatThaiDate(advanceDate);
    const { emitHrNotification } = await import("@/lib/hr/services/notify");
    void emitHrNotification(ctx, {
      typeCode: "ADVANCE_SUBMITTED",
      title: "คำขอเบิกล่วงหน้ารออนุมัติ",
      body: `${empName} ขอเบิก ${amount.toLocaleString("th-TH")} บาท · ${advanceDateLabel}`,
      branchId: employee.branchId,
      entityType: "SALARY_ADVANCE",
      entityId: id,
      excludeAuthUserId: ctx.actorAuthUserId,
    });
  }
  return mapped!;
}

/** @deprecated Prefer submitSalaryAdvance — kept for older callers. */
export async function createSalaryAdvance(
  ctx: HrServiceContext,
  input: {
    employeeId: string;
    amount: number;
    advanceDate: string;
    reason?: string | null;
    installmentCount?: number;
    startPayrollPeriodId?: string;
    autoApprove?: boolean;
    disbursementMode?: DisbursementMode | null;
  },
): Promise<SalaryAdvanceRow> {
  if (!input.installmentCount) {
    throw new HrError("VALIDATION_ERROR", {
      message: "กรุณาระบุจำนวนงวดหักคืน",
    });
  }
  return submitSalaryAdvance(
    ctx,
    {
      employeeId: input.employeeId,
      amount: input.amount,
      advanceDate: input.advanceDate,
      reason: input.reason,
      installmentCount: input.installmentCount,
      startPayrollPeriodId: input.startPayrollPeriodId ?? null,
      autoApprove: input.autoApprove ?? true,
      disbursementMode: input.disbursementMode ?? "CASH_ALREADY",
    },
    { selfOnly: false },
  );
}

export async function reviewSalaryAdvance(
  ctx: HrServiceContext,
  id: string,
  approve: boolean,
  input: {
    disbursementMode?: DisbursementMode | null;
    reviewNote?: string | null;
    installmentCount?: number;
    startPayrollPeriodId?: string;
    transferSlip?: AdvanceSlipUpload | null;
  } = {},
): Promise<SalaryAdvanceRow> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.advanceApprove,
    HR_PERMISSIONS.payrollManage,
  ]);

  const found = await prisma.$queryRaw<
    Array<{
      id: string;
      status: string;
      amount: string | number;
      installment_count: number;
      start_payroll_period_id: string | null;
      disbursement_mode: string | null;
      employee_id: string;
      branch_id: string;
      auth_user_id: string | null;
    }>
  >`
    SELECT
      a.id::text AS id,
      a.status,
      a.amount,
      a.installment_count,
      a.start_payroll_period_id::text AS start_payroll_period_id,
      a.disbursement_mode,
      a.employee_id::text AS employee_id,
      e.branch_id::text AS branch_id,
      e.auth_user_id::text AS auth_user_id
    FROM hr.salary_advances a
    JOIN hr.employees e ON e.id = a.employee_id
    WHERE a.id = ${id}::uuid
      AND a.organization_id = ${ctx.organizationId}::uuid
    LIMIT 1
  `;
  const row = found[0];
  if (!row) throw new HrError("NOT_FOUND");
  if (ctx.branchId && row.branch_id !== ctx.branchId) {
    throw new HrError("BRANCH_OUT_OF_SCOPE");
  }
  if (
    ctx.allowedBranchIds != null &&
    !ctx.allowedBranchIds.includes(row.branch_id)
  ) {
    throw new HrError("BRANCH_OUT_OF_SCOPE");
  }
  assertNoSelfApproval(row.auth_user_id, ctx.actorAuthUserId!);
  if (row.status !== "SUBMITTED") {
    throw new HrError("INVALID_STATUS_TRANSITION", {
      message: "รายการนี้ไม่อยู่ในสถานะรออนุมัติ",
    });
  }

  const now = new Date();
  const reviewNote = input.reviewNote?.trim() || null;

  if (!approve) {
    await prisma.$executeRaw`
      UPDATE hr.salary_advances
      SET
        status = 'REJECTED',
        rejected_at = ${now},
        review_note = ${reviewNote},
        approved_by_auth_user_id = ${ctx.actorAuthUserId}::uuid,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}::uuid
    `;
  } else {
    const mode =
      input.disbursementMode === "CASH_ALREADY" ||
      input.disbursementMode === "WITH_SALARY"
        ? input.disbursementMode
        : row.disbursement_mode === "CASH_ALREADY" ||
            row.disbursement_mode === "WITH_SALARY"
          ? (row.disbursement_mode as DisbursementMode)
          : null;
    if (!mode) {
      throw new HrError("VALIDATION_ERROR", {
        message: "กรุณาเลือกวิธีรับเงิน: รับเงินเลย หรือรับพร้อมเงินเดือน",
      });
    }
    const installmentCount = Math.floor(
      Number(input.installmentCount ?? row.installment_count) || 0,
    );
    const startPeriodId =
      String(
        input.startPayrollPeriodId ?? row.start_payroll_period_id ?? "",
      ).trim() || null;
    if (installmentCount < 1 || installmentCount > 24) {
      throw new HrError("VALIDATION_ERROR", {
        message: "กรุณาระบุจำนวนงวดหักคืน (1–24)",
      });
    }
    await assertStartPeriodOptional(ctx.organizationId, startPeriodId);
    let slipDocId: string | null = null;
    if (mode === "CASH_ALREADY" && input.transferSlip) {
      slipDocId = await saveAdvanceTransferSlip(
        ctx,
        row.employee_id,
        money(row.amount),
        input.transferSlip,
      );
    }
    await prisma.$executeRaw`
      UPDATE hr.salary_advances
      SET
        status = 'APPROVED',
        disbursement_mode = ${mode},
        installment_count = ${installmentCount},
        start_payroll_period_id = ${startPeriodId}::uuid,
        transfer_slip_document_id = COALESCE(
          ${slipDocId}::uuid,
          transfer_slip_document_id
        ),
        review_note = ${reviewNote},
        approved_by_auth_user_id = ${ctx.actorAuthUserId}::uuid,
        approved_at = ${now},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}::uuid
    `;
    await prisma.$executeRaw`
      DELETE FROM hr.salary_advance_installments
      WHERE salary_advance_id = ${id}::uuid
    `;
    await insertInstallments(
      ctx.organizationId,
      id,
      money(row.amount),
      installmentCount,
    );
  }

  const refreshed = (await queryAdvances(ctx)).find((r) => r.id === id);
  if (!refreshed) throw new HrError("NOT_FOUND");
  const [mapped] = await mapRows(ctx, [refreshed]);
  if (row.auth_user_id) {
    const { formatThaiDate } = await import("@/lib/hr/thai-date");
    const advanceDateLabel = mapped?.advanceDateLabel
      ? mapped.advanceDateLabel
      : formatThaiDate(mapped?.advanceDate ?? "");
    const { emitHrNotification } = await import("@/lib/hr/services/notify");
    void emitHrNotification(ctx, {
      typeCode: approve ? "ADVANCE_APPROVED" : "ADVANCE_REJECTED",
      title: approve
        ? "คำขอเบิกได้รับการอนุมัติ"
        : "คำขอเบิกไม่ได้รับการอนุมัติ",
      body: approve
        ? `คำขอเบิกวันที่ ${advanceDateLabel} ของคุณได้รับการอนุมัติแล้ว`
        : `คำขอเบิกวันที่ ${advanceDateLabel} ของคุณไม่ได้รับการอนุมัติ`,
      branchId: row.branch_id,
      entityType: "SALARY_ADVANCE",
      entityId: id,
      recipientAuthUserIds: [row.auth_user_id],
      recipientEmployeeId: row.employee_id,
    });
  }
  return mapped!;
}

/** Attach / replace transfer slip after approval (รับเงินเลย). */
export async function attachAdvanceTransferSlip(
  ctx: HrServiceContext,
  id: string,
  transferSlip: AdvanceSlipUpload,
): Promise<SalaryAdvanceRow> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.advanceApprove,
    HR_PERMISSIONS.payrollManage,
  ]);

  const found = await prisma.$queryRaw<
    Array<{
      id: string;
      status: string;
      amount: string | number;
      disbursement_mode: string | null;
      employee_id: string;
      branch_id: string;
    }>
  >`
    SELECT
      a.id::text AS id,
      a.status,
      a.amount,
      a.disbursement_mode,
      a.employee_id::text AS employee_id,
      e.branch_id::text AS branch_id
    FROM hr.salary_advances a
    JOIN hr.employees e ON e.id = a.employee_id
    WHERE a.id = ${id}::uuid
      AND a.organization_id = ${ctx.organizationId}::uuid
    LIMIT 1
  `;
  const row = found[0];
  if (!row) throw new HrError("NOT_FOUND");
  if (ctx.branchId && row.branch_id !== ctx.branchId) {
    throw new HrError("BRANCH_OUT_OF_SCOPE");
  }
  if (
    ctx.allowedBranchIds != null &&
    !ctx.allowedBranchIds.includes(row.branch_id)
  ) {
    throw new HrError("BRANCH_OUT_OF_SCOPE");
  }
  if (
    row.status !== "APPROVED" &&
    row.status !== "PARTIALLY_DEDUCTED" &&
    row.status !== "DEDUCTED"
  ) {
    throw new HrError("INVALID_STATUS_TRANSITION", {
      message: "แนบสลิปได้หลังอนุมัติแล้ว",
    });
  }
  if (row.disbursement_mode !== "CASH_ALREADY") {
    throw new HrError("VALIDATION_ERROR", {
      message: "แนบสลิปได้เฉพาะรายการที่รับเงินเลย",
    });
  }

  const slipDocId = await saveAdvanceTransferSlip(
    ctx,
    row.employee_id,
    money(row.amount),
    transferSlip,
  );
  await prisma.$executeRaw`
    UPDATE hr.salary_advances
    SET
      transfer_slip_document_id = ${slipDocId}::uuid,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}::uuid
  `;

  const refreshed = (await queryAdvances(ctx)).find((r) => r.id === id);
  if (!refreshed) throw new HrError("NOT_FOUND");
  const [mapped] = await mapRows(ctx, [refreshed]);
  return mapped!;
}

export async function cancelSalaryAdvance(
  ctx: HrServiceContext,
  id: string,
): Promise<{ id: string; status: string }> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.payrollManage,
    HR_PERMISSIONS.advanceSelf,
  ]);
  const found = await prisma.$queryRaw<
    Array<{
      id: string;
      status: string;
      branch_id: string;
      employee_id: string;
      auth_user_id: string | null;
    }>
  >`
    SELECT
      a.id::text AS id,
      a.status,
      e.branch_id::text AS branch_id,
      a.employee_id::text AS employee_id,
      e.auth_user_id::text AS auth_user_id
    FROM hr.salary_advances a
    JOIN hr.employees e ON e.id = a.employee_id
    WHERE a.id = ${id}::uuid
      AND a.organization_id = ${ctx.organizationId}::uuid
    LIMIT 1
  `;
  const row = found[0];
  if (!row) throw new HrError("NOT_FOUND");

  const canManage = hrCan(ctx, HR_PERMISSIONS.payrollManage);
  const isSelf =
    row.auth_user_id != null && row.auth_user_id === ctx.actorAuthUserId;
  if (!canManage) {
    if (!isSelf || row.status !== "SUBMITTED") {
      throw new HrError("FORBIDDEN", {
        message: "ยกเลิกได้เฉพาะคำขอของตนเองที่ยังรออนุมัติ",
      });
    }
  }
  if (ctx.branchId && row.branch_id !== ctx.branchId && canManage) {
    throw new HrError("BRANCH_OUT_OF_SCOPE");
  }
  if (
    row.status === "DEDUCTED" ||
    row.status === "PARTIALLY_DEDUCTED"
  ) {
    throw new HrError("INVALID_STATUS_TRANSITION", {
      message: "รายการที่เริ่มหักเงินเดือนแล้วยกเลิกไม่ได้",
    });
  }
  if (row.status === "CANCELLED") return { id: row.id, status: row.status };

  await prisma.$executeRaw`
    UPDATE hr.salary_advances
    SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}::uuid
  `;
  await prisma.$executeRaw`
    UPDATE hr.salary_advance_installments
    SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
    WHERE salary_advance_id = ${id}::uuid
      AND status = 'PENDING'
  `;
  return { id, status: "CANCELLED" };
}

/**
 * Bind the next unbound installment to this period (when eligible), then return
 * deductions + WITH_SALARY credits for the period.
 *
 * WITH_SALARY: credit (จ่ายพร้อมเงินเดือน) in the start/eligible period, then
 * start deducting from the *next* period — never credit and deduct in the same period.
 * CASH_ALREADY: deduct from the start/eligible period as usual.
 */
export async function loadAdvanceEffectsForPeriod(
  organizationId: string,
  payrollPeriodId: string,
  employeeIds: string[],
): Promise<{
  deductionsByEmployee: Map<
    string,
    Array<{ installmentId: string; advanceId: string; amount: number }>
  >;
  creditsByEmployee: Map<
    string,
    Array<{ advanceId: string; amount: number }>
  >;
}> {
  const deductionsByEmployee = new Map<
    string,
    Array<{ installmentId: string; advanceId: string; amount: number }>
  >();
  const creditsByEmployee = new Map<
    string,
    Array<{ advanceId: string; amount: number }>
  >();
  if (employeeIds.length === 0) {
    return { deductionsByEmployee, creditsByEmployee };
  }

  const period = await prisma.$queryRaw<Array<{ period_start: Date }>>`
    SELECT period_start
    FROM hr.payroll_periods
    WHERE id = ${payrollPeriodId}::uuid
      AND organization_id = ${organizationId}::uuid
    LIMIT 1
  `;
  const periodStart = period[0]?.period_start;
  if (!periodStart) {
    return { deductionsByEmployee, creditsByEmployee };
  }

  // Unbind WITH_SALARY installments that are not yet eligible to deduct
  // (credit period = this period, or never credited in an earlier period).
  await prisma.$executeRaw`
    UPDATE hr.salary_advance_installments i
    SET
      payroll_period_id = NULL,
      updated_at = CURRENT_TIMESTAMP
    FROM hr.salary_advances a
    WHERE i.salary_advance_id = a.id
      AND i.organization_id = ${organizationId}::uuid
      AND i.payroll_period_id = ${payrollPeriodId}::uuid
      AND i.status = 'PENDING'
      AND a.disbursement_mode = 'WITH_SALARY'
      AND a.employee_id = ANY(${employeeIds}::uuid[])
      AND NOT (
        a.credited_payroll_run_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM hr.payroll_runs cr
          JOIN hr.payroll_periods cp ON cp.id = cr.payroll_period_id
          WHERE cr.id = a.credited_payroll_run_id
            AND cp.period_start < ${periodStart}::date
        )
      )
  `;

  // Attach at most one unbound installment per advance to this period.
  // WITH_SALARY only when credited in a strictly earlier period.
  await prisma.$executeRaw`
    WITH eligible AS (
      SELECT a.id AS advance_id
      FROM hr.salary_advances a
      LEFT JOIN hr.payroll_periods sp ON sp.id = a.start_payroll_period_id
      WHERE a.organization_id = ${organizationId}::uuid
        AND a.status IN ('APPROVED', 'PARTIALLY_DEDUCTED')
        AND a.employee_id = ANY(${employeeIds}::uuid[])
        AND (
          a.start_payroll_period_id IS NULL
          OR sp.period_start <= ${periodStart}::date
        )
        AND (
          a.disbursement_mode IS DISTINCT FROM 'WITH_SALARY'
          OR (
            a.credited_payroll_run_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM hr.payroll_runs cr
              JOIN hr.payroll_periods cp ON cp.id = cr.payroll_period_id
              WHERE cr.id = a.credited_payroll_run_id
                AND cp.period_start < ${periodStart}::date
            )
          )
        )
    ),
    next_inst AS (
      SELECT DISTINCT ON (i.salary_advance_id) i.id
      FROM hr.salary_advance_installments i
      JOIN eligible e ON e.advance_id = i.salary_advance_id
      WHERE i.status = 'PENDING'
        AND i.payroll_period_id IS NULL
      ORDER BY i.salary_advance_id, i.sequence ASC
    )
    UPDATE hr.salary_advance_installments i
    SET
      payroll_period_id = ${payrollPeriodId}::uuid,
      updated_at = CURRENT_TIMESTAMP
    FROM next_inst n
    WHERE i.id = n.id
  `;

  const installmentRows = await prisma.$queryRaw<
    Array<{
      id: string;
      salary_advance_id: string;
      employee_id: string;
      amount: string | number;
    }>
  >`
    SELECT
      i.id::text AS id,
      i.salary_advance_id::text AS salary_advance_id,
      a.employee_id::text AS employee_id,
      i.amount
    FROM hr.salary_advance_installments i
    JOIN hr.salary_advances a ON a.id = i.salary_advance_id
    WHERE i.organization_id = ${organizationId}::uuid
      AND i.payroll_period_id = ${payrollPeriodId}::uuid
      AND i.status = 'PENDING'
      AND a.status IN ('APPROVED', 'PARTIALLY_DEDUCTED')
      AND a.employee_id = ANY(${employeeIds}::uuid[])
      AND (
        a.disbursement_mode IS DISTINCT FROM 'WITH_SALARY'
        OR (
          a.credited_payroll_run_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM hr.payroll_runs cr
            JOIN hr.payroll_periods cp ON cp.id = cr.payroll_period_id
            WHERE cr.id = a.credited_payroll_run_id
              AND cp.period_start < ${periodStart}::date
          )
        )
      )
  `;
  for (const row of installmentRows) {
    const list = deductionsByEmployee.get(row.employee_id) ?? [];
    list.push({
      installmentId: row.id,
      advanceId: row.salary_advance_id,
      amount: money(row.amount),
    });
    deductionsByEmployee.set(row.employee_id, list);
  }

  // Credit WITH_SALARY in the start period (or first eligible period if unset).
  // Deduction starts only in a later period after credit is marked.
  const creditRows = await prisma.$queryRaw<
    Array<{ id: string; employee_id: string; amount: string | number }>
  >`
    SELECT
      a.id::text AS id,
      a.employee_id::text AS employee_id,
      a.amount
    FROM hr.salary_advances a
    LEFT JOIN hr.payroll_periods sp ON sp.id = a.start_payroll_period_id
    WHERE a.organization_id = ${organizationId}::uuid
      AND a.disbursement_mode = 'WITH_SALARY'
      AND a.credited_payroll_run_id IS NULL
      AND a.status IN ('APPROVED', 'PARTIALLY_DEDUCTED')
      AND a.employee_id = ANY(${employeeIds}::uuid[])
      AND (
        a.start_payroll_period_id = ${payrollPeriodId}::uuid
        OR (
          a.start_payroll_period_id IS NULL
          AND (sp.period_start IS NULL OR sp.period_start <= ${periodStart}::date)
        )
      )
  `;
  for (const row of creditRows) {
    const list = creditsByEmployee.get(row.employee_id) ?? [];
    list.push({ advanceId: row.id, amount: money(row.amount) });
    creditsByEmployee.set(row.employee_id, list);
  }

  // Hard guard: never deduct an advance that is being credited in this same load.
  const creditedAdvanceIds = new Set<string>();
  for (const rows of creditsByEmployee.values()) {
    for (const row of rows) creditedAdvanceIds.add(row.advanceId);
  }
  if (creditedAdvanceIds.size > 0) {
    const unboundIds: string[] = [];
    for (const [employeeId, rows] of deductionsByEmployee) {
      const kept = rows.filter((row) => {
        if (creditedAdvanceIds.has(row.advanceId)) {
          unboundIds.push(row.installmentId);
          return false;
        }
        return true;
      });
      if (kept.length > 0) deductionsByEmployee.set(employeeId, kept);
      else deductionsByEmployee.delete(employeeId);
    }
    if (unboundIds.length > 0) {
      await prisma.$executeRaw`
        UPDATE hr.salary_advance_installments
        SET
          payroll_period_id = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY(${unboundIds}::uuid[])
          AND status = 'PENDING'
      `;
    }
  }

  return { deductionsByEmployee, creditsByEmployee };
}

/** Legacy: approved advances with no installment rows (pre-migration). */
export async function loadLegacyApprovedAdvancesByEmployee(
  organizationId: string,
  employeeIds: string[],
): Promise<Map<string, Array<{ id: string; amount: number }>>> {
  const map = new Map<string, Array<{ id: string; amount: number }>>();
  if (employeeIds.length === 0) return map;
  const rows = await prisma.$queryRaw<
    Array<{ id: string; employee_id: string; amount: string | number }>
  >`
    SELECT a.id::text AS id, a.employee_id::text AS employee_id, a.amount
    FROM hr.salary_advances a
    WHERE a.organization_id = ${organizationId}::uuid
      AND a.status = 'APPROVED'
      AND a.employee_id = ANY(${employeeIds}::uuid[])
      AND NOT EXISTS (
        SELECT 1 FROM hr.salary_advance_installments i
        WHERE i.salary_advance_id = a.id
      )
    ORDER BY a.advance_date ASC, a.created_at ASC
  `;
  for (const row of rows) {
    const list = map.get(row.employee_id) ?? [];
    list.push({ id: row.id, amount: money(row.amount) });
    map.set(row.employee_id, list);
  }
  return map;
}

export async function reopenAdvanceEffectsForRun(
  payrollRunId: string,
  employeeIds: string[],
): Promise<void> {
  if (employeeIds.length === 0) return;

  const affected = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT DISTINCT a.id::text AS id
    FROM hr.salary_advances a
    LEFT JOIN hr.salary_advance_installments i ON i.salary_advance_id = a.id
    WHERE a.employee_id = ANY(${employeeIds}::uuid[])
      AND (
        a.credited_payroll_run_id = ${payrollRunId}::uuid
        OR a.deducted_payroll_run_id = ${payrollRunId}::uuid
        OR i.deducted_payroll_run_id = ${payrollRunId}::uuid
      )
  `;
  const advanceIds = affected.map((row) => row.id);

  await prisma.$executeRaw`
    UPDATE hr.salary_advance_installments
    SET
      status = 'PENDING',
      deducted_payroll_run_id = NULL,
      deducted_at = NULL,
      payroll_period_id = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE deducted_payroll_run_id = ${payrollRunId}::uuid
      AND status = 'DEDUCTED'
  `;
  await prisma.$executeRaw`
    UPDATE hr.salary_advances
    SET
      credited_payroll_run_id = NULL,
      credited_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE credited_payroll_run_id = ${payrollRunId}::uuid
  `;
  await prisma.$executeRaw`
    UPDATE hr.salary_advances
    SET
      deducted_payroll_run_id = NULL,
      deducted_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE deducted_payroll_run_id = ${payrollRunId}::uuid
      AND employee_id = ANY(${employeeIds}::uuid[])
  `;

  if (advanceIds.length === 0) return;

  await prisma.$executeRaw`
    UPDATE hr.salary_advances a
    SET
      status = CASE
        WHEN EXISTS (
          SELECT 1 FROM hr.salary_advance_installments i
          WHERE i.salary_advance_id = a.id AND i.status = 'PENDING'
        ) AND EXISTS (
          SELECT 1 FROM hr.salary_advance_installments i
          WHERE i.salary_advance_id = a.id AND i.status = 'DEDUCTED'
        ) THEN 'PARTIALLY_DEDUCTED'
        WHEN EXISTS (
          SELECT 1 FROM hr.salary_advance_installments i
          WHERE i.salary_advance_id = a.id AND i.status = 'PENDING'
        ) THEN 'APPROVED'
        WHEN EXISTS (
          SELECT 1 FROM hr.salary_advance_installments i
          WHERE i.salary_advance_id = a.id AND i.status = 'DEDUCTED'
        ) THEN 'DEDUCTED'
        WHEN a.status IN ('DEDUCTED', 'PARTIALLY_DEDUCTED') THEN 'APPROVED'
        ELSE a.status
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE a.id = ANY(${advanceIds}::uuid[])
  `;
}

export async function markAdvanceEffectsApplied(input: {
  payrollRunId: string;
  installmentIds: string[];
  creditedAdvanceIds: string[];
  legacyAdvanceIds: string[];
}): Promise<void> {
  const { payrollRunId, installmentIds, creditedAdvanceIds, legacyAdvanceIds } =
    input;
  if (installmentIds.length > 0) {
    await prisma.$executeRaw`
      UPDATE hr.salary_advance_installments
      SET
        status = 'DEDUCTED',
        deducted_payroll_run_id = ${payrollRunId}::uuid,
        deducted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY(${installmentIds}::uuid[])
        AND status = 'PENDING'
    `;
    await prisma.$executeRaw`
      UPDATE hr.salary_advances a
      SET
        status = CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM hr.salary_advance_installments i
            WHERE i.salary_advance_id = a.id AND i.status = 'PENDING'
          ) THEN 'DEDUCTED'
          ELSE 'PARTIALLY_DEDUCTED'
        END,
        deducted_payroll_run_id = CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM hr.salary_advance_installments i
            WHERE i.salary_advance_id = a.id AND i.status = 'PENDING'
          ) THEN ${payrollRunId}::uuid
          ELSE a.deducted_payroll_run_id
        END,
        deducted_at = CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM hr.salary_advance_installments i
            WHERE i.salary_advance_id = a.id AND i.status = 'PENDING'
          ) THEN CURRENT_TIMESTAMP
          ELSE a.deducted_at
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE a.id IN (
        SELECT DISTINCT salary_advance_id
        FROM hr.salary_advance_installments
        WHERE id = ANY(${installmentIds}::uuid[])
      )
    `;
  }
  if (creditedAdvanceIds.length > 0) {
    await prisma.$executeRaw`
      UPDATE hr.salary_advances
      SET
        credited_payroll_run_id = ${payrollRunId}::uuid,
        credited_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY(${creditedAdvanceIds}::uuid[])
        AND credited_payroll_run_id IS NULL
    `;
  }
  if (legacyAdvanceIds.length > 0) {
    await prisma.$executeRaw`
      UPDATE hr.salary_advances
      SET
        status = 'DEDUCTED',
        deducted_payroll_run_id = ${payrollRunId}::uuid,
        deducted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY(${legacyAdvanceIds}::uuid[])
        AND status = 'APPROVED'
    `;
  }
}

/** @deprecated use markAdvanceEffectsApplied */
export async function loadApprovedAdvancesByEmployee(
  organizationId: string,
  employeeIds: string[],
) {
  return loadLegacyApprovedAdvancesByEmployee(organizationId, employeeIds);
}

/** @deprecated use markAdvanceEffectsApplied */
export async function markAdvancesDeducted(
  advanceIds: string[],
  payrollRunId: string,
): Promise<void> {
  await markAdvanceEffectsApplied({
    payrollRunId,
    installmentIds: [],
    creditedAdvanceIds: [],
    legacyAdvanceIds: advanceIds,
  });
}

export async function reportSalaryAdvances(ctx: HrServiceContext) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.reportRead,
    HR_PERMISSIONS.payrollRead,
  ]);
  const rows = await listSalaryAdvances(ctx);
  const open = rows.filter(
    (r) =>
      r.status === "APPROVED" ||
      r.status === "PARTIALLY_DEDUCTED" ||
      r.status === "SUBMITTED" ||
      r.status === "RECORDED",
  );
  const deducted = rows.filter((r) => r.status === "DEDUCTED");
  return {
    kind: "advances",
    count: rows.length,
    openAmount: open.reduce((s, r) => s + r.amount, 0),
    deductedAmount: deducted.reduce((s, r) => s + r.amount, 0),
    rows,
  };
}
