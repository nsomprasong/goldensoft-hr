/**
 * In-app notification helpers (Phase 7).
 * External channels stay out of scope — outbox is marked DELIVERED for IN_APP.
 */
import { prisma } from "@/lib/prisma";
import { HrError } from "@/lib/hr/errors";
import type { HrServiceContext } from "@/lib/hr/services/shared";
import {
  formatThaiDateRangeReadable,
  formatThaiDateReadable,
} from "@/lib/hr/thai-date";

type Db = typeof prisma & Record<string, any>;
const db = prisma as Db;

async function masterStatus(code: string) {
  const row = await db.notificationStatus.findFirst({
    where: { code, isActive: true },
  });
  if (!row) throw new HrError("NOT_FOUND", { message: `ไม่พบสถานะแจ้งเตือน ${code}` });
  return row;
}

async function masterType(code: string) {
  const row = await db.notificationType.findFirst({
    where: { code, isActive: true },
  });
  if (!row) throw new HrError("NOT_FOUND", { message: `ไม่พบประเภทแจ้งเตือน ${code}` });
  return row;
}

export type EmitNotificationInput = {
  typeCode: string;
  title: string;
  body: string;
  /** Shown as the top accent line on notification cards. */
  employeeName?: string | null;
  branchId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  data?: Record<string, unknown> | null;
  /** Prefer these recipients; otherwise branch/org fans-out. */
  recipientAuthUserIds?: string[];
  recipientEmployeeId?: string | null;
  excludeAuthUserId?: string | null;
};

/** Best-effort fan-out to active auth-linked employees (same branch preferred). */
async function resolveRecipientAuthUserIds(
  ctx: HrServiceContext,
  input: EmitNotificationInput,
): Promise<string[]> {
  if (input.recipientAuthUserIds?.length) {
    return [...new Set(input.recipientAuthUserIds.filter(Boolean))];
  }

  if (input.recipientEmployeeId) {
    const emp = await db.employee.findFirst({
      where: {
        id: input.recipientEmployeeId,
        organizationId: ctx.organizationId,
        isActive: true,
      },
      select: { authUserId: true },
    });
    return emp?.authUserId ? [emp.authUserId] : [];
  }

  // Fan-out org-wide (branchId is metadata on the row). HQ owners must see
  // branch submissions; take-limit keeps MVP volume bounded.
  const rows = await db.employee.findMany({
    where: {
      organizationId: ctx.organizationId,
      isActive: true,
      authUserId: { not: null },
    },
    select: { authUserId: true },
    take: 80,
  });

  const ids = rows
    .map((row: { authUserId: string | null }) => row.authUserId)
    .filter((id: string | null): id is string => Boolean(id));

  const exclude = input.excludeAuthUserId ?? ctx.actorAuthUserId;
  return [...new Set(ids.filter((id) => id !== exclude))];
}

function isApprovedType(typeCode: string | null | undefined): boolean {
  return Boolean(typeCode?.endsWith("_APPROVED"));
}

export async function emitHrNotification(
  ctx: HrServiceContext,
  input: EmitNotificationInput,
): Promise<{ created: number }> {
  // Approvals are visible in the request list — no inbox noise for "approved".
  if (isApprovedType(input.typeCode)) {
    return { created: 0 };
  }
  try {
    const type = await masterType(input.typeCode);
    const delivered = await masterStatus("DELIVERED");
    const recipients = await resolveRecipientAuthUserIds(ctx, input);
    if (recipients.length === 0) return { created: 0 };

    const employeeName = input.employeeName?.trim() || null;
    const subjectEmployeeId =
      typeof input.data?.employeeId === "string"
        ? input.data.employeeId.trim()
        : typeof input.recipientEmployeeId === "string"
          ? input.recipientEmployeeId.trim()
          : "";
    const payloadData = {
      ...(input.data ?? {}),
      ...(employeeName ? { employeeName } : {}),
      ...(subjectEmployeeId ? { employeeId: subjectEmployeeId } : {}),
    };
    let created = 0;
    for (const authUserId of recipients) {
      const notification = await db.notification.create({
        data: {
          organizationId: ctx.organizationId,
          branchId: input.branchId ?? null,
          recipientAuthUserId: authUserId,
          recipientEmployeeId: input.recipientEmployeeId ?? null,
          typeId: type.id,
          statusId: delivered.id,
          title: input.title,
          body: input.body,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          data: Object.keys(payloadData).length > 0 ? payloadData : undefined,
          deliveredAt: new Date(),
        },
      });
      await db.notificationOutbox.create({
        data: {
          notificationId: notification.id,
          statusId: delivered.id,
          channel: "IN_APP",
          payload: { notificationId: notification.id },
          processedAt: new Date(),
        },
      });
      created += 1;
    }
    return { created };
  } catch (error) {
    console.error("[hr-notify] emit failed", error);
    return { created: 0 };
  }
}

export type NotificationListItem = {
  id: string;
  title: string;
  body: string;
  /** Accent name at the top of the card. */
  employeeName: string | null;
  /** Small branch under the name when multi-branch viewers. */
  branchName: string | null;
  /** Leave range / OT work date / advance date — for list display. */
  dateLabel: string | null;
  typeCode: string;
  typeName: string;
  entityType: string | null;
  entityId: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  unread: boolean;
};

type EntityDisplayMeta = {
  dateLabel: string;
  employeeName: string | null;
  branchId: string | null;
  summary: string | null;
};

type EmployeeNameSelect = {
  displayName: string | null;
  firstNameTh: string;
  lastNameTh: string;
  branchId: string | null;
};

function personName(employee: EmployeeNameSelect | null | undefined): string | null {
  if (!employee) return null;
  return (
    employee.displayName?.trim() ||
    `${employee.firstNameTh ?? ""} ${employee.lastNameTh ?? ""}`.trim() ||
    null
  );
}

function formatOtHours(minutes: number): string {
  const hours = minutes / 60;
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function stripLegacyDatesFromBody(text: string): string {
  return text
    .replace(/\s*·\s*\d{4}-\d{2}-\d{2}\b/g, "")
    .replace(
      /\s*·\s*\d{1,2}\/\d{1,2}\/\d{4}(?:\s*[–-]\s*\d{1,2}\/\d{1,2}\/\d{4})?/g,
      "",
    )
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
    .replace(
      /\b\d{1,2}\/\d{1,2}\/\d{4}(?:\s*[–-]\s*\d{1,2}\/\d{1,2}\/\d{4})?/g,
      "",
    )
    .replace(/\s*·\s*·/g, " · ")
    .replace(/\s*·\s*$/g, "")
    .replace(/^\s*·\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripLeadingEmployeeName(text: string, name: string | null): string {
  if (!name) return text;
  const trimmed = text.trim();
  if (!trimmed.startsWith(name)) return trimmed;
  return trimmed
    .slice(name.length)
    .replace(/^\s*(ส่งคำขอ|ขอ)\s*/u, "")
    .replace(/^·\s*/, "")
    .trim();
}

/** Old seed/emit bodies: "ชื่อ นามสกุล ส่งคำขอ… / ขอ…" */
function extractLegacyEmployeeName(body: string): string | null {
  const match = /^(.+?)\s+(?:ส่งคำขอ|ขอ)\b/u.exec(body.trim());
  const name = match?.[1]?.trim() ?? "";
  if (name.length < 2 || name.length > 80) return null;
  if (/\d/.test(name)) return null;
  return name;
}

function extractLegacyDateLabel(
  body: string,
  typeCode: string,
): string | null {
  const prefix = typeCode.includes("ADVANCE")
    ? "เบิก"
    : typeCode.includes("OT") || typeCode.includes("OVERTIME")
      ? "OT"
      : typeCode.includes("LEAVE")
        ? "ลา"
        : typeCode.includes("ADJUST")
          ? "ปรับเวลา"
          : typeCode.includes("MISMATCH")
            ? "ย้ายกะ"
            : "";
  const range = /(\d{1,2}\/\d{1,2}\/\d{4})\s*[–-]\s*(\d{1,2}\/\d{1,2}\/\d{4})/.exec(
    body,
  );
  if (range) {
    const label = formatThaiDateRangeReadable(range[1], range[2]);
    return prefix ? `${prefix} ${label}` : label;
  }
  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(body);
  if (iso) {
    const label = formatThaiDateReadable(iso[1]);
    return prefix ? `${prefix} ${label}` : label;
  }
  const single = /(\d{1,2}\/\d{1,2}\/\d{4})/.exec(body);
  if (single) {
    const label = formatThaiDateReadable(single[1]);
    return prefix ? `${prefix} ${label}` : label;
  }
  return null;
}

function extractLegacyAdvanceSummary(body: string): string | null {
  const match = /(?:ขอเบิก|เบิก)\s*([\d,]+)\s*บาท/u.exec(body);
  return match ? `เบิก ${match[1]} บาท` : null;
}

function extractLegacyLeaveSummary(body: string): string | null {
  const match =
    /(?:ส่งคำขอ|ขอ)?\s*((?:ลา)?[^\d·]*?)\s+(\d+(?:\.\d+)?)\s*วัน/u.exec(
      body.trim(),
    );
  if (!match) return null;
  let leaveType = match[1].trim();
  if (!leaveType) return null;
  if (!leaveType.startsWith("ลา")) leaveType = `ลา${leaveType}`;
  return `${leaveType} · ${match[2]} วัน`;
}

function extractLegacyOtSummary(body: string): string | null {
  const match = /OT\s+(\d+(?:\.\d+)?)\s*(?:ชม\.|ชั่วโมง)/u.exec(body);
  return match ? `OT · ${match[1]} ชม.` : null;
}

async function loadBranchNameMap(
  organizationId: string,
): Promise<Map<string, string>> {
  const rows = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id::text AS id, name
    FROM platform.branches
    WHERE organization_id = ${organizationId}::uuid
      AND deleted_at IS NULL
  `;
  return new Map(rows.map((row) => [row.id, row.name]));
}

async function loadEmployeeDisplayById(
  organizationId: string,
  employeeIds: string[],
): Promise<Map<string, { name: string; branchId: string | null }>> {
  const ids = [...new Set(employeeIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const rows = await prisma.$queryRaw<
    Array<{ id: string; display_name: string | null; branch_id: string | null }>
  >`
    SELECT
      id::text AS id,
      COALESCE(
        NULLIF(TRIM(display_name), ''),
        TRIM(CONCAT(first_name_th, ' ', last_name_th))
      ) AS display_name,
      branch_id::text AS branch_id
    FROM hr.employees
    WHERE organization_id = ${organizationId}::uuid
      AND id = ANY(${ids}::uuid[])
  `;
  return new Map(
    rows
      .map((row) => {
        const name = row.display_name?.trim() || "";
        if (!name) return null;
        return [
          row.id,
          { name, branchId: row.branch_id?.trim() || null },
        ] as const;
      })
      .filter((row): row is NonNullable<typeof row> => row != null),
  );
}

async function resolveEntityDisplayMeta(
  organizationId: string,
  rows: Array<{ entityType: string | null; entityId: string | null }>,
): Promise<Map<string, EntityDisplayMeta>> {
  const byKey = (type: string, id: string) => `${type}:${id}`;
  const leaveIds = new Set<string>();
  const otIds = new Set<string>();
  const advanceIds = new Set<string>();
  const adjustIds = new Set<string>();
  const mismatchIds = new Set<string>();
  for (const row of rows) {
    if (!row.entityType || !row.entityId) continue;
    if (row.entityType === "LEAVE_REQUEST") leaveIds.add(row.entityId);
    else if (row.entityType === "OVERTIME_REQUEST") otIds.add(row.entityId);
    else if (row.entityType === "SALARY_ADVANCE") advanceIds.add(row.entityId);
    else if (row.entityType === "ATTENDANCE_ADJUSTMENT") {
      adjustIds.add(row.entityId);
    } else if (row.entityType === "SHIFT_MISMATCH") {
      mismatchIds.add(row.entityId);
    }
  }

  const employeeSelect = {
    displayName: true,
    firstNameTh: true,
    lastNameTh: true,
    branchId: true,
  } as const;

  const out = new Map<string, EntityDisplayMeta>();
  await Promise.all([
    leaveIds.size
      ? db.leaveRequest
          .findMany({
            where: {
              organizationId,
              id: { in: [...leaveIds] },
            },
            select: {
              id: true,
              startDate: true,
              endDate: true,
              requestedAmount: true,
              leaveType: { select: { name: true } },
              employee: { select: employeeSelect },
            },
          })
          .then(
            (
              list: Array<{
                id: string;
                startDate: Date;
                endDate: Date;
                requestedAmount: unknown;
                leaveType: { name: string } | null;
                employee: EmployeeNameSelect | null;
              }>,
            ) => {
              for (const row of list) {
                const leaveType = row.leaveType?.name?.trim() || "การลา";
                const days = Number(row.requestedAmount);
                out.set(byKey("LEAVE_REQUEST", row.id), {
                  dateLabel: `ลา ${formatThaiDateRangeReadable(row.startDate, row.endDate)}`,
                  employeeName: personName(row.employee),
                  branchId: row.employee?.branchId ?? null,
                  summary: `${leaveType} · ${Number.isFinite(days) ? days : "—"} วัน`,
                });
              }
            },
          )
      : Promise.resolve(),
    otIds.size
      ? db.overtimeRequest
          .findMany({
            where: {
              organizationId,
              id: { in: [...otIds] },
            },
            select: {
              id: true,
              workDate: true,
              requestedMinutes: true,
              employee: { select: employeeSelect },
            },
          })
          .then(
            (
              list: Array<{
                id: string;
                workDate: Date;
                requestedMinutes: number;
                employee: EmployeeNameSelect | null;
              }>,
            ) => {
              for (const row of list) {
                out.set(byKey("OVERTIME_REQUEST", row.id), {
                  dateLabel: `OT ${formatThaiDateReadable(row.workDate)}`,
                  employeeName: personName(row.employee),
                  branchId: row.employee?.branchId ?? null,
                  summary: `OT · ${formatOtHours(row.requestedMinutes)} ชม.`,
                });
              }
            },
          )
      : Promise.resolve(),
    advanceIds.size
      ? prisma
          .$queryRaw<
            Array<{
              id: string;
              advance_date: Date;
              amount: string | number;
              display_name: string | null;
              branch_id: string | null;
            }>
          >`
            SELECT
              a.id::text AS id,
              a.advance_date,
              a.amount,
              COALESCE(
                NULLIF(TRIM(e.display_name), ''),
                TRIM(CONCAT(e.first_name_th, ' ', e.last_name_th))
              ) AS display_name,
              e.branch_id::text AS branch_id
            FROM hr.salary_advances a
            JOIN hr.employees e ON e.id = a.employee_id
            WHERE a.organization_id = ${organizationId}::uuid
              AND a.id = ANY(${[...advanceIds]}::uuid[])
          `
          .then((list) => {
            for (const row of list) {
              const amount = Number(row.amount);
              out.set(byKey("SALARY_ADVANCE", row.id), {
                dateLabel: `เบิก ${formatThaiDateReadable(row.advance_date)}`,
                employeeName: row.display_name?.trim() || null,
                branchId: row.branch_id?.trim() || null,
                summary: `เบิก ${
                  Number.isFinite(amount)
                    ? amount.toLocaleString("th-TH")
                    : "—"
                } บาท`,
              });
            }
          })
          .catch((error) => {
            console.error("[hr-notify] advance meta resolve failed", error);
          })
      : Promise.resolve(),
    adjustIds.size
      ? db.attendanceAdjustment
          .findMany({
            where: {
              organizationId,
              id: { in: [...adjustIds] },
            },
            select: {
              id: true,
              workDate: true,
              employee: { select: employeeSelect },
            },
          })
          .then(
            (
              list: Array<{
                id: string;
                workDate: Date;
                employee: EmployeeNameSelect | null;
              }>,
            ) => {
              for (const row of list) {
                out.set(byKey("ATTENDANCE_ADJUSTMENT", row.id), {
                  dateLabel: `ปรับเวลา ${formatThaiDateReadable(row.workDate)}`,
                  employeeName: personName(row.employee),
                  branchId: row.employee?.branchId ?? null,
                  summary: "ขอปรับปรุงเวลาเข้า–ออก",
                });
              }
            },
          )
          .catch(() => undefined)
      : Promise.resolve(),
    mismatchIds.size && db.shiftMismatchRequest
      ? db.shiftMismatchRequest
          .findMany({
            where: {
              organizationId,
              id: { in: [...mismatchIds] },
            },
            select: {
              id: true,
              workDate: true,
              employee: { select: employeeSelect },
            },
          })
          .then(
            (
              list: Array<{
                id: string;
                workDate: Date;
                employee: EmployeeNameSelect | null;
              }>,
            ) => {
              for (const row of list) {
                out.set(byKey("SHIFT_MISMATCH", row.id), {
                  dateLabel: `ย้ายกะ ${formatThaiDateReadable(row.workDate)}`,
                  employeeName: personName(row.employee),
                  branchId: row.employee?.branchId ?? null,
                  summary: "ขอย้ายกะจากลงผิดกะ",
                });
              }
            },
          )
          .catch(() => undefined)
      : Promise.resolve(),
  ]);
  return out;
}

function isDecisionType(typeCode: string | null | undefined): boolean {
  if (!typeCode) return false;
  return (
    typeCode.endsWith("_APPROVED") ||
    typeCode.endsWith("_REJECTED") ||
    typeCode.endsWith("_CANCELLED")
  );
}

function withFocus(path: string, entityId: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}focus=${encodeURIComponent(entityId)}`;
}

function hrefForEntity(
  entityType: string | null,
  entityId: string | null,
  typeCode?: string | null,
): string | null {
  if (!entityType) return "/hr/approvals";
  const decided = isDecisionType(typeCode);
  switch (entityType) {
    case "LEAVE_REQUEST":
      if (!entityId) return decided ? "/hr/me/leave" : "/hr/approvals?tab=leave";
      return decided
        ? withFocus("/hr/me/leave", entityId)
        : withFocus("/hr/approvals?tab=leave", entityId);
    case "OVERTIME_REQUEST":
      if (!entityId) return decided ? "/hr/me/overtime" : "/hr/approvals?tab=ot";
      return decided
        ? withFocus("/hr/me/overtime", entityId)
        : withFocus("/hr/approvals?tab=ot", entityId);
    case "ATTENDANCE_ADJUSTMENT":
      return entityId
        ? withFocus("/hr/approvals?tab=adjust", entityId)
        : "/hr/approvals?tab=adjust";
    case "SHIFT_MISMATCH":
      return entityId
        ? withFocus("/hr/approvals?tab=mismatch", entityId)
        : "/hr/approvals?tab=mismatch";
    case "SALARY_ADVANCE":
      if (!entityId) {
        return decided ? "/hr/me/advances" : "/hr/approvals?tab=advance";
      }
      return decided
        ? withFocus("/hr/me/advances", entityId)
        : withFocus("/hr/approvals?tab=advance", entityId);
    case "SCHEDULE_PERIOD":
      return entityId ? `/hr/schedules/${entityId}` : "/hr/schedules";
    case "PAYSLIP":
      return entityId ? `/hr/me/payslips/${entityId}` : "/hr/me/payslips";
    default:
      return "/hr/approvals";
  }
}

export async function listNotifications(
  ctx: HrServiceContext,
  input: { unreadOnly?: boolean; limit?: number } = {},
): Promise<{ items: NotificationListItem[]; unreadCount: number }> {
  const authUserId = ctx.actorAuthUserId;
  if (!authUserId) {
    return { items: [], unreadCount: 0 };
  }
  const limit = Math.min(Math.max(Number(input.limit) || 40, 1), 100);
  const where = {
    organizationId: ctx.organizationId,
    recipientAuthUserId: authUserId,
    NOT: { type: { code: { endsWith: "_APPROVED" } } },
    ...(input.unreadOnly ? { readAt: null } : {}),
  };

  const [rows, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      include: {
        type: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.notification.count({
      where: {
        organizationId: ctx.organizationId,
        recipientAuthUserId: authUserId,
        readAt: null,
        NOT: { type: { code: { endsWith: "_APPROVED" } } },
      },
    }),
  ]);

  const fallbackEmployeeIds: string[] = [];
  for (const row of rows as Array<{
    data: unknown;
    recipientEmployeeId: string | null;
    type: { code: string };
  }>) {
    if (isDecisionType(row.type.code)) continue;
    const dataObj =
      row.data && typeof row.data === "object" && !Array.isArray(row.data)
        ? (row.data as Record<string, unknown>)
        : null;
    if (typeof dataObj?.employeeId === "string" && dataObj.employeeId.trim()) {
      fallbackEmployeeIds.push(dataObj.employeeId.trim());
    }
    // Seeded / older rows often stamp the requester here for approver inbox.
    if (row.recipientEmployeeId) {
      fallbackEmployeeIds.push(row.recipientEmployeeId);
    }
  }

  const [entityMeta, branchNameById, employeeById] = await Promise.all([
    resolveEntityDisplayMeta(ctx.organizationId, rows),
    loadBranchNameMap(ctx.organizationId),
    loadEmployeeDisplayById(ctx.organizationId, fallbackEmployeeIds),
  ]);

  const items: NotificationListItem[] = rows.map(
    (row: {
      id: string;
      title: string;
      body: string;
      data: unknown;
      branchId: string | null;
      recipientEmployeeId: string | null;
      entityType: string | null;
      entityId: string | null;
      readAt: Date | null;
      createdAt: Date;
      type: { code: string; name: string };
    }) => {
      const meta =
        row.entityType && row.entityId
          ? entityMeta.get(`${row.entityType}:${row.entityId}`) ?? null
          : null;
      const dataObj =
        row.data && typeof row.data === "object" && !Array.isArray(row.data)
          ? (row.data as Record<string, unknown>)
          : null;
      const dataName =
        typeof dataObj?.employeeName === "string"
          ? dataObj.employeeName.trim()
          : "";
      const dataEmployeeId =
        typeof dataObj?.employeeId === "string"
          ? dataObj.employeeId.trim()
          : "";
      const dataBranch =
        typeof dataObj?.branchName === "string"
          ? dataObj.branchName.trim()
          : "";
      const dataDateLabel =
        typeof dataObj?.dateLabel === "string"
          ? dataObj.dateLabel.trim()
          : "";
      const decided = isDecisionType(row.type.code);
      const legacyName = decided ? null : extractLegacyEmployeeName(row.body);
      const fallbackEmployee =
        employeeById.get(dataEmployeeId) ||
        (row.recipientEmployeeId
          ? employeeById.get(row.recipientEmployeeId)
          : undefined) ||
        null;
      const employeeName = decided
        ? null
        : meta?.employeeName ||
          dataName ||
          legacyName ||
          fallbackEmployee?.name ||
          null;
      const branchId =
        meta?.branchId ||
        fallbackEmployee?.branchId ||
        row.branchId ||
        null;
      const branchName =
        (branchId ? branchNameById.get(branchId) ?? null : null) ||
        dataBranch ||
        null;
      const dateLabel =
        meta?.dateLabel ||
        dataDateLabel ||
        extractLegacyDateLabel(row.body, row.type.code) ||
        null;
      const cleanedBody = stripLeadingEmployeeName(
        stripLegacyDatesFromBody(row.body),
        employeeName,
      );
      const legacySummary =
        row.type.code.includes("ADVANCE")
          ? extractLegacyAdvanceSummary(row.body)
          : row.type.code.includes("LEAVE")
            ? extractLegacyLeaveSummary(cleanedBody) ||
              extractLegacyLeaveSummary(row.body)
            : row.type.code.includes("OT")
              ? extractLegacyOtSummary(row.body)
              : null;
      // Approver queue: show clean summary (no name/date duplication).
      // Decision notices: keep short reject copy; strip legacy date tails.
      const body = decided
        ? cleanedBody || row.body
        : meta?.summary || legacySummary || cleanedBody || row.body;
      return {
        id: row.id,
        title: row.title,
        body,
        employeeName,
        branchName,
        dateLabel,
        typeCode: row.type.code,
        typeName: row.type.name,
        entityType: row.entityType,
        entityId: row.entityId,
        href: hrefForEntity(row.entityType, row.entityId, row.type.code),
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        unread: !row.readAt,
      };
    },
  );

  return { items, unreadCount };
}

export async function countUnreadNotifications(
  ctx: HrServiceContext,
): Promise<number> {
  if (!ctx.actorAuthUserId) return 0;
  return db.notification.count({
    where: {
      organizationId: ctx.organizationId,
      recipientAuthUserId: ctx.actorAuthUserId,
      readAt: null,
      NOT: { type: { code: { endsWith: "_APPROVED" } } },
    },
  });
}

export async function markNotificationRead(
  ctx: HrServiceContext,
  id: string,
) {
  const result = await db.notification.updateMany({
    where: {
      id,
      organizationId: ctx.organizationId,
      recipientAuthUserId: ctx.actorAuthUserId,
    },
    data: { readAt: new Date() },
  });
  if (result.count === 0) throw new HrError("NOT_FOUND");
  return { ok: true, id };
}

export async function markAllNotificationsRead(ctx: HrServiceContext) {
  const result = await db.notification.updateMany({
    where: {
      organizationId: ctx.organizationId,
      recipientAuthUserId: ctx.actorAuthUserId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return { ok: true, count: result.count };
}

/** Legacy create path used by API POST — keep outbox + PENDING then deliver in-app. */
export async function createNotification(ctx: HrServiceContext, input: any) {
  const typeId = String(input.typeId ?? "").trim();
  const title = String(input.title ?? "").trim();
  const body = String(input.body ?? "").trim();
  if (!typeId || !title || !body) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ต้องระบุประเภท หัวข้อ และข้อความ",
    });
  }
  const delivered = await masterStatus("DELIVERED");
  const notification = await db.notification.create({
    data: {
      organizationId: ctx.organizationId,
      branchId: input.branchId ?? null,
      recipientAuthUserId: input.recipientAuthUserId ?? ctx.actorAuthUserId,
      recipientEmployeeId: input.recipientEmployeeId ?? null,
      typeId,
      statusId: delivered.id,
      title,
      body,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      data: input.data ?? undefined,
      deliveredAt: new Date(),
    },
  });
  await db.notificationOutbox.create({
    data: {
      notificationId: notification.id,
      statusId: delivered.id,
      channel: "IN_APP",
      payload: { notificationId: notification.id },
      processedAt: new Date(),
    },
  });
  return notification;
}
