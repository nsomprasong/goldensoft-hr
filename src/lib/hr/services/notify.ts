/**
 * In-app notification helpers (Phase 7).
 * External channels stay out of scope — outbox is marked DELIVERED for IN_APP.
 */
import { prisma } from "@/lib/prisma";
import { HrError } from "@/lib/hr/errors";
import type { HrServiceContext } from "@/lib/hr/services/shared";
import { formatThaiDate, formatThaiDateRange } from "@/lib/hr/thai-date";

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

export async function emitHrNotification(
  ctx: HrServiceContext,
  input: EmitNotificationInput,
): Promise<{ created: number }> {
  try {
    const type = await masterType(input.typeCode);
    const delivered = await masterStatus("DELIVERED");
    const recipients = await resolveRecipientAuthUserIds(ctx, input);
    if (recipients.length === 0) return { created: 0 };

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
          data: (input.data as object | undefined) ?? undefined,
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

async function resolveEntityDateLabels(
  organizationId: string,
  rows: Array<{ entityType: string | null; entityId: string | null }>,
): Promise<Map<string, string>> {
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

  const out = new Map<string, string>();
  await Promise.all([
    leaveIds.size
      ? db.leaveRequest
          .findMany({
            where: {
              organizationId,
              id: { in: [...leaveIds] },
            },
            select: { id: true, startDate: true, endDate: true },
          })
          .then(
            (
              list: Array<{
                id: string;
                startDate: Date;
                endDate: Date;
              }>,
            ) => {
              for (const row of list) {
                out.set(
                  byKey("LEAVE_REQUEST", row.id),
                  `วันลา ${formatThaiDateRange(row.startDate, row.endDate)}`,
                );
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
            select: { id: true, workDate: true },
          })
          .then((list: Array<{ id: string; workDate: Date }>) => {
            for (const row of list) {
              out.set(
                byKey("OVERTIME_REQUEST", row.id),
                `วันที่ทำ OT ${formatThaiDate(row.workDate)}`,
              );
            }
          })
      : Promise.resolve(),
    advanceIds.size
      ? prisma
          .$queryRaw<Array<{ id: string; advance_date: Date }>>`
            SELECT id::text AS id, advance_date
            FROM hr.salary_advances
            WHERE organization_id = ${organizationId}::uuid
              AND id = ANY(${[...advanceIds]}::uuid[])
          `
          .then((list) => {
            for (const row of list) {
              out.set(
                byKey("SALARY_ADVANCE", row.id),
                `วันที่ขอเบิก ${formatThaiDate(row.advance_date)}`,
              );
            }
          })
      : Promise.resolve(),
    adjustIds.size
      ? db.attendanceAdjustment
          .findMany({
            where: {
              organizationId,
              id: { in: [...adjustIds] },
            },
            select: { id: true, workDate: true },
          })
          .then((list: Array<{ id: string; workDate: Date }>) => {
            for (const row of list) {
              out.set(
                byKey("ATTENDANCE_ADJUSTMENT", row.id),
                `วันที่ทำงาน ${formatThaiDate(row.workDate)}`,
              );
            }
          })
          .catch(() => undefined)
      : Promise.resolve(),
    mismatchIds.size && db.shiftMismatchRequest
      ? db.shiftMismatchRequest
          .findMany({
            where: {
              organizationId,
              id: { in: [...mismatchIds] },
            },
            select: { id: true, workDate: true },
          })
          .then((list: Array<{ id: string; workDate: Date }>) => {
            for (const row of list) {
              out.set(
                byKey("SHIFT_MISMATCH", row.id),
                `วันที่ทำงาน ${formatThaiDate(row.workDate)}`,
              );
            }
          })
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
  if (!entityType) return "/hr/notifications";
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
      return "/hr/notifications";
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
      },
    }),
  ]);

  const dateLabels = await resolveEntityDateLabels(ctx.organizationId, rows);

  const items: NotificationListItem[] = rows.map(
    (row: {
      id: string;
      title: string;
      body: string;
      entityType: string | null;
      entityId: string | null;
      readAt: Date | null;
      createdAt: Date;
      type: { code: string; name: string };
    }) => {
      const dateLabel =
        row.entityType && row.entityId
          ? dateLabels.get(`${row.entityType}:${row.entityId}`) ?? null
          : null;
      return {
        id: row.id,
        title: row.title,
        body: row.body,
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
