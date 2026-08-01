/**
 * Phase 8C operational services.  These services deliberately use the HR
 * Prisma schema directly: the legacy repository only models the Phase 8B
 * tables and must not silently discard operational fields.
 */
import { prisma } from "@/lib/prisma";
import {
  assertBranchInScope,
  assertHrPermission,
  assertMatchesSelectedBranch,
  hrCan,
} from "@/lib/hr/authorize";
import { nextCodeFromList } from "@/lib/hr/business-codes";
import { HrError } from "@/lib/hr/errors";
import { insideGeofence } from "@/lib/hr/geo";
import { calculateAttendanceDay } from "@/lib/hr/attendance-calc";
import { calculatePayroll } from "@/lib/hr/payroll-calc";
import { loadAttendancePayEffectsForPeriod } from "@/lib/hr/services/payroll-attendance-effects";
import {
  loadAttendancePaySettingsForOrg,
  loadDeductionRatesForOrg,
} from "@/lib/hr/services/payroll-deduction-settings";
import {
  loadAdvanceEffectsForPeriod,
  loadLegacyApprovedAdvancesByEmployee,
  markAdvanceEffectsApplied,
  reopenAdvanceEffectsForRun,
} from "@/lib/hr/services/salary-advances";
import {
  attendanceEventPhotoPublicPath,
  decodePhotoBase64,
  saveAttendancePhoto,
} from "@/lib/hr/attendance-photos";
import { findOverlappingAssignments } from "@/lib/hr/schedule-conflicts";
import { dateRangesOverlap } from "@/lib/hr/schedule-dates";
import {
  summarizeConflictPeriods,
  type ScheduleDateConflict,
} from "@/lib/hr/schedule-period-overlap";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import {
  normalizePagination,
  employeeBranchWhere,
  employeeOwnBranchWhere,
  resolveBranchScope,
  toPagedResponse,
  type HrServiceContext,
} from "@/lib/hr/services/shared";
import { formatThaiDate, formatThaiDateRange } from "@/lib/hr/thai-date";
import {
  fromBuddhistYear,
  hasBuddhistHolidayTable,
  thaiPublicHolidaysForYear,
} from "@/lib/hr/thai-public-holidays";
import {
  assertConfirmed,
  assertNoSelfApproval,
  assertPayrollMutable,
  assertPayrollRecalculable,
} from "@/lib/hr/services/operation-guards";
import {
  evaluateShiftMismatch,
  formatShiftHm,
  type ShiftClockParts,
} from "@/lib/hr/shift-window";

export { assertConfirmed, assertNoSelfApproval, assertPayrollMutable } from "@/lib/hr/services/operation-guards";

type Db = typeof prisma & Record<string, any>;
const db = prisma as Db;
const date = (value: string | Date) => new Date(value);
const actor = (ctx: HrServiceContext) => ctx.actorAuthUserId;

/** Prisma where fragment: header branch + membership allow-list. */
function employeeBranchScopeWhere(ctx: HrServiceContext) {
  return employeeBranchWhere(ctx);
}

async function resolveActorDisplayName(ctx: HrServiceContext): Promise<string> {
  const fromCtx = ctx.actorDisplayName?.trim();
  if (fromCtx) return fromCtx;
  const authUserId = actor(ctx);
  if (!authUserId) return "ผู้อนุมัติ";
  const emp = await db.employee.findFirst({
    where: { organizationId: ctx.organizationId, authUserId },
    select: { displayName: true, firstNameTh: true, lastNameTh: true },
  });
  return (
    emp?.displayName?.trim() ||
    `${emp?.firstNameTh ?? ""} ${emp?.lastNameTh ?? ""}`.trim() ||
    "ผู้อนุมัติ"
  );
}

/** Persist reviewer display name even when Prisma client is not yet regenerated. */
async function stampReviewedByName(
  table:
    | "leave_requests"
    | "overtime_requests"
    | "attendance_adjustments"
    | "shift_mismatch_requests",
  id: string,
  name: string,
) {
  try {
    if (table === "leave_requests") {
      await db.$executeRaw`
        UPDATE hr.leave_requests
        SET reviewed_by_name = ${name}, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    } else if (table === "overtime_requests") {
      await db.$executeRaw`
        UPDATE hr.overtime_requests
        SET reviewed_by_name = ${name}, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    } else if (table === "attendance_adjustments") {
      await db.$executeRaw`
        UPDATE hr.attendance_adjustments
        SET reviewed_by_name = ${name}, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    } else {
      await db.$executeRaw`
        UPDATE hr.shift_mismatch_requests
        SET reviewed_by_name = ${name}, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    }
  } catch {
    // Column may be missing on older DBs; id/auth user still recorded.
  }
}

function requireIsoDate(value: unknown, label: string): Date {
  const raw = String(value ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new HrError("VALIDATION_ERROR", { message: `กรุณาระบุ${label}` });
  }
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new HrError("VALIDATION_ERROR", { message: `${label}ไม่ถูกต้อง` });
  }
  return parsed;
}

function requireDateTime(value: unknown, label: string): Date {
  const raw = String(value ?? "").trim();
  if (!raw) {
    throw new HrError("VALIDATION_ERROR", { message: `กรุณาระบุ${label}` });
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new HrError("VALIDATION_ERROR", { message: `${label}ไม่ถูกต้อง` });
  }
  return parsed;
}

async function master(model: string, code: string) {
  const row = await db[model].findFirst({ where: { code, isActive: true } });
  if (!row) throw new HrError("NOT_FOUND", { message: `ไม่พบสถานะ ${code}` });
  return row;
}
async function owned(model: string, ctx: HrServiceContext, id: string) {
  const row = await db[model].findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!row) throw new HrError("NOT_FOUND");
  return row;
}
function mutable(status: string) {
  if (["LOCKED", "APPROVED", "PAID"].includes(status)) throw new HrError("PERIOD_LOCKED");
}
export async function listWorkLocations(ctx: HrServiceContext, branchId?: string | null) {
  assertHrPermission(ctx, HR_PERMISSIONS.locationManage);
  return db.workLocation.findMany({ where: { organizationId: ctx.organizationId, ...(branchId ? { branchId } : {}) }, orderBy: { name: "asc" } });
}
function parseRequiredGpsCoord(
  value: unknown,
  kind: "latitude" | "longitude",
): number {
  if (value === "" || value == null) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ต้องระบุพิกัด GPS ของสถานที่ทำงาน",
    });
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new HrError("VALIDATION_ERROR", {
      message: kind === "latitude" ? "ละติจูดไม่ถูกต้อง" : "ลองจิจูดไม่ถูกต้อง",
    });
  }
  if (kind === "latitude" && (n < -90 || n > 90)) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ละติจูดต้องอยู่ระหว่าง -90 ถึง 90",
    });
  }
  if (kind === "longitude" && (n < -180 || n > 180)) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180",
    });
  }
  return n;
}

export async function createWorkLocation(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, HR_PERMISSIONS.locationManage);
  const branchId = input.branchId ?? ctx.branchId;
  if (!branchId) {
    throw new HrError("VALIDATION_ERROR", { message: "ต้องระบุสาขาของสถานที่ทำงาน" });
  }
  const latitude = parseRequiredGpsCoord(input.latitude, "latitude");
  const longitude = parseRequiredGpsCoord(input.longitude, "longitude");
  const existing = await db.workLocation.findMany({
    where: { organizationId: ctx.organizationId },
    select: { code: true },
  });
  const code = input.code?.trim()
    ? String(input.code).trim().toUpperCase()
    : nextCodeFromList(
        existing.map((row: { code: string }) => row.code),
        "LOC-",
      );
  const radius = Number(input.geofenceRadiusMeters);
  return db.workLocation.create({
    data: {
      organizationId: ctx.organizationId,
      branchId,
      code,
      name: String(input.name ?? "สถานที่ทำงาน").trim(),
      latitude,
      longitude,
      geofenceRadiusMeters:
        Number.isFinite(radius) && radius >= 1 ? Math.round(radius) : 50,
      timezone: String(input.timezone ?? "").trim() || "Asia/Bangkok",
    },
  });
}
export async function updateWorkLocation(ctx: HrServiceContext, id: string, input: any) {
  assertHrPermission(ctx, HR_PERMISSIONS.locationManage);
  const current = await owned("workLocation", ctx, id);
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    data.name = String(input.name ?? "").trim() || "สถานที่ทำงาน";
  }
  if (input.latitude !== undefined || input.longitude !== undefined) {
    data.latitude = parseRequiredGpsCoord(
      input.latitude !== undefined ? input.latitude : current.latitude,
      "latitude",
    );
    data.longitude = parseRequiredGpsCoord(
      input.longitude !== undefined ? input.longitude : current.longitude,
      "longitude",
    );
  }
  if (input.geofenceRadiusMeters !== undefined) {
    const radius = Number(input.geofenceRadiusMeters);
    data.geofenceRadiusMeters =
      Number.isFinite(radius) && radius >= 1 ? Math.round(radius) : 50;
  }
  if (input.timezone !== undefined) {
    data.timezone = String(input.timezone ?? "").trim() || "Asia/Bangkok";
  }
  if (input.branchId !== undefined && input.branchId) {
    data.branchId = String(input.branchId);
  }
  if (input.isActive !== undefined) {
    data.isActive = Boolean(input.isActive);
  }
  return db.workLocation.update({ where: { id }, data });
}
export async function assignEmployeeWorkLocation(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, HR_PERMISSIONS.locationManage);
  await owned("employee", ctx, input.employeeId); await owned("workLocation", ctx, input.workLocationId);
  return db.employeeWorkLocation.create({ data: { ...input, effectiveFrom: date(input.effectiveFrom), effectiveTo: input.effectiveTo ? date(input.effectiveTo) : null } });
}

export async function listCalendars(ctx: HrServiceContext) {
  assertHrPermission(ctx, HR_PERMISSIONS.calendarManage);
  return db.workCalendar.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      holidays: {
        include: { holidayType: true },
        orderBy: { holidayDate: "asc" },
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function listHolidayTypes(ctx: HrServiceContext) {
  assertHrPermission(ctx, HR_PERMISSIONS.calendarManage);
  return db.holidayType.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

function normalizeWorkDays(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) return [1, 2, 3, 4, 5];
  const days = [
    ...new Set(
      value
        .map((d) => Number(d))
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    ),
  ].sort((a, b) => a - b);
  return days.length > 0 ? days : [1, 2, 3, 4, 5];
}

export async function saveCalendar(ctx: HrServiceContext, input: any, id?: string) {
  assertHrPermission(ctx, HR_PERMISSIONS.calendarManage);
  const name =
    String(input?.name ?? "").trim() || "ปฏิทินทำงาน";
  const workDays = normalizeWorkDays(input?.workDays);
  const branchId = input?.branchId || null;
  const timezone =
    String(input?.timezone ?? "").trim() || "Asia/Bangkok";
  const isActive =
    input?.isActive === undefined ? true : Boolean(input.isActive);

  if (!id) {
    const existing = await db.workCalendar.findMany({
      where: { organizationId: ctx.organizationId },
      select: { code: true },
    });
    const code = input?.code?.trim()
      ? String(input.code).trim().toUpperCase()
      : nextCodeFromList(
          existing.map((row: { code: string }) => row.code),
          "CAL-",
        );
    return db.workCalendar.create({
      data: {
        organizationId: ctx.organizationId,
        branchId,
        code,
        name,
        timezone,
        workDays,
        isActive,
      },
      include: {
        holidays: {
          include: { holidayType: true },
          orderBy: { holidayDate: "asc" },
        },
      },
    });
  }

  await owned("workCalendar", ctx, id);
  return db.workCalendar.update({
    where: { id },
    data: {
      name,
      workDays,
      branchId,
      timezone,
      ...(input?.isActive !== undefined ? { isActive } : {}),
    },
    include: {
      holidays: {
        include: { holidayType: true },
        orderBy: { holidayDate: "asc" },
      },
    },
  });
}

export async function deleteCalendar(ctx: HrServiceContext, id: string) {
  assertHrPermission(ctx, HR_PERMISSIONS.calendarManage);
  await owned("workCalendar", ctx, id);
  await db.$transaction([
    db.holiday.deleteMany({ where: { workCalendarId: id } }),
    db.employeeWorkCalendar.deleteMany({ where: { workCalendarId: id } }),
    db.workCalendar.delete({ where: { id } }),
  ]);
  return { ok: true, id };
}

export async function saveHoliday(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, HR_PERMISSIONS.calendarManage);
  const name = String(input?.name ?? "").trim();
  if (!name) {
    throw new HrError("VALIDATION_ERROR", { message: "กรุณาระบุชื่อวันหยุด" });
  }
  if (!input?.holidayDate) {
    throw new HrError("VALIDATION_ERROR", { message: "กรุณาระบุวันที่หยุด" });
  }
  if (input.workCalendarId) {
    await owned("workCalendar", ctx, String(input.workCalendarId));
  }

  let holidayTypeId = input.holidayTypeId
    ? String(input.holidayTypeId)
    : "";
  if (!holidayTypeId) {
    const type = await master(
      "holidayType",
      String(input.holidayTypeCode ?? "PUBLIC"),
    );
    holidayTypeId = type.id;
  }

  return db.holiday.create({
    data: {
      organizationId: ctx.organizationId,
      branchId: input.branchId || null,
      workCalendarId: input.workCalendarId || null,
      holidayTypeId,
      holidayDate: date(input.holidayDate),
      name,
      isPaid: input.isPaid !== false,
    },
    include: { holidayType: true },
  });
}

export async function deleteHoliday(ctx: HrServiceContext, id: string) {
  assertHrPermission(ctx, HR_PERMISSIONS.calendarManage);
  const row = await db.holiday.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!row) throw new HrError("NOT_FOUND");
  await db.holiday.delete({ where: { id } });
  return { ok: true, id };
}

export async function seedThaiPublicHolidays(
  ctx: HrServiceContext,
  calendarId: string,
  input: { year?: number; buddhistYear?: number } = {},
) {
  assertHrPermission(ctx, HR_PERMISSIONS.calendarManage);
  await owned("workCalendar", ctx, calendarId);

  const year =
    input.buddhistYear != null
      ? fromBuddhistYear(Number(input.buddhistYear))
      : input.year != null
        ? Number(input.year)
        : new Date().getUTCFullYear();

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ปีไม่ถูกต้อง กรุณาเลือกปี พ.ศ. ที่รองรับ",
    });
  }

  const holidays = thaiPublicHolidaysForYear(year);
  if (holidays.length === 0) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ไม่พบรายการวันหยุดราชการสำหรับปีนี้",
    });
  }

  const holidayType = await master("holidayType", "PUBLIC");
  const existing = await db.holiday.findMany({
    where: {
      workCalendarId: calendarId,
      holidayDate: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    select: { holidayDate: true, name: true },
  });
  const existingKeys = new Set(
    existing.map(
      (row: { holidayDate: Date; name: string }) =>
        `${row.holidayDate.toISOString().slice(0, 10)}|${row.name}`,
    ),
  );

  const toCreate = holidays.filter(
    (h) => !existingKeys.has(`${h.date}|${h.name}`),
  );

  if (toCreate.length > 0) {
    await db.holiday.createMany({
      data: toCreate.map((h) => ({
        organizationId: ctx.organizationId,
        workCalendarId: calendarId,
        holidayTypeId: holidayType.id,
        holidayDate: date(h.date),
        name: h.name,
        isPaid: true,
        branchId: null,
      })),
      skipDuplicates: true,
    });
  }

  return {
    year,
    buddhistYear: year + 543,
    total: holidays.length,
    created: toCreate.length,
    skipped: holidays.length - toCreate.length,
    includesBuddhistLunar: hasBuddhistHolidayTable(year),
  };
}

export async function copyHolidayYear(ctx: HrServiceContext, input: { fromYear: number; toYear: number; calendarId?: string; dryRun?: boolean }) {
  assertHrPermission(ctx, HR_PERMISSIONS.calendarManage);
  const from = new Date(Date.UTC(input.fromYear, 0, 1)), until = new Date(Date.UTC(input.fromYear + 1, 0, 1));
  const rows = await db.holiday.findMany({ where: { organizationId: ctx.organizationId, holidayDate: { gte: from, lt: until }, ...(input.calendarId ? { workCalendarId: input.calendarId } : {}) } });
  const candidates = rows.map((row: any) => ({ ...row, id: undefined, holidayDate: new Date(Date.UTC(input.toYear, row.holidayDate.getUTCMonth(), row.holidayDate.getUTCDate())) }));
  const conflicts = await Promise.all(candidates.map(async (row: any) => db.holiday.findFirst({ where: { workCalendarId: row.workCalendarId, holidayDate: row.holidayDate, name: row.name } })));
  const preview = { candidates: candidates.length, conflicts: conflicts.filter(Boolean).length };
  if (input.dryRun !== false) return preview;
  await db.$transaction(candidates.filter((_: any, i: number) => !conflicts[i]).map((data: any) => db.holiday.create({ data })));
  return preview;
}

export async function listSchedulePeriods(
  ctx: HrServiceContext,
  input: { branchId?: string | null } = {},
) {
  assertHrPermission(ctx, [HR_PERMISSIONS.scheduleRead, HR_PERMISSIONS.scheduleManage]);
  const requested = String(input.branchId ?? "").trim() || null;
  const scope = resolveBranchScope(ctx, requested);
  const where: {
    organizationId: string;
    branchId?: string | { in: string[] };
  } = { organizationId: ctx.organizationId };
  if (scope.branchId) {
    where.branchId = scope.branchId;
  } else if (scope.branchIds != null) {
    where.branchId = { in: [...scope.branchIds] };
  }
  const rows = await db.schedulePeriod.findMany({
    where,
    include: { status: true },
    orderBy: [{ periodStart: "desc" }, { code: "asc" }],
  });
  const attendanceByPeriod = await countAttendanceDaysBySchedulePeriods(
    rows.map((row: { id: string }) => row.id),
  );
  return rows.map((row: { id: string }) => ({
    ...row,
    hasAttendance: (attendanceByPeriod.get(row.id) ?? 0) > 0,
    attendanceDayCount: attendanceByPeriod.get(row.id) ?? 0,
  }));
}

/** Days with punch linked to this schedule (by period, assignment, or employee+date). */
async function countAttendanceDaysForSchedulePeriod(
  schedulePeriodId: string,
): Promise<number> {
  const rows = await db.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(DISTINCT ad.id)::int AS n
    FROM hr.attendance_days ad
    WHERE (ad.clock_in_at IS NOT NULL OR ad.clock_out_at IS NOT NULL)
      AND (
        ad.schedule_period_id = ${schedulePeriodId}::uuid
        OR EXISTS (
          SELECT 1
          FROM hr.shift_assignments sa
          WHERE sa.id = ad.shift_assignment_id
            AND sa.schedule_period_id = ${schedulePeriodId}::uuid
        )
        OR EXISTS (
          SELECT 1
          FROM hr.shift_assignments sa
          WHERE sa.schedule_period_id = ${schedulePeriodId}::uuid
            AND sa.employee_id = ad.employee_id
            AND sa.work_date = ad.work_date
        )
      )
  `;
  return Number(rows[0]?.n ?? 0);
}

async function countAttendanceDaysBySchedulePeriods(
  schedulePeriodIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (schedulePeriodIds.length === 0) return map;
  const rows = await db.$queryRaw<Array<{ schedule_period_id: string; n: number }>>`
    SELECT sa.schedule_period_id::text AS schedule_period_id,
           COUNT(DISTINCT ad.id)::int AS n
    FROM hr.attendance_days ad
    JOIN hr.shift_assignments sa
      ON sa.employee_id = ad.employee_id
     AND sa.work_date = ad.work_date
    WHERE sa.schedule_period_id = ANY(${schedulePeriodIds}::uuid[])
      AND (ad.clock_in_at IS NOT NULL OR ad.clock_out_at IS NOT NULL)
    GROUP BY sa.schedule_period_id
  `;
  for (const row of rows) {
    map.set(row.schedule_period_id, Number(row.n));
  }
  // Also count days that only link via schedule_period_id (assignment removed).
  const linked = await db.$queryRaw<Array<{ schedule_period_id: string; n: number }>>`
    SELECT ad.schedule_period_id::text AS schedule_period_id,
           COUNT(DISTINCT ad.id)::int AS n
    FROM hr.attendance_days ad
    WHERE ad.schedule_period_id = ANY(${schedulePeriodIds}::uuid[])
      AND (ad.clock_in_at IS NOT NULL OR ad.clock_out_at IS NOT NULL)
    GROUP BY ad.schedule_period_id
  `;
  for (const row of linked) {
    map.set(
      row.schedule_period_id,
      Math.max(map.get(row.schedule_period_id) ?? 0, Number(row.n)),
    );
  }
  return map;
}

function requirePeriodBranchId(period: { branchId: string | null }): string {
  if (!period.branchId) {
    throw new HrError("VALIDATION_ERROR", {
      message:
        "ช่วงตารางนี้ยังไม่ได้ระบุสาขา — สร้างช่วงตารางใหม่โดยเลือกสาขาก่อน",
    });
  }
  return period.branchId;
}

async function assertEmployeesBelongToBranch(
  ctx: HrServiceContext,
  employeeIds: string[],
  branchId: string,
) {
  const unique = [...new Set(employeeIds.map(String).filter(Boolean))];
  if (unique.length === 0) return;
  const rows = await db.employee.findMany({
    where: {
      organizationId: ctx.organizationId,
      id: { in: unique },
    },
    select: { id: true, branchId: true },
  });
  if (rows.length !== unique.length) {
    throw new HrError("NOT_FOUND", { message: "ไม่พบพนักงานบางราย" });
  }
  if (
    (rows as Array<{ branchId: string }>).some((row) => row.branchId !== branchId)
  ) {
    throw new HrError("VALIDATION_ERROR", {
      message: "จัดตารางได้เฉพาะพนักงานในสาขาของช่วงตารางนี้",
    });
  }
}

async function ensurePeriodShiftLink(schedulePeriodId: string, shiftId: string) {
  if (db.schedulePeriodShift?.upsert) {
    await db.schedulePeriodShift.upsert({
      where: {
        schedulePeriodId_shiftId: { schedulePeriodId, shiftId },
      },
      create: { schedulePeriodId, shiftId },
      update: {},
    });
    return;
  }
  await db.$executeRaw`
    INSERT INTO hr.schedule_period_shifts (id, schedule_period_id, shift_id)
    VALUES (gen_random_uuid(), ${schedulePeriodId}::uuid, ${shiftId}::uuid)
    ON CONFLICT (schedule_period_id, shift_id) DO NOTHING
  `;
}

async function loadPeriodShiftRows(schedulePeriodId: string) {
  if (db.schedulePeriodShift?.findMany) {
    return db.schedulePeriodShift.findMany({
      where: { schedulePeriodId },
      include: {
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            crossesMidnight: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      shift_id: string;
      name: string;
      start_time: Date;
      end_time: Date;
      crosses_midnight: boolean;
      is_active: boolean;
    }>
  >`
    SELECT
      sps.id::text AS id,
      sps.shift_id::text AS shift_id,
      s.name,
      s.start_time,
      s.end_time,
      s.crosses_midnight,
      s.is_active
    FROM hr.schedule_period_shifts sps
    JOIN hr.shifts s ON s.id = sps.shift_id
    WHERE sps.schedule_period_id = ${schedulePeriodId}::uuid
    ORDER BY sps.created_at ASC
  `;
  return rows.map((row) => ({
    id: row.id,
    schedulePeriodId,
    shiftId: row.shift_id,
    shift: {
      id: row.shift_id,
      name: row.name,
      startTime: row.start_time,
      endTime: row.end_time,
      crossesMidnight: row.crosses_midnight,
      isActive: row.is_active,
    },
  }));
}

/** Lean period load: header + shifts + headcounts (no per-day assignment dump). */
export async function getSchedulePeriod(ctx: HrServiceContext, id: string) {
  assertHrPermission(ctx, [HR_PERMISSIONS.scheduleRead, HR_PERMISSIONS.scheduleManage]);
  const row = await db.schedulePeriod.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: { status: true },
  });
  if (!row) throw new HrError("NOT_FOUND");
  if (row.branchId) assertBranchInScope(ctx, row.branchId);
  assertMatchesSelectedBranch(ctx, row.branchId);

  let periodShifts: unknown[] = [];
  try {
    periodShifts = await loadPeriodShiftRows(id);
  } catch {
    periodShifts = [];
  }

  let employeeCountByShift = new Map<string, number>();
  let assignmentCount = 0;
  try {
    const [distinctRows, total] = await Promise.all([
      db.$queryRaw<Array<{ shift_id: string; employee_count: number }>>`
        SELECT shift_id::text AS shift_id, COUNT(DISTINCT employee_id)::int AS employee_count
        FROM hr.shift_assignments
        WHERE schedule_period_id = ${id}::uuid
          AND shift_id IS NOT NULL
        GROUP BY shift_id
      `,
      db.shiftAssignment.count({ where: { schedulePeriodId: id } }),
    ]);
    assignmentCount = total;
    employeeCountByShift = new Map(
      distinctRows.map((c) => [c.shift_id, Number(c.employee_count)]),
    );
  } catch {
    assignmentCount = 0;
  }

  const overlappingPeriodsRaw = await listOverlappingSchedulePeriodsForBranch({
    organizationId: ctx.organizationId,
    branchId: row.branchId,
    periodId: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
  });
  const attendanceDayCount = await countAttendanceDaysForSchedulePeriod(id);
  const overlapAttendance = await countAttendanceDaysBySchedulePeriods(
    overlappingPeriodsRaw.map((item: { id: string }) => item.id),
  );
  const overlappingPeriods = overlappingPeriodsRaw.map(
    (item: { id: string }) => ({
      ...item,
      attendanceDayCount: overlapAttendance.get(item.id) ?? 0,
      hasAttendance: (overlapAttendance.get(item.id) ?? 0) > 0,
    }),
  );

  return {
    ...row,
    assignmentCount,
    attendanceDayCount,
    hasAttendance: attendanceDayCount > 0,
    overlappingPeriods,
    periodShifts: (periodShifts as Array<{ shiftId: string }>).map((link) => ({
      ...link,
      employeeCount: employeeCountByShift.get(link.shiftId) ?? 0,
    })),
    // Keep empty for API compatibility; shift board uses getScheduleShiftBoard.
    shiftAssignments: [],
  };
}

async function listOverlappingSchedulePeriodsForBranch(input: {
  organizationId: string;
  branchId: string | null;
  periodId?: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  if (!input.branchId) return [];
  const startIso = input.periodStart.toISOString().slice(0, 10);
  const endIso = input.periodEnd.toISOString().slice(0, 10);
  const rows = await db.schedulePeriod.findMany({
    where: {
      organizationId: input.organizationId,
      branchId: input.branchId,
      ...(input.periodId ? { id: { not: input.periodId } } : {}),
      periodStart: { lte: input.periodEnd },
      periodEnd: { gte: input.periodStart },
    },
    include: { status: true },
    orderBy: [{ periodStart: "asc" }, { code: "asc" }],
  });
  return rows
    .filter((row: { periodStart: Date; periodEnd: Date }) =>
      dateRangesOverlap(
        startIso,
        endIso,
        row.periodStart.toISOString().slice(0, 10),
        row.periodEnd.toISOString().slice(0, 10),
      ),
    )
    .map(
      (row: {
        id: string;
        name: string;
        periodStart: Date;
        periodEnd: Date;
        status: { code: string; name: string } | null;
      }) => ({
        id: row.id,
        name: row.name,
        periodStart: row.periodStart.toISOString().slice(0, 10),
        periodEnd: row.periodEnd.toISOString().slice(0, 10),
        statusCode: row.status?.code ?? "—",
        statusName: row.status?.name ?? row.status?.code ?? "—",
      }),
    );
}

async function loadScheduleDateConflicts(input: {
  schedulePeriodId: string;
  employeeIds: string[];
  workDates: Date[];
}): Promise<ScheduleDateConflict[]> {
  if (input.employeeIds.length === 0 || input.workDates.length === 0) return [];
  const rows = await db.shiftAssignment.findMany({
    where: {
      employeeId: { in: input.employeeIds },
      workDate: { in: input.workDates },
      schedulePeriodId: { not: input.schedulePeriodId },
    },
    select: {
      employeeId: true,
      workDate: true,
      employee: {
        select: {
          displayName: true,
          firstNameTh: true,
          lastNameTh: true,
        },
      },
      schedulePeriod: {
        select: {
          id: true,
          name: true,
          periodStart: true,
          periodEnd: true,
        },
      },
    },
    orderBy: [{ workDate: "asc" }],
  });
  return rows.map(
    (row: {
      employeeId: string;
      workDate: Date;
      employee: {
        displayName: string;
        firstNameTh: string;
        lastNameTh: string;
      };
      schedulePeriod: {
        id: string;
        name: string;
        periodStart: Date;
        periodEnd: Date;
      };
    }) => ({
      employeeId: row.employeeId,
      employeeName:
        row.employee.displayName?.trim() ||
        `${row.employee.firstNameTh} ${row.employee.lastNameTh}`.trim(),
      workDate: row.workDate.toISOString().slice(0, 10),
      periodId: row.schedulePeriod.id,
      periodName: row.schedulePeriod.name,
      periodStart: row.schedulePeriod.periodStart.toISOString().slice(0, 10),
      periodEnd: row.schedulePeriod.periodEnd.toISOString().slice(0, 10),
    }),
  );
}

/** Shift page board: people on this shift + employees still free in the period. */
export async function getScheduleShiftBoard(
  ctx: HrServiceContext,
  scheduleId: string,
  shiftId: string,
) {
  assertHrPermission(ctx, [HR_PERMISSIONS.scheduleRead, HR_PERMISSIONS.scheduleManage]);
  const period = await db.schedulePeriod.findFirst({
    where: { id: scheduleId, organizationId: ctx.organizationId },
    include: { status: true },
  });
  if (!period) throw new HrError("NOT_FOUND");
  const periodBranchId = requirePeriodBranchId(period);
  assertBranchInScope(ctx, periodBranchId);
  assertMatchesSelectedBranch(ctx, periodBranchId);

  const shift = await db.shift.findFirst({
    where: { id: shiftId, organizationId: ctx.organizationId },
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
    },
  });
  if (!shift) throw new HrError("NOT_FOUND", { message: "ไม่พบกะงาน" });

  // Prefer linked period-shift; allow board if assignments already exist for this shift.
  let linked = false;
  try {
    if (db.schedulePeriodShift?.findFirst) {
      linked = Boolean(
        await db.schedulePeriodShift.findFirst({
          where: { schedulePeriodId: scheduleId, shiftId },
          select: { id: true },
        }),
      );
    } else {
      const rows = await db.$queryRaw<Array<{ id: string }>>`
        SELECT id::text AS id FROM hr.schedule_period_shifts
        WHERE schedule_period_id = ${scheduleId}::uuid
          AND shift_id = ${shiftId}::uuid
        LIMIT 1
      `;
      linked = rows.length > 0;
    }
  } catch {
    linked = false;
  }

  const [assignmentDates, assignedInPeriod, employees, periodShiftRows] =
    await Promise.all([
      db.shiftAssignment.findMany({
        where: { schedulePeriodId: scheduleId, shiftId },
        select: {
          employeeId: true,
          workDate: true,
          isLeaveDay: true,
          notes: true,
          coversForEmployee: {
            select: {
              id: true,
              displayName: true,
              firstNameTh: true,
              lastNameTh: true,
            },
          },
          employee: {
            select: {
              id: true,
              firstNameTh: true,
              lastNameTh: true,
              displayName: true,
            },
          },
        },
        orderBy: { workDate: "asc" },
      }),
      db.shiftAssignment.findMany({
        where: { schedulePeriodId: scheduleId },
        select: { employeeId: true },
        distinct: ["employeeId"],
      }),
      db.employee.findMany({
        where: {
          organizationId: ctx.organizationId,
          branchId: periodBranchId,
          isActive: true,
        },
        select: {
          id: true,
          firstNameTh: true,
          lastNameTh: true,
        },
        orderBy: [{ firstNameTh: "asc" }, { lastNameTh: "asc" }],
        take: 500,
      }),
      loadPeriodShiftRows(scheduleId).catch(() => []),
    ]);

  type BoardRow = {
    employeeId: string;
    workDate: Date;
    isLeaveDay: boolean;
    notes: string | null;
    coversForEmployee: {
      id: string;
      displayName: string;
      firstNameTh: string;
      lastNameTh: string;
    } | null;
    employee: {
      id: string;
      firstNameTh: string;
      lastNameTh: string;
      displayName: string;
    };
  };

  const byEmployee = new Map<
    string,
    {
      label: string;
      workDates: string[];
      /** Person being covered → cover duty dates */
      coverDatesByName: Map<string, string[]>;
      /** Previous shift name → dates moved into this shift */
      fromShiftDatesByName: Map<string, string[]>;
      /** Original dates before date-move */
      movedFromDates: string[];
      leaveDates: number;
    }
  >();
  for (const row of assignmentDates as BoardRow[]) {
    const name =
      row.employee.displayName?.trim() ||
      `${row.employee.firstNameTh} ${row.employee.lastNameTh}`.trim();
    const entry = byEmployee.get(row.employeeId) ?? {
      label: name,
      workDates: [],
      coverDatesByName: new Map<string, string[]>(),
      fromShiftDatesByName: new Map<string, string[]>(),
      movedFromDates: [],
      leaveDates: 0,
    };
    const iso = row.workDate.toISOString().slice(0, 10);
    if (!row.isLeaveDay) {
      entry.workDates.push(iso);
    } else {
      entry.leaveDates += 1;
    }
    if (row.coversForEmployee) {
      const coverName =
        row.coversForEmployee.displayName?.trim() ||
        `${row.coversForEmployee.firstNameTh} ${row.coversForEmployee.lastNameTh}`.trim();
      if (coverName) {
        const dates = entry.coverDatesByName.get(coverName) ?? [];
        dates.push(iso);
        entry.coverDatesByName.set(coverName, dates);
      }
    }
    const fromShiftName = parseFromShiftName(row.notes);
    if (fromShiftName) {
      const dates = entry.fromShiftDatesByName.get(fromShiftName) ?? [];
      dates.push(iso);
      entry.fromShiftDatesByName.set(fromShiftName, dates);
    }
    const fromDates = parseFromDates(row.notes);
    if (fromDates.length > 0) {
      entry.movedFromDates.push(...fromDates);
    }
    byEmployee.set(row.employeeId, entry);
  }

  const onShift = [...byEmployee.entries()]
    .filter(([, entry]) => entry.workDates.length > 0 || entry.leaveDates > 0)
    .map(([employeeId, entry]) => {
      const coverParts = [...entry.coverDatesByName.entries()].map(
        ([coverName, dates]) => {
          const label = formatDutyDatesLabel(dates);
          return label ? `แทน ${coverName} · ${label}` : `แทน ${coverName}`;
        },
      );
      const moveParts = [
        ...[...entry.fromShiftDatesByName.entries()].map(
          ([shiftName, dates]) => {
            const label = formatDutyDatesLabel(dates);
            return label
              ? `ย้ายจาก ${shiftName} · ${label}`
              : `ย้ายจาก ${shiftName}`;
          },
        ),
        ...(entry.movedFromDates.length > 0
          ? [
              `ย้ายมาจาก ${formatDutyDatesLabel(entry.movedFromDates)}`,
            ]
          : []),
      ];
      const coverNote = coverParts.length > 0 ? coverParts.join(" · ") : null;
      const moveNote = moveParts.length > 0 ? moveParts.join(" · ") : null;
      const leaveNote =
        entry.workDates.length === 0 && entry.leaveDates > 0 ? "ลา" : null;
      return {
        employeeId,
        label: entry.label,
        dayCount: entry.workDates.length || entry.leaveDates,
        workDates: entry.workDates,
        coverNote,
        moveNote,
        leaveNote,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "th"));
  if (!linked && onShift.length === 0) {
    throw new HrError("NOT_FOUND", { message: "ยังไม่ได้เพิ่มกะนี้ในช่วงตาราง" });
  }

  const assignedIds = new Set(
    assignedInPeriod.map((r: { employeeId: string }) => r.employeeId),
  );
  const unassigned = employees
    .filter((e: { id: string }) => !assignedIds.has(e.id))
    .map((e: { id: string; firstNameTh: string; lastNameTh: string }) => ({
      id: e.id,
      label: `${e.firstNameTh} ${e.lastNameTh}`.trim(),
    }));

  const employeeOptions = employees.map(
    (e: { id: string; firstNameTh: string; lastNameTh: string }) => ({
      id: e.id,
      label: `${e.firstNameTh} ${e.lastNameTh}`.trim(),
    }),
  );

  const otherShifts = (
    periodShiftRows as Array<{
      shiftId: string;
      shift: {
        id: string;
        name: string;
        startTime: Date;
        endTime: Date;
      };
    }>
  )
    .filter((link) => link.shiftId !== shiftId)
    .map((link) => {
      const start = formatShiftClock(link.shift.startTime);
      const end = formatShiftClock(link.shift.endTime);
      return {
        id: link.shiftId,
        label: `${link.shift.name}${start && end ? ` · ${start}–${end}` : ""}`,
      };
    });

  return {
    period,
    shift,
    onShift,
    unassigned,
    otherShifts,
    employeeOptions,
  };
}

export async function createSchedulePeriod(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, HR_PERMISSIONS.scheduleManage);
  const branchId = String(input.branchId ?? "").trim() || ctx.branchId || null;
  if (!branchId) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ต้องเลือกสาขาก่อนสร้างช่วงตาราง",
    });
  }
  assertBranchInScope(ctx, branchId);
  const draft = await master("schedulePeriodStatus", "DRAFT");
  const existing = await db.schedulePeriod.findMany({
    where: { organizationId: ctx.organizationId },
    select: { code: true },
  });
  const code = input.code?.trim()
    ? String(input.code).trim().toUpperCase()
    : nextCodeFromList(
        existing.map((row: { code: string }) => row.code),
        "SCH-",
      );
  const today = new Date();
  const periodStart = input.periodStart
    ? date(input.periodStart)
    : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const periodEnd = input.periodEnd
    ? date(input.periodEnd)
    : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  const name =
    String(input.name ?? "").trim() ||
    `ช่วงตาราง ${formatThaiDateRange(periodStart, periodEnd)}`;
  const overlappingPeriods = await listOverlappingSchedulePeriodsForBranch({
    organizationId: ctx.organizationId,
    branchId,
    periodStart,
    periodEnd,
  });
  const created = await db.schedulePeriod.create({
    data: {
      organizationId: ctx.organizationId,
      branchId,
      code,
      name,
      periodStart,
      periodEnd,
      timezone: input.timezone ?? "Asia/Bangkok",
      statusId: draft.id,
    },
    include: { status: true },
  });
  return { ...created, overlappingPeriods };
}

export async function updateSchedulePeriod(
  ctx: HrServiceContext,
  id: string,
  input: any,
) {
  assertHrPermission(ctx, HR_PERMISSIONS.scheduleManage);
  const period = await owned("schedulePeriod", ctx, id);
  const status = await db.schedulePeriodStatus.findUnique({
    where: { id: period.statusId },
  });
  mutable(status?.code ?? "DRAFT");

  const periodStart = input.periodStart
    ? date(input.periodStart)
    : period.periodStart;
  const periodEnd = input.periodEnd ? date(input.periodEnd) : period.periodEnd;
  if (periodEnd.getTime() < periodStart.getTime()) {
    throw new HrError("VALIDATION_ERROR", {
      message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม",
    });
  }

  const name =
    input.name !== undefined
      ? String(input.name ?? "").trim() ||
        `ช่วงตาราง ${formatThaiDateRange(periodStart, periodEnd)}`
      : undefined;

  return db.schedulePeriod.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      periodStart,
      periodEnd,
      ...(input.timezone !== undefined
        ? { timezone: String(input.timezone).trim() || "Asia/Bangkok" }
        : {}),
      ...(input.branchId !== undefined
        ? { branchId: input.branchId || null }
        : {}),
    },
    include: { status: true },
  });
}

export async function deleteSchedulePeriod(ctx: HrServiceContext, id: string) {
  assertHrPermission(ctx, HR_PERMISSIONS.scheduleManage);
  const period = await owned("schedulePeriod", ctx, id);
  const status = await db.schedulePeriodStatus.findUnique({
    where: { id: period.statusId },
  });
  mutable(status?.code ?? "DRAFT");

  const attendanceDays = await countAttendanceDaysForSchedulePeriod(id);
  if (attendanceDays > 0) {
    throw new HrError("VALIDATION_ERROR", {
      message: `ลบไม่ได้ — มีพนักงานลงเวลาแล้ว ${attendanceDays} วัน ในช่วงตารางนี้`,
      details: {
        conflictCode: "SCHEDULE_HAS_ATTENDANCE",
        attendanceDayCount: attendanceDays,
      },
    });
  }

  await db.shiftAssignment.deleteMany({ where: { schedulePeriodId: id } });
  try {
    await db.schedulePeriodShift.deleteMany({ where: { schedulePeriodId: id } });
  } catch {
    // Table may not exist until migration 0003 is applied.
  }
  await db.schedulePeriod.delete({ where: { id } });
  return { ok: true, id };
}

function normalizeWorkDates(input: { workDates?: unknown; workDate?: unknown }): string[] {
  const raw = Array.isArray(input.workDates)
    ? input.workDates
    : input.workDate
      ? [input.workDate]
      : [];
  return [...new Set(raw.map((d) => String(d).slice(0, 10)).filter(Boolean))].sort();
}

async function assertShiftInOrg(ctx: HrServiceContext, shiftId: string) {
  const shift = await db.shift.findFirst({
    where: { id: shiftId, organizationId: ctx.organizationId },
  });
  if (!shift) throw new HrError("NOT_FOUND", { message: "ไม่พบกะงาน" });
  return shift;
}

async function assertEmployeeInOrg(ctx: HrServiceContext, employeeId: string) {
  const employee = await db.employee.findFirst({
    where: { id: employeeId, organizationId: ctx.organizationId, isActive: true },
    select: { id: true, branchId: true },
  });
  if (!employee) throw new HrError("NOT_FOUND", { message: "ไม่พบพนักงาน" });
  return employee;
}

/** Cover must be active and on the same branch as the leave employee. */
async function assertLeaveCoverSameBranch(
  ctx: HrServiceContext,
  leaveEmployeeId: string,
  coverEmployeeId: string,
) {
  const [leaveEmployee, coverEmployee] = await Promise.all([
    db.employee.findFirst({
      where: {
        id: leaveEmployeeId,
        organizationId: ctx.organizationId,
        isActive: true,
      },
      select: { id: true, branchId: true },
    }),
    db.employee.findFirst({
      where: {
        id: coverEmployeeId,
        organizationId: ctx.organizationId,
        isActive: true,
      },
      select: { id: true, branchId: true },
    }),
  ]);
  if (!leaveEmployee || !coverEmployee) {
    throw new HrError("NOT_FOUND", { message: "ไม่พบพนักงาน" });
  }
  if (leaveEmployee.branchId !== coverEmployee.branchId) {
    throw new HrError("VALIDATION_ERROR", {
      message: "คนทำงานแทนต้องอยู่สาขาเดียวกับผู้ลา",
    });
  }
  return coverEmployee;
}

const NOTE_FROM_SHIFT = "GS:fromShift";
const NOTE_FROM_DATES = "GS:fromDates";

function encodeFromShiftNote(shiftName: string): string {
  return `${NOTE_FROM_SHIFT}|name:${shiftName.replace(/[\n|]/g, " ").trim() || "กะอื่น"}`;
}

function mergeScheduleNotes(
  existing: string | null | undefined,
  nextLine: string,
): string {
  const prefix = nextLine.split("|")[0] ?? nextLine;
  const kept = String(existing ?? "")
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith(prefix));
  kept.push(nextLine);
  return kept.join("\n");
}

function parseFromShiftName(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = new RegExp(
    `(?:^|\\n)${NOTE_FROM_SHIFT}\\|name:([^\\n]+)`,
  ).exec(notes);
  return match?.[1]?.trim() || null;
}

function parseFromDates(notes: string | null | undefined): string[] {
  if (!notes) return [];
  const match = new RegExp(
    `(?:^|\\n)${NOTE_FROM_DATES}\\|([^\\n]+)`,
  ).exec(notes);
  if (!match?.[1]) return [];
  return match[1]
    .split(",")
    .map((d) => d.trim())
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
}

function formatDutyDatesLabel(dates: string[]): string {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return formatThaiDate(sorted[0]!);
  return `${formatThaiDateRange(sorted[0], sorted[sorted.length - 1])} (${sorted.length} วัน)`;
}

/** เปลี่ยนกะ / ย้ายไปกะอื่น ในวันที่เลือก */
async function changeShiftOnDates(
  ctx: HrServiceContext,
  schedulePeriodId: string,
  input: any,
) {
  const employeeId = String(input.employeeId ?? "");
  const fromShiftId = String(input.fromShiftId ?? input.shiftId ?? "");
  const toShiftId = String(input.toShiftId ?? "");
  const workDates = normalizeWorkDates(input);
  if (!employeeId || !fromShiftId || !toShiftId) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ต้องระบุพนักงาน กะเดิม และกะใหม่",
    });
  }
  if (fromShiftId === toShiftId) {
    throw new HrError("VALIDATION_ERROR", { message: "กะใหม่ต้องต่างจากกะเดิม" });
  }
  if (workDates.length === 0) {
    throw new HrError("VALIDATION_ERROR", { message: "เลือกอย่างน้อย 1 วัน" });
  }
  await assertEmployeeInOrg(ctx, employeeId);
  await assertShiftInOrg(ctx, toShiftId);
  const period = await owned("schedulePeriod", ctx, schedulePeriodId);
  const periodBranchId = requirePeriodBranchId(period);
  assertBranchInScope(ctx, periodBranchId);
  assertMatchesSelectedBranch(ctx, periodBranchId);
  await assertEmployeesBelongToBranch(ctx, [employeeId], periodBranchId);
  await ensurePeriodShiftLink(schedulePeriodId, toShiftId);

  const dateValues = workDates.map((d) => date(d));
  const [existing, fromShift] = await Promise.all([
    db.shiftAssignment.findMany({
      where: {
        schedulePeriodId,
        employeeId,
        shiftId: fromShiftId,
        workDate: { in: dateValues },
      },
      select: { id: true, notes: true },
    }),
    db.shift.findFirst({
      where: { id: fromShiftId, organizationId: ctx.organizationId },
      select: { name: true },
    }),
  ]);
  if (existing.length === 0) {
    throw new HrError("NOT_FOUND", {
      message: "ไม่พบกะของพนักงานในวันที่เลือก",
    });
  }

  const fromShiftNote = encodeFromShiftNote(fromShift?.name ?? "กะอื่น");
  await db.$transaction(
    existing.map((row: { id: string; notes: string | null }) =>
      db.shiftAssignment.update({
        where: { id: row.id },
        data: {
          shiftId: toShiftId,
          notes: mergeScheduleNotes(row.notes, fromShiftNote),
        },
      }),
    ),
  );
  return { ok: true, count: existing.length, action: "changeShift" };
}

/** Internal one-day move used by shift-mismatch approval (no header-branch gate). */
async function applyApprovedShiftMismatchMove(input: {
  organizationId: string;
  schedulePeriodId: string;
  employeeId: string;
  fromShiftId: string;
  toShiftId: string;
  workDate: Date;
}) {
  await ensurePeriodShiftLink(input.schedulePeriodId, input.toShiftId);
  const existing = await db.shiftAssignment.findMany({
    where: {
      schedulePeriodId: input.schedulePeriodId,
      employeeId: input.employeeId,
      shiftId: input.fromShiftId,
      workDate: input.workDate,
    },
    select: { id: true, notes: true },
  });
  if (existing.length === 0) {
    throw new HrError("NOT_FOUND", {
      message: "ไม่พบกะของพนักงานในวันที่เลือก",
    });
  }
  const fromShift = await db.shift.findFirst({
    where: { id: input.fromShiftId, organizationId: input.organizationId },
    select: { name: true },
  });
  const fromShiftNote = encodeFromShiftNote(fromShift?.name ?? "กะอื่น");
  await db.$transaction(
    existing.map((row: { id: string; notes: string | null }) =>
      db.shiftAssignment.update({
        where: { id: row.id },
        data: {
          shiftId: input.toShiftId,
          notes: mergeScheduleNotes(row.notes, fromShiftNote),
        },
      }),
    ),
  );
}

/** คนอื่นทำงานแทนในวันที่เลือก (กะเดิม) */
async function substituteOnDates(
  ctx: HrServiceContext,
  schedulePeriodId: string,
  input: any,
) {
  const employeeId = String(input.employeeId ?? "");
  const substituteEmployeeId = String(input.substituteEmployeeId ?? "");
  const shiftId = String(input.shiftId ?? "");
  const workDates = normalizeWorkDates(input);
  if (!employeeId || !substituteEmployeeId || !shiftId) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ต้องระบุพนักงานเดิม คนทำงานแทน และกะ",
    });
  }
  if (employeeId === substituteEmployeeId) {
    throw new HrError("VALIDATION_ERROR", {
      message: "คนทำงานแทนต้องเป็นคนละคน",
    });
  }
  if (workDates.length === 0) {
    throw new HrError("VALIDATION_ERROR", { message: "เลือกอย่างน้อย 1 วัน" });
  }
  await assertEmployeeInOrg(ctx, employeeId);
  await assertEmployeeInOrg(ctx, substituteEmployeeId);
  await assertShiftInOrg(ctx, shiftId);
  const period = await owned("schedulePeriod", ctx, schedulePeriodId);
  const periodBranchId = requirePeriodBranchId(period);
  assertBranchInScope(ctx, periodBranchId);
  assertMatchesSelectedBranch(ctx, periodBranchId);
  await assertEmployeesBelongToBranch(
    ctx,
    [employeeId, substituteEmployeeId],
    periodBranchId,
  );

  const dateValues = workDates.map((d) => date(d));
  const sourceRows = await db.shiftAssignment.findMany({
    where: {
      schedulePeriodId,
      employeeId,
      shiftId,
      workDate: { in: dateValues },
    },
  });
  if (sourceRows.length === 0) {
    throw new HrError("NOT_FOUND", {
      message: "ไม่พบกะของพนักงานในวันที่เลือก",
    });
  }

  // Auto-move: clear the substitute's existing assignments on those days
  // so users don't need to cancel their prior shift first.
  await db.$transaction(async (tx) => {
    await tx.shiftAssignment.deleteMany({
      where: {
        schedulePeriodId,
        employeeId,
        shiftId,
        workDate: { in: dateValues },
      },
    });
    await tx.shiftAssignment.deleteMany({
      where: {
        employeeId: substituteEmployeeId,
        workDate: { in: dateValues },
      },
    });
    await tx.shiftAssignment.createMany({
      data: sourceRows.map(
        (row: {
          workDate: Date;
          sequenceNo: number;
          workLocationId: string | null;
          isRestDay: boolean;
          isLeaveDay: boolean;
          notes: string | null;
        }) => ({
          schedulePeriodId,
          employeeId: substituteEmployeeId,
          shiftId,
          workDate: row.workDate,
          sequenceNo: row.sequenceNo,
          workLocationId: row.workLocationId,
          isRestDay: row.isRestDay,
          isLeaveDay: false,
          coversForEmployeeId: employeeId,
          notes: row.notes,
          createdByAuthUserId: actor(ctx),
        }),
      ),
      skipDuplicates: true,
    });
  });

  return {
    ok: true,
    count: sourceRows.length,
    action: "substitute",
  };
}

export async function scheduleAction(ctx: HrServiceContext, id: string, input: any) {
  const period = await owned("schedulePeriod", ctx, id); const status = await db.schedulePeriodStatus.findUnique({ where: { id: period.statusId } });
  mutable(status?.code ?? "DRAFT"); assertConfirmed(input.confirm);
  if (period.branchId) assertBranchInScope(ctx, period.branchId);
  assertMatchesSelectedBranch(ctx, period.branchId);
  if (input.action === "publish" || input.action === "unpublish" || input.action === "lock") {
    assertHrPermission(ctx, input.action === "publish" ? HR_PERMISSIONS.schedulePublish : HR_PERMISSIONS.scheduleManage);
    const code = input.action === "publish" ? "PUBLISHED" : input.action === "lock" ? "LOCKED" : "DRAFT";
    const next = await master("schedulePeriodStatus", code);
    return db.schedulePeriod.update({ where: { id }, data: { statusId: next.id, publishedAt: code === "PUBLISHED" ? new Date() : null, publishedByAuthUserId: code === "PUBLISHED" ? actor(ctx) : null, lockedAt: code === "LOCKED" ? new Date() : null, lockedByAuthUserId: code === "LOCKED" ? actor(ctx) : null } });
  }
  assertHrPermission(ctx, HR_PERMISSIONS.scheduleManage);

  if (input.action === "addShift") {
    const shiftId = String(input.shiftId ?? "");
    if (!shiftId) {
      throw new HrError("VALIDATION_ERROR", { message: "ต้องเลือกกะ" });
    }
    const shift = await db.shift.findFirst({
      where: { id: shiftId, organizationId: ctx.organizationId, isActive: true },
    });
    if (!shift) throw new HrError("NOT_FOUND", { message: "ไม่พบกะงาน" });
    await ensurePeriodShiftLink(id, shiftId);
    return { ok: true, shiftId };
  }

  if (input.action === "removeShift") {
    const shiftId = String(input.shiftId ?? "");
    if (!shiftId) {
      throw new HrError("VALIDATION_ERROR", { message: "ต้องระบุกะ" });
    }
    await db.shiftAssignment.deleteMany({
      where: { schedulePeriodId: id, shiftId },
    });
    if (db.schedulePeriodShift?.deleteMany) {
      await db.schedulePeriodShift.deleteMany({
        where: { schedulePeriodId: id, shiftId },
      });
    } else {
      await db.$executeRaw`
        DELETE FROM hr.schedule_period_shifts
        WHERE schedule_period_id = ${id}::uuid
          AND shift_id = ${shiftId}::uuid
      `;
    }
    return { ok: true, shiftId };
  }

  if (input.action === "delete") {
    const where: Record<string, unknown> = { schedulePeriodId: id };
    if (input.assignmentId) where.id = input.assignmentId;
    if (input.employeeId) where.employeeId = input.employeeId;
    if (input.shiftId) where.shiftId = input.shiftId;
    if (input.workDate) where.workDate = date(input.workDate);
    if (Array.isArray(input.workDates) && input.workDates.length > 0) {
      where.workDate = { in: input.workDates.map((d: string) => date(d)) };
    }
    if (
      !input.assignmentId &&
      !input.employeeId &&
      !input.shiftId &&
      !input.workDate &&
      !(Array.isArray(input.workDates) && input.workDates.length > 0)
    ) {
      throw new HrError("VALIDATION_ERROR", {
        message: "ต้องระบุรายการที่จะลบ",
      });
    }
    return db.shiftAssignment.deleteMany({ where });
  }

  if (input.action === "changeShift") {
    return changeShiftOnDates(ctx, id, input);
  }
  if (input.action === "substitute") {
    return substituteOnDates(ctx, id, input);
  }
  if (input.action === "moveDates") {
    throw new HrError("VALIDATION_ERROR", {
      message: "ฟังก์ชันย้ายวันถูกเลิกใช้แล้ว — ใช้ย้ายไปกะอื่นแทน",
    });
  }

  const employees: string[] = (input.employeeIds ?? [input.employeeId]).filter(
    Boolean,
  );
  const dates: string[] = (input.workDates ?? [input.workDate]).filter(Boolean);
  const shiftId = input.shiftId ?? null;
  const conflictModeRaw = String(input.conflictMode ?? "reject").trim();
  const conflictMode =
    conflictModeRaw === "skip" || conflictModeRaw === "reassign"
      ? conflictModeRaw
      : "reject";
  const periodBranchId = requirePeriodBranchId(period);
  await assertEmployeesBelongToBranch(ctx, employees, periodBranchId);
  if (employees.length === 0) {
    throw new HrError("VALIDATION_ERROR", { message: "เลือกพนักงานอย่างน้อย 1 คน" });
  }
  if (dates.length === 0) {
    throw new HrError("VALIDATION_ERROR", { message: "เลือกวันทำงานอย่างน้อย 1 วัน" });
  }
  if (shiftId) {
    const shift = await db.shift.findFirst({
      where: { id: shiftId, organizationId: ctx.organizationId },
    });
    if (!shift) throw new HrError("NOT_FOUND", { message: "ไม่พบกะงาน" });
    await ensurePeriodShiftLink(id, shiftId);
  }

  const workDateValues = dates.map((d) => date(d));
  const dateConflicts = await loadScheduleDateConflicts({
    schedulePeriodId: id,
    employeeIds: employees,
    workDates: workDateValues,
  });

  if (dateConflicts.length > 0 && conflictMode === "reject") {
    const periods = summarizeConflictPeriods(dateConflicts);
    const people = new Set(dateConflicts.map((c) => c.employeeId)).size;
    throw new HrError("VALIDATION_ERROR", {
      message: `มีพนักงานถูกจัดวันซ้ำในช่วงตารางอื่นแล้ว (${dateConflicts.length} วัน · ${people} คน)`,
      details: {
        conflictCode: "SCHEDULE_DATE_CONFLICT",
        conflicts: dateConflicts,
        periods,
      },
    });
  }

  if (dateConflicts.length > 0 && conflictMode === "reassign") {
    await db.shiftAssignment.deleteMany({
      where: {
        employeeId: { in: employees },
        workDate: { in: workDateValues },
        schedulePeriodId: { not: id },
      },
    });
  }

  const blockedKeys =
    conflictMode === "skip"
      ? new Set(
          dateConflicts.map((c) => `${c.employeeId}|${c.workDate}`),
        )
      : new Set<string>();

  const assignments = employees.flatMap((employeeId) =>
    dates
      .filter((workDate) => !blockedKeys.has(`${employeeId}|${workDate}`))
      .map((workDate) => ({
        schedulePeriodId: id,
        employeeId,
        workDate: date(workDate),
        shiftId,
        workLocationId: input.workLocationId ?? null,
        isRestDay: !!input.isRestDay,
        isLeaveDay: !!input.isLeaveDay,
        createdByAuthUserId: actor(ctx),
      })),
  );

  if (assignments.length === 0) {
    throw new HrError("VALIDATION_ERROR", {
      message:
        "ไม่มีวันที่ว่างให้จัด — พนักงานถูกจัดครบในวันที่เลือกแล้วในช่วงตารางอื่น",
      details: {
        conflictCode: "SCHEDULE_DATE_CONFLICT",
        conflicts: dateConflicts,
        periods: summarizeConflictPeriods(dateConflicts),
      },
    });
  }

  const existing = await db.shiftAssignment.findMany({
    where: {
      employeeId: { in: employees },
      workDate: { in: workDateValues },
    },
    include: { shift: true },
  });

  // Same period already has these employee+dates → not a cross-period conflict.
  const alreadyHereKeys = new Set(
    existing
      .filter((row: { schedulePeriodId: string }) => row.schedulePeriodId === id)
      .map(
        (row: { employeeId: string; workDate: Date }) =>
          `${row.employeeId}|${row.workDate.toISOString().slice(0, 10)}`,
      ),
  );
  const freshAssignments = assignments.filter(
    (row) =>
      !alreadyHereKeys.has(
        `${row.employeeId}|${row.workDate.toISOString().slice(0, 10)}`,
      ),
  );
  if (freshAssignments.length === 0) {
    throw new HrError("VALIDATION_ERROR", {
      message:
        "พนักงานที่เลือกถูกจัดวันเหล่านี้ในช่วงตารางนี้แล้ว — ไม่ต้องจัดซ้ำ",
    });
  }

  let proposedShiftClock: {
    startTime: Date;
    endTime: Date;
    crossesMidnight: boolean;
  } | null = null;
  if (shiftId) {
    proposedShiftClock = await db.shift.findFirst({
      where: { id: shiftId, organizationId: ctx.organizationId },
      select: { startTime: true, endTime: true, crossesMidnight: true },
    });
  }

  const timeCheckRows = [
    ...existing
      .filter((x: { shift: unknown }) => x.shift)
      .map((x: any) => ({
        id: x.id,
        employeeId: x.employeeId as string,
        workDate: x.workDate.toISOString().slice(0, 10),
        startTime: x.shift.startTime,
        endTime: x.shift.endTime,
        crossesMidnight: x.shift.crossesMidnight,
      })),
    ...(proposedShiftClock
      ? freshAssignments.map((row, index) => ({
          id: `proposed-${index}`,
          employeeId: row.employeeId,
          workDate: row.workDate.toISOString().slice(0, 10),
          startTime: proposedShiftClock!.startTime,
          endTime: proposedShiftClock!.endTime,
          crossesMidnight: proposedShiftClock!.crossesMidnight,
        }))
      : []),
  ];
  const timeConflicts = findOverlappingAssignments(timeCheckRows);
  if (timeConflicts.length) {
    throw new HrError("INVALID_SHIFT", {
      message: "กะของพนักงานคนเดียวกันซ้อนเวลาในวันเดียวกัน",
      details: { conflicts: timeConflicts },
    });
  }

  const created = await db.shiftAssignment.createMany({
    data: freshAssignments,
    skipDuplicates: true,
  });
  if (created.count === 0) {
    throw new HrError("VALIDATION_ERROR", {
      message:
        "ไม่สามารถเพิ่มได้ — วันเหล่านี้ถูกจัดไว้แล้วสำหรับพนักงานที่เลือก",
    });
  }
  return {
    count: created.count,
    requested: employees.length * dates.length,
    skipped: dateConflicts.length > 0 && conflictMode === "skip" ? dateConflicts.length : 0,
    reassigned: conflictMode === "reassign" ? dateConflicts.length : 0,
    periods: summarizeConflictPeriods(dateConflicts),
  };
}

function bangkokDayBounds(at = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
  return {
    day,
    start: new Date(`${day}T00:00:00+07:00`),
    end: new Date(`${day}T23:59:59.999+07:00`),
  };
}

async function resolvePrimaryWorkLocation(employeeId: string) {
  const { day } = bangkokDayBounds();
  const asOf = date(day);
  const link = await db.employeeWorkLocation.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    },
    include: {
      workLocation: true,
    },
    orderBy: { effectiveFrom: "desc" },
  });
  if (link?.workLocation?.isActive) return link.workLocation;
  const fallback = await db.employeeWorkLocation.findFirst({
    where: {
      employeeId,
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      workLocation: { isActive: true },
    },
    include: { workLocation: true },
    orderBy: [{ isPrimary: "desc" }, { effectiveFrom: "desc" }],
  });
  return fallback?.workLocation ?? null;
}

function serializeWorkLocation(location: {
  id: string;
  code: string;
  name: string;
  latitude: { toString(): string } | number | null;
  longitude: { toString(): string } | number | null;
  geofenceRadiusMeters: number;
} | null) {
  if (!location) return null;
  return {
    id: location.id,
    code: location.code,
    name: location.name,
    latitude: location.latitude == null ? null : Number(location.latitude),
    longitude: location.longitude == null ? null : Number(location.longitude),
    geofenceRadiusMeters: location.geofenceRadiusMeters,
  };
}

function wallClockMinutes(time: Date): number {
  return time.getUTCHours() * 60 + time.getUTCMinutes();
}

function bangkokScheduleInstant(workDate: string, minutesFromMidnight: number): number {
  return (
    new Date(`${workDate}T00:00:00+07:00`).getTime() +
    minutesFromMidnight * 60_000
  );
}

function computeLateEarlyMinutes(input: {
  workDate: string;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  startTime?: Date | null;
  endTime?: Date | null;
  graceLateMinutes?: number | null;
  graceEarlyLeaveMinutes?: number | null;
  crossesMidnight?: boolean | null;
}): { lateMinutes: number; earlyLeaveMinutes: number } {
  if (!input.clockInAt || !input.startTime) {
    return { lateMinutes: 0, earlyLeaveMinutes: 0 };
  }
  const startMin = wallClockMinutes(input.startTime);
  const endMin = input.endTime ? wallClockMinutes(input.endTime) : startMin;
  const crosses =
    input.crossesMidnight ?? endMin <= startMin;
  const span = crosses
    ? 24 * 60 - startMin + endMin
    : Math.max(0, endMin - startMin);
  const scheduledStart = bangkokScheduleInstant(input.workDate, startMin);
  const scheduledEnd = scheduledStart + span * 60_000;
  const lateMinutes = Math.max(
    0,
    Math.floor((input.clockInAt.getTime() - scheduledStart) / 60_000) -
      (input.graceLateMinutes ?? 0),
  );
  const earlyLeaveMinutes = input.clockOutAt
    ? Math.max(
        0,
        Math.floor((scheduledEnd - input.clockOutAt.getTime()) / 60_000) -
          (input.graceEarlyLeaveMinutes ?? 0),
      )
    : 0;
  return { lateMinutes, earlyLeaveMinutes };
}

function formatMinutesLabel(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "—";
  return `${Math.round(minutes)} นาที`;
}

type SelfAttendanceAssignment = {
  id: string;
  workDate: Date;
  isRestDay: boolean;
  isLeaveDay: boolean;
  shift: {
    name: string;
    startTime: Date;
    endTime: Date;
    graceLateMinutes: number;
    graceEarlyLeaveMinutes: number;
    crossesMidnight: boolean;
  } | null;
  schedulePeriod: {
    id: string;
    name: string;
    periodStart: Date;
    periodEnd: Date;
    status: { code: string; name: string };
  };
};

/** Pick the published/locked period that covers today (else nearest). */
function pickCurrentSchedulePeriod(
  rows: SelfAttendanceAssignment[],
  todayIso: string,
): SelfAttendanceAssignment["schedulePeriod"] | null {
  const byId = new Map<string, SelfAttendanceAssignment["schedulePeriod"]>();
  for (const row of rows) {
    byId.set(row.schedulePeriod.id, row.schedulePeriod);
  }
  const periods = [...byId.values()].sort((a, b) =>
    a.periodStart.getTime() - b.periodStart.getTime(),
  );
  if (periods.length === 0) return null;

  const covering = periods.filter((period) => {
    const start = period.periodStart.toISOString().slice(0, 10);
    const end = period.periodEnd.toISOString().slice(0, 10);
    return start <= todayIso && todayIso <= end;
  });
  if (covering.length > 0) {
    return covering[covering.length - 1]!;
  }

  const upcoming = periods.find(
    (period) => period.periodStart.toISOString().slice(0, 10) > todayIso,
  );
  if (upcoming) return upcoming;

  return periods[periods.length - 1]!;
}

/**
 * Self-service attendance history aligned to the current published schedule
 * period (same window as ตารางงานของฉัน). Falls back to today if no schedule.
 */
export async function listSelfAttendanceToday(ctx: HrServiceContext) {
  assertHrPermission(ctx, HR_PERMISSIONS.attendanceSelf);
  const employee = await resolveSelfEmployee(ctx);
  const { day: today } = bangkokDayBounds();
  const workLocation = await resolvePrimaryWorkLocation(employee.id);

  const scheduleRows = (await db.shiftAssignment.findMany({
    where: { employeeId: employee.id },
    include: {
      shift: {
        select: {
          name: true,
          startTime: true,
          endTime: true,
          graceLateMinutes: true,
          graceEarlyLeaveMinutes: true,
          crossesMidnight: true,
        },
      },
      schedulePeriod: {
        select: {
          id: true,
          name: true,
          periodStart: true,
          periodEnd: true,
          status: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: [{ workDate: "asc" }, { sequenceNo: "asc" }],
    take: 400,
  })) as SelfAttendanceAssignment[];

  const visibleStatuses = new Set(["PUBLISHED", "LOCKED"]);
  const visible = scheduleRows.filter((row) =>
    visibleStatuses.has(row.schedulePeriod.status.code),
  );
  const currentPeriod = pickCurrentSchedulePeriod(visible, today);
  const periodAssignments = currentPeriod
    ? visible.filter((row) => row.schedulePeriod.id === currentPeriod.id)
    : [];

  // No published schedule — keep a today-only row when the employee clocked.
  if (!currentPeriod || periodAssignments.length === 0) {
    const { start, end, day } = bangkokDayBounds();
    const workDate = date(day);
    const [dayRow, events, assignment] = await Promise.all([
      db.attendanceDay.findUnique({
        where: {
          employeeId_workDate: { employeeId: employee.id, workDate },
        },
      }),
      db.attendanceEvent.findMany({
        where: {
          employeeId: employee.id,
          occurredAt: { gte: start, lte: end },
        },
        include: { eventType: { select: { code: true } } },
        orderBy: { occurredAt: "asc" },
      }),
      db.shiftAssignment.findFirst({
        where: { employeeId: employee.id, workDate },
        include: { shift: true },
        orderBy: { sequenceNo: "asc" },
      }),
    ]);

    const clockInFromEvents =
      events.find(
        (row: { eventType: { code: string } }) =>
          row.eventType.code === "CLOCK_IN",
      )?.occurredAt ?? null;
    const clockOutFromEvents =
      [...events]
        .reverse()
        .find(
          (row: { eventType: { code: string } }) =>
            row.eventType.code === "CLOCK_OUT",
        )?.occurredAt ?? null;
    const clockInAt = dayRow?.clockInAt ?? clockInFromEvents;
    const clockOutAt = dayRow?.clockOutAt ?? clockOutFromEvents;
    const computed = computeLateEarlyMinutes({
      workDate: day,
      clockInAt,
      clockOutAt,
      startTime: assignment?.shift?.startTime ?? null,
      endTime: assignment?.shift?.endTime ?? null,
      graceLateMinutes: assignment?.shift?.graceLateMinutes ?? 0,
      graceEarlyLeaveMinutes: assignment?.shift?.graceEarlyLeaveMinutes ?? 0,
      crossesMidnight: assignment?.shift?.crossesMidnight ?? false,
    });
    const lateMinutes =
      dayRow?.lateMinutes && dayRow.lateMinutes > 0
        ? dayRow.lateMinutes
        : computed.lateMinutes;
    const earlyLeaveMinutes =
      dayRow?.earlyLeaveMinutes && dayRow.earlyLeaveMinutes > 0
        ? dayRow.earlyLeaveMinutes
        : computed.earlyLeaveMinutes;

    const plannedClockIn = formatShiftClock(assignment?.shift?.startTime);
    const plannedClockOut = formatShiftClock(assignment?.shift?.endTime);
    return {
      workDate: day,
      workLocation: serializeWorkLocation(workLocation),
      schedulePeriod: null,
      days:
        clockInAt || clockOutAt
          ? [
              {
                id: dayRow?.id ?? `today-${day}`,
                workDate: day,
                dutyLabel: assignment?.shift?.name ?? "—",
                isRestDay: Boolean(assignment?.isRestDay),
                isLeaveDay: Boolean(assignment?.isLeaveDay),
                plannedClockIn,
                plannedClockOut,
                crossesMidnight: assignment?.shift?.crossesMidnight ?? false,
                clockInAt: clockInAt ? clockInAt.toISOString() : null,
                clockOutAt: clockOutAt ? clockOutAt.toISOString() : null,
                lateMinutes,
                earlyLeaveMinutes,
                lateLabel: formatMinutesLabel(lateMinutes),
                earlyLeaveLabel: formatMinutesLabel(earlyLeaveMinutes),
              },
            ]
          : [],
    };
  }

  const workDateIsos = [
    ...new Set(
      periodAssignments.map((row) => row.workDate.toISOString().slice(0, 10)),
    ),
  ].sort();
  const firstDay = workDateIsos[0]!;
  const lastDay = workDateIsos[workDateIsos.length - 1]!;
  const rangeStart = new Date(`${firstDay}T00:00:00+07:00`);
  const rangeEnd = new Date(`${lastDay}T23:59:59.999+07:00`);
  const dateValues = workDateIsos.map((iso) => date(iso));

  const [dayRows, events] = await Promise.all([
    db.attendanceDay.findMany({
      where: {
        employeeId: employee.id,
        workDate: { in: dateValues },
      },
    }),
    db.attendanceEvent.findMany({
      where: {
        employeeId: employee.id,
        occurredAt: { gte: rangeStart, lte: rangeEnd },
      },
      include: { eventType: { select: { code: true } } },
      orderBy: { occurredAt: "asc" },
    }),
  ]);

  const dayByIso = new Map<
    string,
    {
      id: string;
      clockInAt: Date | null;
      clockOutAt: Date | null;
      lateMinutes: number | null;
      earlyLeaveMinutes: number | null;
      shiftMismatchStatus?: string | null;
    }
  >();
  for (const row of dayRows as Array<{
    id: string;
    workDate: Date;
    clockInAt: Date | null;
    clockOutAt: Date | null;
    lateMinutes: number | null;
    earlyLeaveMinutes: number | null;
    shiftMismatchStatus?: string | null;
  }>) {
    dayByIso.set(row.workDate.toISOString().slice(0, 10), {
      ...row,
      shiftMismatchStatus: row.shiftMismatchStatus ?? null,
    });
  }
  // Fill mismatch flags even if Prisma client predates the column.
  try {
    const mismatchFlags = await db.$queryRaw<
      Array<{ work_date: Date; shift_mismatch_status: string | null }>
    >`
      SELECT work_date, shift_mismatch_status
      FROM hr.attendance_days
      WHERE employee_id = ${employee.id}::uuid
        AND work_date >= ${date(firstDay)}::date
        AND work_date <= ${date(lastDay)}::date
    `;
    for (const flag of mismatchFlags) {
      const iso = flag.work_date.toISOString().slice(0, 10);
      const existing = dayByIso.get(iso);
      if (existing) {
        existing.shiftMismatchStatus = flag.shift_mismatch_status;
      }
    }
  } catch {
    // column not migrated yet
  }

  const eventsByDay = new Map<
    string,
    Array<{ occurredAt: Date; eventType: { code: string } }>
  >();
  for (const event of events as Array<{
    occurredAt: Date;
    eventType: { code: string };
  }>) {
    const iso = bangkokDayBounds(event.occurredAt).day;
    const list = eventsByDay.get(iso) ?? [];
    list.push(event);
    eventsByDay.set(iso, list);
  }

  // One row per schedule day (first assignment that day), same order as ตารางงาน.
  const seenDates = new Set<string>();
  const days = [];
  for (const assignment of periodAssignments) {
    const workDateIso = assignment.workDate.toISOString().slice(0, 10);
    if (seenDates.has(workDateIso)) continue;
    seenDates.add(workDateIso);

    const dayRow = dayByIso.get(workDateIso) ?? null;
    const dayEvents = eventsByDay.get(workDateIso) ?? [];
    const clockInFromEvents =
      dayEvents.find((row) => row.eventType.code === "CLOCK_IN")?.occurredAt ??
      null;
    const clockOutFromEvents =
      [...dayEvents]
        .reverse()
        .find((row) => row.eventType.code === "CLOCK_OUT")?.occurredAt ?? null;
    const clockInAt = dayRow?.clockInAt ?? clockInFromEvents;
    const clockOutAt = dayRow?.clockOutAt ?? clockOutFromEvents;

    let dutyLabel = assignment.shift?.name ?? "—";
    if (assignment.isRestDay) dutyLabel = "วันหยุด";
    else if (assignment.isLeaveDay) dutyLabel = "ลา";

    const computed =
      assignment.isRestDay || assignment.isLeaveDay
        ? { lateMinutes: 0, earlyLeaveMinutes: 0 }
        : computeLateEarlyMinutes({
            workDate: workDateIso,
            clockInAt,
            clockOutAt,
            startTime: assignment.shift?.startTime ?? null,
            endTime: assignment.shift?.endTime ?? null,
            graceLateMinutes: assignment.shift?.graceLateMinutes ?? 0,
            graceEarlyLeaveMinutes:
              assignment.shift?.graceEarlyLeaveMinutes ?? 0,
            crossesMidnight: assignment.shift?.crossesMidnight ?? false,
          });

    const lateMinutes =
      dayRow?.lateMinutes && dayRow.lateMinutes > 0
        ? dayRow.lateMinutes
        : computed.lateMinutes;
    const earlyLeaveMinutes =
      dayRow?.earlyLeaveMinutes && dayRow.earlyLeaveMinutes > 0
        ? dayRow.earlyLeaveMinutes
        : computed.earlyLeaveMinutes;

    days.push({
      id: dayRow?.id ?? `schedule-${workDateIso}`,
      workDate: workDateIso,
      dutyLabel,
      isRestDay: assignment.isRestDay,
      isLeaveDay: assignment.isLeaveDay,
      plannedClockIn: formatShiftClock(assignment.shift?.startTime),
      plannedClockOut: formatShiftClock(assignment.shift?.endTime),
      crossesMidnight: assignment.shift?.crossesMidnight ?? false,
      shiftMismatchStatus:
        (dayRow as { shiftMismatchStatus?: string | null } | null)
          ?.shiftMismatchStatus ?? null,
      clockInAt: clockInAt ? clockInAt.toISOString() : null,
      clockOutAt: clockOutAt ? clockOutAt.toISOString() : null,
      lateMinutes,
      earlyLeaveMinutes,
      lateLabel:
        assignment.isRestDay || assignment.isLeaveDay
          ? "—"
          : formatMinutesLabel(lateMinutes),
      earlyLeaveLabel:
        assignment.isRestDay || assignment.isLeaveDay
          ? "—"
          : formatMinutesLabel(earlyLeaveMinutes),
    });
  }

  const now = new Date();
  const mismatchHint = await resolveClockShiftMismatch(
    employee.id,
    today,
    now,
  );

  return {
    workDate: today,
    workLocation: serializeWorkLocation(workLocation),
    schedulePeriod: {
      id: currentPeriod.id,
      name: currentPeriod.name,
      periodStart: currentPeriod.periodStart.toISOString().slice(0, 10),
      periodEnd: currentPeriod.periodEnd.toISOString().slice(0, 10),
      statusCode: currentPeriod.status.code,
      statusName: currentPeriod.status.name,
    },
    shiftMismatchHint: mismatchHint.isMismatch
      ? {
          assignedShift: serializeShiftHint(mismatchHint.assigned),
          suggestedShift: serializeShiftHint(mismatchHint.suggested),
        }
      : null,
    days,
  };
}

function photoError(code: string): HrError {
  if (code === "PHOTO_TOO_LARGE") {
    return new HrError("VALIDATION_ERROR", {
      message: "ไฟล์รูปใหญ่เกิน 2.5 MB",
    });
  }
  if (code === "UNSUPPORTED_PHOTO_TYPE") {
    return new HrError("VALIDATION_ERROR", {
      message: "รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ GIF",
    });
  }
  if (code === "EMPTY_PHOTO") {
    return new HrError("VALIDATION_ERROR", {
      message: "ต้องถ่ายรูปหลักฐานตอนลงเวลา",
    });
  }
  return new HrError("VALIDATION_ERROR", { message: "อัปโหลดรูปหลักฐานไม่สำเร็จ" });
}

function serializeShiftHint(shift: ShiftClockParts | null) {
  if (!shift) return null;
  return {
    id: shift.id,
    name: shift.name,
    startTime: formatShiftHm(shift.startTime),
    endTime: formatShiftHm(shift.endTime),
    crossesMidnight: Boolean(shift.crossesMidnight),
  };
}

async function createShiftMismatchRequestRow(data: {
  organizationId: string;
  employeeId: string;
  workDate: Date;
  schedulePeriodId: string;
  fromShiftId: string;
  toShiftId: string;
  attendanceDayId: string | null;
  attendanceEventId: string | null;
  reason: string;
  statusId: string;
  requestedByAuthUserId: string;
}) {
  if (db.shiftMismatchRequest?.create) {
    return db.shiftMismatchRequest.create({ data });
  }
  // Fallback before prisma generate picks up the new model.
  await db.$executeRaw`
    INSERT INTO hr.shift_mismatch_requests (
      id, organization_id, employee_id, work_date, schedule_period_id,
      from_shift_id, to_shift_id, attendance_day_id, attendance_event_id,
      reason, status_id, requested_by_auth_user_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      ${data.organizationId}::uuid,
      ${data.employeeId}::uuid,
      ${data.workDate}::date,
      ${data.schedulePeriodId}::uuid,
      ${data.fromShiftId}::uuid,
      ${data.toShiftId}::uuid,
      ${data.attendanceDayId}::uuid,
      ${data.attendanceEventId}::uuid,
      ${data.reason},
      ${data.statusId}::uuid,
      ${data.requestedByAuthUserId}::uuid,
      NOW(), NOW()
    )
  `;
  return null;
}

async function hasPendingShiftMismatch(
  organizationId: string,
  employeeId: string,
  workDate: Date,
): Promise<boolean> {
  if (db.shiftMismatchRequest?.findFirst) {
    const row = await db.shiftMismatchRequest.findFirst({
      where: {
        organizationId,
        employeeId,
        workDate,
        status: { code: "SUBMITTED" },
      },
      select: { id: true },
    });
    return Boolean(row);
  }
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT r.id::text AS id
    FROM hr.shift_mismatch_requests r
    JOIN hr.leave_request_statuses s ON s.id = r.status_id
    WHERE r.organization_id = ${organizationId}::uuid
      AND r.employee_id = ${employeeId}::uuid
      AND r.work_date = ${workDate}::date
      AND s.code = 'SUBMITTED'
    LIMIT 1
  `;
  return rows.length > 0;
}

async function resolveClockShiftMismatch(
  employeeId: string,
  workDateIso: string,
  occurredAt: Date,
) {
  const workDate = date(workDateIso);
  const assignment = await db.shiftAssignment.findFirst({
    where: { employeeId, workDate },
    include: {
      shift: {
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
          crossesMidnight: true,
        },
      },
    },
    orderBy: { sequenceNo: "asc" },
  });
  if (
    !assignment?.shift ||
    assignment.isRestDay ||
    assignment.isLeaveDay
  ) {
    return {
      isMismatch: false,
      assigned: null as ShiftClockParts | null,
      suggested: null as ShiftClockParts | null,
      schedulePeriodId: null as string | null,
    };
  }

  const periodLinks = (await loadPeriodShiftRows(
    assignment.schedulePeriodId,
  ).catch(() => [])) as Array<{
    shift?: {
      id: string;
      name: string;
      startTime: Date;
      endTime: Date;
      crossesMidnight?: boolean;
      isActive?: boolean;
    };
  }>;

  const candidates: ShiftClockParts[] = [];
  const seen = new Set<string>();
  const pushShift = (shift: ShiftClockParts) => {
    if (seen.has(shift.id)) return;
    seen.add(shift.id);
    candidates.push(shift);
  };
  pushShift(assignment.shift);
  for (const link of periodLinks) {
    if (!link.shift || link.shift.isActive === false) continue;
    pushShift(link.shift);
  }

  const evaluated = evaluateShiftMismatch({
    workDate: workDateIso,
    occurredAt,
    assigned: assignment.shift,
    candidates,
  });

  return {
    ...evaluated,
    schedulePeriodId: assignment.schedulePeriodId as string,
  };
}

export async function clock(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, HR_PERMISSIONS.attendanceSelf);
  const employee = await db.employee.findFirst({ where: { organizationId: ctx.organizationId, platformUserId: input.platformUserId ?? undefined, authUserId: actor(ctx) ?? undefined } });
  if (!employee) throw new HrError("NOT_FOUND", { message: "ไม่พบข้อมูลพนักงานที่เชื่อมต่อ" });
  if (input.latitude == null || input.longitude == null) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ต้องส่งตำแหน่ง GPS ตอนลงเวลา",
    });
  }

  const photoBuffer = decodePhotoBase64(input.photoBase64 ?? input.photo);
  if (!photoBuffer) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ต้องถ่ายรูปหลักฐานตอนลงเวลา",
    });
  }

  const idempotencyKey =
    typeof input.idempotencyKey === "string" && input.idempotencyKey.trim().length >= 8
      ? input.idempotencyKey.trim()
      : crypto.randomUUID();
  const existing = await db.attendanceEvent.findFirst({
    where: { employeeId: employee.id, idempotencyKey },
  });
  if (existing) {
    const meta = (existing.metadata ?? {}) as { photoUrl?: string };
    return {
      ...existing,
      photoUrl: meta.photoUrl ?? attendanceEventPhotoPublicPath(existing.id),
    };
  }

  const location = input.workLocationId
    ? await owned("workLocation", ctx, input.workLocationId)
    : await resolvePrimaryWorkLocation(employee.id);
  if (!location) {
    throw new HrError("NOT_FOUND", {
      message: "ยังไม่ได้กำหนดสถานที่ลงเวลาให้พนักงานคนนี้",
    });
  }
  if (location.latitude == null || location.longitude == null) {
    throw new HrError("VALIDATION_ERROR", {
      message: "สถานที่ลงเวลายังไม่มีพิกัด GPS",
    });
  }

  const check = insideGeofence(
    {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
    },
    {
      latitude: Number(input.latitude),
      longitude: Number(input.longitude),
      accuracyMeters:
        input.accuracyMeters == null ? undefined : Number(input.accuracyMeters),
    },
    Number(location.geofenceRadiusMeters),
  );
  const distance = check.distanceMeters;
  if (!check.accepted) {
    const reason =
      check.reason === "ACCURACY_TOO_LOW"
        ? "ความแม่นยำของ GPS ต่ำเกินไป"
        : `อยู่นอกพื้นที่ลงเวลา (ห่างประมาณ ${Math.round(distance)} ม. จากรัศมี ${location.geofenceRadiusMeters} ม.)`;
    throw new HrError("FORBIDDEN", {
      message: reason,
      details: {
        reason: check.reason,
        distanceMeters: Math.round(distance),
        radiusMeters: location.geofenceRadiusMeters,
        workLocationId: location.id,
      },
    });
  }

  const type = await master("attendanceEventType", input.action === "clockOut" ? "CLOCK_OUT" : input.action === "breakStart" ? "BREAK_START" : input.action === "breakEnd" ? "BREAK_END" : "CLOCK_IN");
  const occurredAt = new Date();
  const { day, start, end } = bangkokDayBounds(occurredAt);
  const workDate = date(day);
  const priorDay = await db.attendanceDay.findUnique({
    where: { employeeId_workDate: { employeeId: employee.id, workDate } },
  });
  const dayEvents = await db.attendanceEvent.findMany({
    where: {
      employeeId: employee.id,
      occurredAt: { gte: start, lte: end },
    },
    include: { eventType: { select: { code: true } } },
    orderBy: { occurredAt: "asc" },
  });
  const hasClockInToday =
    Boolean(priorDay?.clockInAt) ||
    dayEvents.some((row) => row.eventType.code === "CLOCK_IN");
  const hasClockOutToday =
    Boolean(priorDay?.clockOutAt) ||
    dayEvents.some((row) => row.eventType.code === "CLOCK_OUT");

  if (type.code === "CLOCK_IN" && hasClockInToday) {
    throw new HrError("VALIDATION_ERROR", {
      message: "วันนี้ลงเวลาเข้างานแล้ว ไม่สามารถลงซ้ำได้",
    });
  }
  if (type.code === "CLOCK_OUT" && !hasClockInToday) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ยังไม่ได้ลงเวลาเข้างาน จึงยังออกงานไม่ได้",
    });
  }
  if (type.code === "CLOCK_OUT" && hasClockOutToday) {
    throw new HrError("VALIDATION_ERROR", {
      message: "วันนี้ลงเวลาออกงานแล้ว ไม่สามารถลงซ้ำได้",
    });
  }

  let mismatchForRequest: {
    schedulePeriodId: string;
    fromShiftId: string;
    toShiftId: string;
    assignedName: string;
    suggestedName: string;
  } | null = null;
  if (type.code === "CLOCK_IN") {
    const mismatch = await resolveClockShiftMismatch(
      employee.id,
      day,
      occurredAt,
    );
    if (mismatch.isMismatch && mismatch.assigned && mismatch.schedulePeriodId) {
      const confirmed =
        input.confirmShiftMismatch === true ||
        input.confirmShiftMismatch === "true";
      const requestedShiftId =
        typeof input.requestedShiftId === "string"
          ? input.requestedShiftId.trim()
          : "";
      const toShiftId = requestedShiftId || mismatch.suggested?.id || "";
      if (!confirmed) {
        throw new HrError("VALIDATION_ERROR", {
          message:
            "เวลาเข้างานไม่ตรงกับกะที่ถูกจัด — กรุณายืนยันเพื่อลงเวลาและขออนุมัติย้ายกะ",
          details: {
            code: "SHIFT_MISMATCH",
            assignedShift: serializeShiftHint(mismatch.assigned),
            suggestedShift: serializeShiftHint(mismatch.suggested),
          },
        });
      }
      if (!toShiftId) {
        throw new HrError("VALIDATION_ERROR", {
          message: "ไม่พบกะที่แนะนำสำหรับเวลานี้ — ติดต่อหัวหน้าเพื่อจัดกะก่อน",
          details: {
            code: "SHIFT_MISMATCH_NO_SUGGESTION",
            assignedShift: serializeShiftHint(mismatch.assigned),
          },
        });
      }
      const toShift = await db.shift.findFirst({
        where: { id: toShiftId, organizationId: ctx.organizationId },
        select: { id: true, name: true },
      });
      if (!toShift) {
        throw new HrError("NOT_FOUND", { message: "ไม่พบกะที่ขอเปลี่ยน" });
      }
      mismatchForRequest = {
        schedulePeriodId: mismatch.schedulePeriodId,
        fromShiftId: mismatch.assigned.id,
        toShiftId: toShift.id,
        assignedName: mismatch.assigned.name,
        suggestedName: toShift.name,
      };
    }
  }

  const created = await db.attendanceEvent.create({ data: { organizationId: ctx.organizationId, branchId: employee.branchId, employeeId: employee.id, eventTypeId: type.id, occurredAt, latitude: input.latitude ?? null, longitude: input.longitude ?? null, workLocationId: location.id, geofenceDistanceMeters: distance, idempotencyKey, source: "WEB" } });

  let photoUrl = attendanceEventPhotoPublicPath(created.id);
  try {
    const saved = await saveAttendancePhoto({
      organizationId: ctx.organizationId,
      eventId: created.id,
      buffer: photoBuffer,
    });
    photoUrl = saved.photoUrl;
    await db.attendanceEvent.update({
      where: { id: created.id },
      data: {
        metadata: {
          photoUrl: saved.photoUrl,
          photoBytes: saved.bytes,
          photoContentType: saved.contentType,
        },
      },
    });
  } catch (err) {
    await db.attendanceEvent.delete({ where: { id: created.id } }).catch(() => {});
    const code = err instanceof Error ? err.message : "PHOTO_ERROR";
    throw photoError(code);
  }

  // Keep AttendanceDay in sync so self-service / reports can show the day row.
  const status = await master(
    "attendanceStatus",
    type.code === "CLOCK_OUT" ? "PRESENT" : "INCOMPLETE",
  );
  const prior = priorDay;
  const nextClockIn =
    type.code === "CLOCK_IN" ? (prior?.clockInAt ?? occurredAt) : prior?.clockInAt ?? null;
  const nextClockOut =
    type.code === "CLOCK_OUT" ? occurredAt : prior?.clockOutAt ?? null;
  const assignment = await db.shiftAssignment.findFirst({
    where: { employeeId: employee.id, workDate },
    include: { shift: true },
    orderBy: { sequenceNo: "asc" },
  });
  const metrics = computeLateEarlyMinutes({
    workDate: day,
    clockInAt: nextClockIn,
    clockOutAt: nextClockOut,
    startTime: assignment?.shift?.startTime ?? null,
    endTime: assignment?.shift?.endTime ?? null,
    graceLateMinutes: assignment?.shift?.graceLateMinutes ?? 0,
    graceEarlyLeaveMinutes: assignment?.shift?.graceEarlyLeaveMinutes ?? 0,
    crossesMidnight: assignment?.shift?.crossesMidnight ?? false,
  });
  const dayRow = await db.attendanceDay.upsert({
    where: { employeeId_workDate: { employeeId: employee.id, workDate } },
    create: {
      organizationId: ctx.organizationId,
      branchId: employee.branchId,
      employeeId: employee.id,
      workDate,
      statusId: status.id,
      clockInAt: type.code === "CLOCK_IN" ? occurredAt : null,
      clockOutAt: type.code === "CLOCK_OUT" ? occurredAt : null,
      lateMinutes: metrics.lateMinutes,
      earlyLeaveMinutes: metrics.earlyLeaveMinutes,
    },
    update: {
      statusId: status.id,
      ...(type.code === "CLOCK_IN"
        ? { clockInAt: prior?.clockInAt ?? occurredAt }
        : {}),
      ...(type.code === "CLOCK_OUT" ? { clockOutAt: occurredAt } : {}),
      lateMinutes: metrics.lateMinutes,
      earlyLeaveMinutes: metrics.earlyLeaveMinutes,
    },
  });

  if (mismatchForRequest) {
    await db.$executeRaw`
      UPDATE hr.attendance_days
      SET shift_mismatch_status = 'PENDING', updated_at = NOW()
      WHERE id = ${dayRow.id}::uuid
    `.catch(() => undefined);
  }

  if (mismatchForRequest && actor(ctx)) {
    const submitted = await master("leaveRequestStatus", "SUBMITTED");
    const existingPending = await hasPendingShiftMismatch(
      ctx.organizationId,
      employee.id,
      workDate,
    );
    if (!existingPending) {
      await createShiftMismatchRequestRow({
        organizationId: ctx.organizationId,
        employeeId: employee.id,
        workDate,
        schedulePeriodId: mismatchForRequest.schedulePeriodId,
        fromShiftId: mismatchForRequest.fromShiftId,
        toShiftId: mismatchForRequest.toShiftId,
        attendanceDayId: dayRow.id,
        attendanceEventId: created.id,
        reason: `ลงเวลาผิดกะ — จาก${mismatchForRequest.assignedName} เป็น${mismatchForRequest.suggestedName}`,
        statusId: submitted.id,
        requestedByAuthUserId: actor(ctx)!,
      });
    }
  }

  return {
    ...created,
    photoUrl,
    shiftMismatchPending: Boolean(mismatchForRequest),
  };
}

export async function listAttendanceDays(ctx: HrServiceContext, input: any = {}) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.attendanceRead,
    HR_PERMISSIONS.attendanceManage,
  ]);

  const { day: today } = bangkokDayBounds();
  const workDateIso = String(input.workDate || input.from || today).slice(0, 10);
  const workDate = date(workDateIso);
  const branchFilter =
    ctx.allowedBranchIds == null
      ? {}
      : { branchId: { in: [...ctx.allowedBranchIds] } };

  const rows = await db.attendanceDay.findMany({
    where: {
      organizationId: ctx.organizationId,
      workDate,
      ...branchFilter,
      ...(input.employeeId ? { employeeId: input.employeeId } : {}),
    },
    include: {
      employee: {
        select: {
          id: true,
          firstNameTh: true,
          lastNameTh: true,
          photoUrl: true,
        },
      },
      status: { select: { code: true, name: true } },
    },
    orderBy: [
      { employee: { firstNameTh: "asc" } },
      { employee: { lastNameTh: "asc" } },
    ],
  });

  const { start, end } = (() => {
    return {
      start: new Date(`${workDateIso}T00:00:00+07:00`),
      end: new Date(`${workDateIso}T23:59:59.999+07:00`),
    };
  })();

  const employeeIds = rows.map(
    (row: { employeeId: string }) => row.employeeId,
  );
  const events =
    employeeIds.length === 0
      ? []
      : await db.attendanceEvent.findMany({
          where: {
            organizationId: ctx.organizationId,
            employeeId: { in: employeeIds },
            occurredAt: { gte: start, lte: end },
          },
          include: { eventType: { select: { code: true } } },
          orderBy: { occurredAt: "asc" },
        });

  const photoByEmployee = new Map<
    string,
    { clockInPhotoUrl: string | null; clockOutPhotoUrl: string | null }
  >();
  for (const event of events as Array<{
    employeeId: string;
    id: string;
    metadata: unknown;
    eventType: { code: string };
  }>) {
    const meta = (event.metadata ?? {}) as { photoUrl?: string };
    const url = meta.photoUrl ?? attendanceEventPhotoPublicPath(event.id);
    const bucket = photoByEmployee.get(event.employeeId) ?? {
      clockInPhotoUrl: null,
      clockOutPhotoUrl: null,
    };
    if (event.eventType.code === "CLOCK_IN" && !bucket.clockInPhotoUrl) {
      bucket.clockInPhotoUrl = url;
    }
    if (event.eventType.code === "CLOCK_OUT") {
      bucket.clockOutPhotoUrl = url;
    }
    photoByEmployee.set(event.employeeId, bucket);
  }

  return {
    workDate: workDateIso,
    rows: rows.map(
      (row: {
        id: string;
        employeeId: string;
        clockInAt: Date | null;
        clockOutAt: Date | null;
        lateMinutes: number;
        earlyLeaveMinutes: number;
        shiftMismatchStatus?: string | null;
        employee: {
          firstNameTh: string;
          lastNameTh: string;
          photoUrl: string | null;
        };
        status: { code: string; name: string };
      }) => {
        const photos = photoByEmployee.get(row.employeeId) ?? {
          clockInPhotoUrl: null,
          clockOutPhotoUrl: null,
        };
        const displayName =
          `${row.employee.firstNameTh} ${row.employee.lastNameTh}`.trim();
        return {
          id: row.id,
          employeeId: row.employeeId,
          displayName,
          photoUrl: row.employee.photoUrl,
          statusCode: row.status.code,
          statusName: row.status.name,
          shiftMismatchStatus: row.shiftMismatchStatus ?? null,
          clockInAt: row.clockInAt ? row.clockInAt.toISOString() : null,
          clockOutAt: row.clockOutAt ? row.clockOutAt.toISOString() : null,
          lateMinutes: row.lateMinutes,
          earlyLeaveMinutes: row.earlyLeaveMinutes,
          lateLabel: formatMinutesLabel(row.lateMinutes),
          earlyLeaveLabel: formatMinutesLabel(row.earlyLeaveMinutes),
          clockInPhotoUrl: photos.clockInPhotoUrl,
          clockOutPhotoUrl: photos.clockOutPhotoUrl,
        };
      },
    ),
  };
}
const adjustmentEmployeeSelect = {
  id: true,
  displayName: true,
  employeeCode: true,
  photoUrl: true,
  branchId: true,
  authUserId: true,
} as const;

async function applyAttendanceAdjustmentToDay(
  ctx: HrServiceContext,
  row: {
    employeeId: string;
    workDate: Date;
    requestedClockInAt: Date | null;
    requestedClockOutAt: Date | null;
    attendanceDayId: string | null;
    reason: string;
  },
) {
  const workDate = row.workDate;
  const workDateIso = isoDateOnly(workDate);
  const employee = await db.employee.findFirst({
    where: { id: row.employeeId, organizationId: ctx.organizationId },
    select: { id: true, branchId: true },
  });
  if (!employee) throw new HrError("NOT_FOUND");

  const existing =
    (row.attendanceDayId
      ? await db.attendanceDay.findFirst({
          where: { id: row.attendanceDayId, organizationId: ctx.organizationId },
        })
      : null) ??
    (await db.attendanceDay.findUnique({
      where: {
        employeeId_workDate: { employeeId: employee.id, workDate },
      },
    }));
  if (existing?.isLocked) {
    throw new HrError("PERIOD_LOCKED", {
      message: "วันลงเวลานี้ถูกล็อกแล้ว แก้ไขไม่ได้",
    });
  }

  const nextClockIn = row.requestedClockInAt ?? existing?.clockInAt ?? null;
  const nextClockOut = row.requestedClockOutAt ?? existing?.clockOutAt ?? null;
  const assignment = await db.shiftAssignment.findFirst({
    where: { employeeId: employee.id, workDate },
    include: { shift: true },
    orderBy: { sequenceNo: "asc" },
  });
  const metrics = computeLateEarlyMinutes({
    workDate: workDateIso,
    clockInAt: nextClockIn,
    clockOutAt: nextClockOut,
    startTime: assignment?.shift?.startTime ?? null,
    endTime: assignment?.shift?.endTime ?? null,
    graceLateMinutes: assignment?.shift?.graceLateMinutes ?? 0,
    graceEarlyLeaveMinutes: assignment?.shift?.graceEarlyLeaveMinutes ?? 0,
    crossesMidnight: assignment?.shift?.crossesMidnight ?? false,
  });
  const status = await master(
    "attendanceStatus",
    nextClockIn && nextClockOut
      ? metrics.lateMinutes > 0
        ? "LATE"
        : "PRESENT"
      : nextClockIn
        ? "INCOMPLETE"
        : "ABSENT",
  );
  const workedMinutes =
    nextClockIn && nextClockOut
      ? Math.max(
          0,
          Math.round((nextClockOut.getTime() - nextClockIn.getTime()) / 60_000),
        )
      : 0;

  await db.attendanceDay.upsert({
    where: { employeeId_workDate: { employeeId: employee.id, workDate } },
    create: {
      organizationId: ctx.organizationId,
      branchId: employee.branchId,
      employeeId: employee.id,
      workDate,
      statusId: status.id,
      shiftAssignmentId: assignment?.id ?? null,
      clockInAt: nextClockIn,
      clockOutAt: nextClockOut,
      lateMinutes: metrics.lateMinutes,
      earlyLeaveMinutes: metrics.earlyLeaveMinutes,
      workedMinutes,
      notes: `ปรับเวลา: ${row.reason}`,
    },
    update: {
      statusId: status.id,
      clockInAt: nextClockIn,
      clockOutAt: nextClockOut,
      lateMinutes: metrics.lateMinutes,
      earlyLeaveMinutes: metrics.earlyLeaveMinutes,
      workedMinutes,
      notes: `ปรับเวลา: ${row.reason}`,
    },
  });
}

function isoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function listAttendanceAdjustments(
  ctx: HrServiceContext,
  input: { status?: string | null; scope?: "self" | "org" | null } = {},
) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.attendanceSelf,
    HR_PERMISSIONS.attendanceRead,
    HR_PERMISSIONS.attendanceManage,
  ]);
  const statusCode = input.status?.trim() || null;
  const canSeeOrg =
    hrCan(ctx, HR_PERMISSIONS.attendanceManage) ||
    hrCan(ctx, HR_PERMISSIONS.attendanceRead);
  const selfOnly = input.scope === "self" || !canSeeOrg;
  const self = selfOnly ? await resolveSelfEmployee(ctx) : null;
  return db.attendanceAdjustment.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(self
        ? { employeeId: self.id }
        : employeeBranchScopeWhere(ctx)),
      ...(statusCode ? { status: { code: statusCode } } : {}),
    },
    include: {
      employee: { select: adjustmentEmployeeSelect },
      status: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function createAttendanceAdjustment(
  ctx: HrServiceContext,
  input: any,
) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.attendanceSelf,
    HR_PERMISSIONS.attendanceManage,
  ]);
  const canManage = hrCan(ctx, HR_PERMISSIONS.attendanceManage);
  let employeeId =
    typeof input.employeeId === "string" ? input.employeeId.trim() : "";
  if (!employeeId || !canManage) {
    employeeId = (await resolveSelfEmployee(ctx)).id;
  } else {
    await owned("employee", ctx, employeeId);
  }

  const workDate = requireIsoDate(input.workDate, "วันที่ทำงาน");
  const reason = String(input.reason ?? "").trim();
  if (reason.length < 2) {
    throw new HrError("VALIDATION_ERROR", {
      message: "กรุณาระบุเหตุผลอย่างน้อย 2 ตัวอักษร",
    });
  }
  const requestedClockInAt = input.requestedClockInAt
    ? requireDateTime(input.requestedClockInAt, "เวลาเข้าที่ขอ")
    : null;
  const requestedClockOutAt = input.requestedClockOutAt
    ? requireDateTime(input.requestedClockOutAt, "เวลาออกที่ขอ")
    : null;
  if (!requestedClockInAt && !requestedClockOutAt) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ต้องระบุเวลาเข้า หรือเวลาออกอย่างน้อยหนึ่งค่า",
    });
  }
  if (
    requestedClockInAt &&
    requestedClockOutAt &&
    requestedClockOutAt.getTime() <= requestedClockInAt.getTime()
  ) {
    throw new HrError("VALIDATION_ERROR", {
      message: "เวลาออกต้องหลังเวลาเข้า",
    });
  }

  const day = await db.attendanceDay.findUnique({
    where: { employeeId_workDate: { employeeId, workDate } },
  });
  if (day?.isLocked) {
    throw new HrError("PERIOD_LOCKED", {
      message: "วันลงเวลานี้ถูกล็อกแล้ว ขอปรับปรุงไม่ได้",
    });
  }

  const pending = await db.attendanceAdjustment.findFirst({
    where: {
      organizationId: ctx.organizationId,
      employeeId,
      workDate,
      status: { code: "SUBMITTED" },
    },
  });
  if (pending) {
    throw new HrError("VALIDATION_ERROR", {
      message: "มีคำขอปรับปรุงเวลารออนุมัติของวันนี้แล้ว",
    });
  }

  const submitted = await master("leaveRequestStatus", "SUBMITTED");
  return db.attendanceAdjustment.create({
    data: {
      organizationId: ctx.organizationId,
      employeeId,
      attendanceDayId: day?.id ?? null,
      workDate,
      requestedClockInAt,
      requestedClockOutAt,
      reason,
      statusId: submitted.id,
      requestedByAuthUserId: actor(ctx)!,
    },
    include: {
      employee: { select: adjustmentEmployeeSelect },
      status: { select: { id: true, code: true, name: true } },
    },
  });
}

export async function reviewAttendanceAdjustment(
  ctx: HrServiceContext,
  id: string,
  approve: boolean,
  note?: string,
) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.attendanceManage,
    HR_PERMISSIONS.approvalManage,
  ]);
  const row = await db.attendanceAdjustment.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      employee: { select: { authUserId: true, branchId: true } },
      status: { select: { code: true } },
    },
  });
  if (!row) throw new HrError("NOT_FOUND");
  if (row.status?.code !== "SUBMITTED") {
    throw new HrError("INVALID_STATUS_TRANSITION", {
      message: "คำขอนี้ไม่อยู่ในสถานะรออนุมัติ",
    });
  }
  assertBranchInScope(ctx, row.employee?.branchId);
  assertNoSelfApproval(row.employee?.authUserId, actor(ctx)!);

  if (approve) {
    await applyAttendanceAdjustmentToDay(ctx, row);
  }

  const status = await master(
    "leaveRequestStatus",
    approve ? "APPROVED" : "REJECTED",
  );
  const reviewedByName = await resolveActorDisplayName(ctx);
  const updated = await db.attendanceAdjustment.update({
    where: { id },
    data: {
      statusId: status.id,
      reviewedAt: new Date(),
      reviewedByAuthUserId: actor(ctx),
      reviewNote: note?.trim() || null,
    },
    include: {
      employee: { select: adjustmentEmployeeSelect },
      status: { select: { id: true, code: true, name: true } },
    },
  });
  await stampReviewedByName("attendance_adjustments", id, reviewedByName);
  return { ...updated, reviewedByName };
}

const leaveEmployeeSelect = {
  id: true,
  displayName: true,
  employeeCode: true,
  photoUrl: true,
  branchId: true,
  firstNameTh: true,
  lastNameTh: true,
} as const;

async function enrichLeaveRowsWithShifts<
  T extends {
    id: string;
    employeeId: string;
    startDate: Date;
    endDate: Date;
  },
>(rows: T[]) {
  if (rows.length === 0) {
    return rows.map((row) => ({ ...row, scheduledShifts: [] as Array<{
      shiftId: string | null;
      shiftName: string;
      workDates: string[];
      timeLabel: string | null;
    }> }));
  }

  const employeeIds = [...new Set(rows.map((row) => row.employeeId))];
  let minStart = rows[0]!.startDate;
  let maxEnd = rows[0]!.endDate;
  for (const row of rows) {
    if (row.startDate < minStart) minStart = row.startDate;
    if (row.endDate > maxEnd) maxEnd = row.endDate;
  }

  const assignments = await db.shiftAssignment.findMany({
    where: {
      employeeId: { in: employeeIds },
      workDate: { gte: minStart, lte: maxEnd },
      isRestDay: false,
    },
    include: {
      shift: {
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
          crossesMidnight: true,
        },
      },
    },
    orderBy: [{ workDate: "asc" }, { sequenceNo: "asc" }],
  });

  return rows.map((row) => {
    const inRange = assignments.filter(
      (assignment: {
        employeeId: string;
        workDate: Date;
      }) =>
        assignment.employeeId === row.employeeId &&
        assignment.workDate >= row.startDate &&
        assignment.workDate <= row.endDate,
    );
    const byShift = new Map<
      string,
      {
        shiftId: string | null;
        shiftName: string;
        workDates: string[];
        timeLabel: string | null;
      }
    >();
    for (const assignment of inRange as Array<{
      shiftId: string | null;
      workDate: Date;
      shift: {
        id: string;
        name: string;
        startTime: Date;
        endTime: Date;
        crossesMidnight: boolean;
      } | null;
    }>) {
      const key = assignment.shiftId ?? "none";
      const start = formatShiftClock(assignment.shift?.startTime);
      const end = formatShiftClock(assignment.shift?.endTime);
      const entry = byShift.get(key) ?? {
        shiftId: assignment.shiftId,
        shiftName: assignment.shift?.name ?? "ไม่ระบุกะ",
        workDates: [],
        timeLabel:
          start && end
            ? `${start}–${end}${assignment.shift?.crossesMidnight ? " (+1)" : ""}`
            : null,
      };
      entry.workDates.push(assignment.workDate.toISOString().slice(0, 10));
      byShift.set(key, entry);
    }
    return { ...row, scheduledShifts: [...byShift.values()] };
  });
}

const COVER_NOTE_PREFIX = "ทำงานแทนจากการลา";
const COVER_FROM_SHIFT_RE = /\|fromShift:([0-9a-f-]{36})/i;
const COVER_FROM_PERIOD_RE = /\|fromPeriod:([0-9a-f-]{36})/i;
const COVER_FROM_LOC_RE = /\|fromLoc:([0-9a-f-]{36}|none)/i;
const COVER_FROM_SEQ_RE = /\|fromSeq:(\d+)/i;
const COVER_FROM_REST_RE = /\|fromRest:([01])/i;
const COVER_FROM_LEAVE_RE = /\|fromLeave:([01])/i;
const COVER_FROM_CREATED_RE = /\|fromCreated:1\b/i;

type CoverAssignmentSnapshot = {
  created: boolean;
  shiftId: string | null;
  schedulePeriodId: string | null;
  workLocationId: string | null;
  sequenceNo: number | null;
  isRestDay: boolean;
  isLeaveDay: boolean;
};

/** Stable YYYY-MM-DD for Prisma `@db.Date` values (UTC calendar day). */
function toDateKey(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function encodeCoverNotes(snapshot: CoverAssignmentSnapshot): string {
  if (snapshot.created) {
    return `${COVER_NOTE_PREFIX}|fromCreated:1`;
  }
  const parts = [COVER_NOTE_PREFIX];
  if (snapshot.shiftId) parts.push(`fromShift:${snapshot.shiftId}`);
  if (snapshot.schedulePeriodId) {
    parts.push(`fromPeriod:${snapshot.schedulePeriodId}`);
  }
  parts.push(`fromLoc:${snapshot.workLocationId ?? "none"}`);
  if (snapshot.sequenceNo != null) {
    parts.push(`fromSeq:${snapshot.sequenceNo}`);
  }
  parts.push(`fromRest:${snapshot.isRestDay ? "1" : "0"}`);
  parts.push(`fromLeave:${snapshot.isLeaveDay ? "1" : "0"}`);
  return parts.join("|");
}

function parseCoverFromShiftId(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = COVER_FROM_SHIFT_RE.exec(notes);
  return match?.[1] ?? null;
}

function parseCoverSnapshot(
  notes: string | null | undefined,
): CoverAssignmentSnapshot | null {
  if (!notes || !notes.includes(COVER_NOTE_PREFIX)) return null;
  const created = COVER_FROM_CREATED_RE.test(notes);
  const shiftId = parseCoverFromShiftId(notes);
  const periodMatch = COVER_FROM_PERIOD_RE.exec(notes);
  const locMatch = COVER_FROM_LOC_RE.exec(notes);
  const seqMatch = COVER_FROM_SEQ_RE.exec(notes);
  const restMatch = COVER_FROM_REST_RE.exec(notes);
  const leaveMatch = COVER_FROM_LEAVE_RE.exec(notes);
  return {
    created,
    shiftId,
    schedulePeriodId: periodMatch?.[1] ?? null,
    workLocationId:
      !locMatch || locMatch[1] === "none" ? null : (locMatch[1] ?? null),
    sequenceNo: seqMatch ? Number(seqMatch[1]) : null,
    isRestDay: restMatch?.[1] === "1",
    isLeaveDay: leaveMatch?.[1] === "1",
  };
}

/**
 * Restore previous cover people to their original shifts (as if cover never
 * happened), or delete cover-only rows that were created for the leave.
 */
async function restorePriorCoverAssignments(
  tx: any,
  leave: { employeeId: string; startDate: Date; endDate: Date },
) {
  const prior = await tx.shiftAssignment.findMany({
    where: {
      coversForEmployeeId: leave.employeeId,
      workDate: { gte: leave.startDate, lte: leave.endDate },
    },
  });
  for (const row of prior as Array<{
    id: string;
    notes: string | null;
  }>) {
    const snapshot = parseCoverSnapshot(row.notes);
    const fromShiftId = snapshot?.shiftId ?? parseCoverFromShiftId(row.notes);

    // Cover-only rows created for this leave → remove so the day is blank again.
    if (snapshot?.created || (!fromShiftId && !snapshot?.schedulePeriodId)) {
      await tx.shiftAssignment.delete({ where: { id: row.id } });
      continue;
    }

    await tx.shiftAssignment.update({
      where: { id: row.id },
      data: {
        shiftId: fromShiftId,
        ...(snapshot?.schedulePeriodId
          ? { schedulePeriodId: snapshot.schedulePeriodId }
          : {}),
        ...(snapshot && COVER_FROM_LOC_RE.test(row.notes ?? "")
          ? { workLocationId: snapshot.workLocationId }
          : {}),
        ...(snapshot?.sequenceNo != null
          ? { sequenceNo: snapshot.sequenceNo }
          : {}),
        isRestDay: snapshot?.isRestDay ?? false,
        isLeaveDay: snapshot?.isLeaveDay ?? false,
        coversForEmployeeId: null,
        notes: null,
      },
    });
  }
}

/** Mark leave days and move a cover employee from another shift onto the leave shift. */
async function applyLeaveCoverToSchedule(
  ctx: HrServiceContext,
  leave: {
    id: string;
    employeeId: string;
    startDate: Date;
    endDate: Date;
  },
  coverEmployeeId: string | null,
) {
  if (coverEmployeeId) {
    if (coverEmployeeId === leave.employeeId) {
      throw new HrError("VALIDATION_ERROR", {
        message: "คนทำงานแทนต้องเป็นคนละคนกับผู้ลา",
      });
    }
    await assertLeaveCoverSameBranch(ctx, leave.employeeId, coverEmployeeId);
  }

  const sourceRows = await db.shiftAssignment.findMany({
    where: {
      employeeId: leave.employeeId,
      workDate: { gte: leave.startDate, lte: leave.endDate },
      isRestDay: false,
      shiftId: { not: null },
    },
    orderBy: [{ workDate: "asc" }, { sequenceNo: "asc" }],
  });

  if (coverEmployeeId && sourceRows.length === 0) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ผู้ลาไม่มีกะในช่วงวันลา — ไม่สามารถจัดคนทำงานแทนได้",
    });
  }

  const dateValues = [
    ...new Map(
      (sourceRows as Array<{ workDate: Date }>).map((row) => [
        toDateKey(row.workDate),
        row.workDate,
      ]),
    ).values(),
  ];

  await db.$transaction(async (tx) => {
    await restorePriorCoverAssignments(tx, leave);

    if (sourceRows.length > 0) {
      await tx.shiftAssignment.updateMany({
        where: { id: { in: sourceRows.map((row: { id: string }) => row.id) } },
        data: { isLeaveDay: true },
      });
    }

    if (coverEmployeeId && dateValues.length > 0) {
      const coverRows = await tx.shiftAssignment.findMany({
        where: {
          employeeId: coverEmployeeId,
          workDate: { in: dateValues },
        },
      });
      const coverByDate = new Map<string, (typeof coverRows)[number]>();
      for (const row of coverRows as Array<{
        id: string;
        workDate: Date;
        shiftId: string | null;
        schedulePeriodId: string;
        workLocationId: string | null;
        sequenceNo: number;
        isRestDay: boolean;
        isLeaveDay: boolean;
      }>) {
        coverByDate.set(toDateKey(row.workDate), row);
      }

      for (const source of sourceRows as Array<{
        schedulePeriodId: string;
        shiftId: string | null;
        workDate: Date;
        sequenceNo: number;
        workLocationId: string | null;
      }>) {
        if (!source.shiftId) continue;
        const iso = toDateKey(source.workDate);
        const existing = coverByDate.get(iso) as
          | {
              id: string;
              shiftId: string | null;
              schedulePeriodId: string;
              workLocationId: string | null;
              sequenceNo: number;
              isRestDay: boolean;
              isLeaveDay: boolean;
            }
          | undefined;

        if (existing) {
          if (existing.shiftId && existing.shiftId === source.shiftId) {
            throw new HrError("VALIDATION_ERROR", {
              message:
                "คนทำงานแทนอยู่ในกะเดียวกับผู้ลา — เลือกคนจากกะอื่นเท่านั้น",
            });
          }
          await tx.shiftAssignment.update({
            where: { id: existing.id },
            data: {
              schedulePeriodId: source.schedulePeriodId,
              shiftId: source.shiftId,
              workLocationId: source.workLocationId,
              sequenceNo: source.sequenceNo,
              isRestDay: false,
              isLeaveDay: false,
              coversForEmployeeId: leave.employeeId,
              notes: encodeCoverNotes({
                created: false,
                shiftId: existing.shiftId,
                schedulePeriodId: existing.schedulePeriodId,
                workLocationId: existing.workLocationId,
                sequenceNo: existing.sequenceNo,
                isRestDay: existing.isRestDay,
                isLeaveDay: existing.isLeaveDay,
              }),
            },
          });
        } else {
          await tx.shiftAssignment.create({
            data: {
              schedulePeriodId: source.schedulePeriodId,
              employeeId: coverEmployeeId,
              shiftId: source.shiftId,
              workDate: source.workDate,
              sequenceNo: source.sequenceNo,
              workLocationId: source.workLocationId,
              isRestDay: false,
              isLeaveDay: false,
              coversForEmployeeId: leave.employeeId,
              notes: encodeCoverNotes({
                created: true,
                shiftId: null,
                schedulePeriodId: null,
                workLocationId: null,
                sequenceNo: null,
                isRestDay: false,
                isLeaveDay: false,
              }),
              createdByAuthUserId: actor(ctx),
            },
          });
        }
      }
    }

    await tx.leaveRequest.update({
      where: { id: leave.id },
      data: { coverEmployeeId },
    });
  });

  if (coverEmployeeId && sourceRows.length > 0) {
    const periodShiftPairs = new Set<string>();
    for (const row of sourceRows as Array<{
      schedulePeriodId: string;
      shiftId: string | null;
    }>) {
      if (!row.shiftId) continue;
      periodShiftPairs.add(`${row.schedulePeriodId}:${row.shiftId}`);
    }
    for (const pair of periodShiftPairs) {
      const [schedulePeriodId, shiftId] = pair.split(":");
      if (schedulePeriodId && shiftId) {
        await ensurePeriodShiftLink(schedulePeriodId, shiftId);
      }
    }
  }
}

async function clearLeaveScheduleEffects(
  leave: { employeeId: string; startDate: Date; endDate: Date },
) {
  await db.$transaction(async (tx) => {
    await restorePriorCoverAssignments(tx, leave);
    await tx.shiftAssignment.updateMany({
      where: {
        employeeId: leave.employeeId,
        workDate: { gte: leave.startDate, lte: leave.endDate },
        isLeaveDay: true,
      },
      data: { isLeaveDay: false },
    });
  });
}

/** Bangkok calendar "today" as UTC date-only (for Prisma `@db.Date` compare). */
export function bangkokTodayUtcDate(at = new Date()): Date {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
  return new Date(`${iso}T00:00:00.000Z`);
}

const DECIDED_LEAVE_STATUSES = ["APPROVED", "REJECTED", "CANCELLED"] as const;

function pendingFirstBySubmitted<
  T extends {
    status?: { code?: string | null } | null;
    submittedAt?: Date | string | null;
    createdAt?: Date | string | null;
  },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aPending = a.status?.code === "SUBMITTED" ? 0 : 1;
    const bPending = b.status?.code === "SUBMITTED" ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    const aAt = new Date(a.submittedAt ?? a.createdAt ?? 0).getTime();
    const bAt = new Date(b.submittedAt ?? b.createdAt ?? 0).getTime();
    return bAt - aAt;
  });
}

export async function listLeaveRequests(
  ctx: HrServiceContext,
  input: {
    status?: string | null;
    scope?: "self" | "org" | null;
    /**
     * `inbox` = pending + decided whose leave endDate is still today or later.
     * `all` = no date window (explicit status still applies).
     */
    view?: "inbox" | "all" | null;
  } = {},
) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.leaveRead,
    HR_PERMISSIONS.leaveSelf,
    HR_PERMISSIONS.leaveManage,
  ]);
  const statusCode = input.status?.trim() || null;
  const view =
    input.view ??
    (statusCode || input.scope === "self" ? "all" : "inbox");
  const canSeeOrg =
    hrCan(ctx, HR_PERMISSIONS.leaveManage) ||
    hrCan(ctx, HR_PERMISSIONS.leaveRead);
  const selfOnly = input.scope === "self" || !canSeeOrg;
  const self = selfOnly ? await resolveSelfEmployee(ctx) : null;
  const today = bangkokTodayUtcDate();
  const inboxWhere =
    view === "inbox"
      ? {
          OR: [
            { status: { code: "SUBMITTED" } },
            {
              status: { code: { in: [...DECIDED_LEAVE_STATUSES] } },
              endDate: { gte: today },
            },
          ],
        }
      : {};
  const rows = await db.leaveRequest.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(self
        ? { employeeId: self.id }
        : employeeBranchScopeWhere(ctx)),
      ...(statusCode ? { status: { code: statusCode } } : inboxWhere),
    },
    include: {
      employee: { select: leaveEmployeeSelect },
      coverEmployee: { select: leaveEmployeeSelect },
      leaveType: { select: { id: true, code: true, name: true } },
      status: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
  });
  const enriched = await enrichLeaveRowsWithShifts(rows);
  return pendingFirstBySubmitted(enriched);
}

export async function listLeaveHistory(
  ctx: HrServiceContext,
  input: {
    page?: number;
    pageSize?: number;
    scope?: "self" | "org" | null;
  } = {},
) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.leaveRead,
    HR_PERMISSIONS.leaveSelf,
    HR_PERMISSIONS.leaveManage,
  ]);
  const pagination = normalizePagination({
    page: input.page,
    pageSize: input.pageSize ?? 10,
  });
  const canSeeOrg =
    hrCan(ctx, HR_PERMISSIONS.leaveManage) ||
    hrCan(ctx, HR_PERMISSIONS.leaveRead);
  const selfOnly = input.scope === "self" || !canSeeOrg;
  const self = selfOnly ? await resolveSelfEmployee(ctx) : null;
  const today = bangkokTodayUtcDate();
  const where = {
    organizationId: ctx.organizationId,
    ...(self
      ? { employeeId: self.id }
      : employeeBranchScopeWhere(ctx)),
    status: { code: { in: [...DECIDED_LEAVE_STATUSES] } },
    endDate: { lt: today },
  };
  const [total, rows] = await Promise.all([
    db.leaveRequest.count({ where }),
    db.leaveRequest.findMany({
      where,
      include: {
        employee: { select: leaveEmployeeSelect },
        coverEmployee: { select: leaveEmployeeSelect },
        leaveType: { select: { id: true, code: true, name: true } },
        status: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ endDate: "desc" }, { reviewedAt: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);
  const enriched = await enrichLeaveRowsWithShifts(rows);
  return toPagedResponse({ rows: enriched, total }, pagination);
}

/**
 * Cover candidates for a leave request: employees on a *different* shift
 * on the leave dates (same-shift colleagues are excluded). Includes current shift label.
 */
export async function listLeaveCoverCandidates(
  ctx: HrServiceContext,
  input: { leaveRequestId: string },
) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.leaveApprove,
    HR_PERMISSIONS.leaveManage,
    HR_PERMISSIONS.leaveRead,
  ]);
  const leaveRequestId = String(input.leaveRequestId ?? "").trim();
  if (!leaveRequestId) {
    throw new HrError("VALIDATION_ERROR", { message: "ไม่พบคำขอลา" });
  }

  const leave = await db.leaveRequest.findFirst({
    where: { id: leaveRequestId, organizationId: ctx.organizationId },
    select: {
      id: true,
      employeeId: true,
      startDate: true,
      endDate: true,
      coverEmployeeId: true,
      employee: { select: { branchId: true } },
      coverEmployee: {
        select: {
          id: true,
          displayName: true,
          employeeCode: true,
          photoUrl: true,
          branchId: true,
        },
      },
    },
  });
  if (!leave) throw new HrError("NOT_FOUND");
  const leaveBranchId = leave.employee?.branchId ?? null;

  type Candidate = {
    id: string;
    employeeCode: string;
    displayName: string;
    photoUrl: string | null;
    shiftId: string | null;
    shiftName: string;
    timeLabel: string | null;
    workDates: string[];
  };

  const leaveAssignments = await db.shiftAssignment.findMany({
    where: {
      employeeId: leave.employeeId,
      workDate: { gte: leave.startDate, lte: leave.endDate },
      isRestDay: false,
      shiftId: { not: null },
    },
    select: { workDate: true, shiftId: true },
  });
  if (leaveAssignments.length === 0) {
    return [] as Candidate[];
  }

  const leaveShiftByDate = new Map<string, Set<string>>();
  const leaveDates: Date[] = [];
  for (const row of leaveAssignments as Array<{
    workDate: Date;
    shiftId: string | null;
  }>) {
    if (!row.shiftId) continue;
    const iso = row.workDate.toISOString().slice(0, 10);
    const set = leaveShiftByDate.get(iso) ?? new Set<string>();
    set.add(row.shiftId);
    leaveShiftByDate.set(iso, set);
    leaveDates.push(row.workDate);
  }

  const others = await db.shiftAssignment.findMany({
    where: {
      workDate: { in: leaveDates },
      employeeId: { not: leave.employeeId },
      isRestDay: false,
      isLeaveDay: false,
      shiftId: { not: null },
      employee: {
        organizationId: ctx.organizationId,
        isActive: true,
        ...(leaveBranchId ? { branchId: leaveBranchId } : {}),
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          displayName: true,
          employeeCode: true,
          photoUrl: true,
          branchId: true,
        },
      },
      shift: {
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
          crossesMidnight: true,
        },
      },
    },
    orderBy: [{ workDate: "asc" }],
  });

  type Acc = {
    id: string;
    employeeCode: string;
    displayName: string;
    photoUrl: string | null;
    shiftId: string | null;
    shiftName: string;
    timeLabel: string | null;
    workDates: string[];
    sameShiftDays: number;
    otherShiftDays: number;
  };
  const byEmployee = new Map<string, Acc>();

  for (const row of others as Array<{
    employeeId: string;
    workDate: Date;
    shiftId: string | null;
    employee: {
      id: string;
      displayName: string;
      employeeCode: string;
      photoUrl: string | null;
      branchId: string | null;
    };
    shift: {
      id: string;
      name: string;
      startTime: Date;
      endTime: Date;
      crossesMidnight: boolean;
    } | null;
  }>) {
    if (!row.shiftId) continue;
    if (leaveBranchId && row.employee.branchId !== leaveBranchId) continue;
    const iso = row.workDate.toISOString().slice(0, 10);
    const leaveShifts = leaveShiftByDate.get(iso);
    if (!leaveShifts) continue;

    const entry = byEmployee.get(row.employeeId) ?? {
      id: row.employee.id,
      employeeCode: row.employee.employeeCode,
      displayName: row.employee.displayName,
      photoUrl: row.employee.photoUrl,
      shiftId: row.shiftId,
      shiftName: row.shift?.name ?? "ไม่ระบุกะ",
      timeLabel: (() => {
        const start = formatShiftClock(row.shift?.startTime);
        const end = formatShiftClock(row.shift?.endTime);
        return start && end
          ? `${start}–${end}${row.shift?.crossesMidnight ? " (+1)" : ""}`
          : null;
      })(),
      workDates: [],
      sameShiftDays: 0,
      otherShiftDays: 0,
    };

    if (leaveShifts.has(row.shiftId)) {
      entry.sameShiftDays += 1;
    } else {
      entry.otherShiftDays += 1;
      if (!entry.workDates.includes(iso)) entry.workDates.push(iso);
      // Prefer showing the first other-shift seen as the "current" label.
      if (entry.otherShiftDays === 1 && row.shift) {
        entry.shiftId = row.shiftId;
        entry.shiftName = row.shift.name;
        const start = formatShiftClock(row.shift.startTime);
        const end = formatShiftClock(row.shift.endTime);
        entry.timeLabel =
          start && end
            ? `${start}–${end}${row.shift.crossesMidnight ? " (+1)" : ""}`
            : null;
      }
    }
    byEmployee.set(row.employeeId, entry);
  }

  const candidates = [...byEmployee.values()]
    .filter((row) => row.otherShiftDays > 0 && row.sameShiftDays === 0)
    .map(({ sameShiftDays: _s, otherShiftDays: _o, ...row }) => row)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "th"));

  // Keep the currently assigned cover visible even after their shift was moved
  // (only if still same branch as the leave employee).
  if (
    leave.coverEmployee &&
    (!leaveBranchId || leave.coverEmployee.branchId === leaveBranchId) &&
    !candidates.some((row) => row.id === leave.coverEmployee!.id)
  ) {
    candidates.unshift({
      id: leave.coverEmployee.id,
      employeeCode: leave.coverEmployee.employeeCode,
      displayName: leave.coverEmployee.displayName,
      photoUrl: leave.coverEmployee.photoUrl,
      shiftId: null,
      shiftName: "คนทำงานแทนที่เลือกไว้",
      timeLabel: null,
      workDates: [],
    });
  }

  return candidates;
}

export async function assignLeaveCover(
  ctx: HrServiceContext,
  input: { id: string; coverEmployeeId?: string | null },
) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.leaveApprove,
    HR_PERMISSIONS.leaveManage,
  ]);
  const id = String(input.id ?? "").trim();
  if (!id) throw new HrError("VALIDATION_ERROR", { message: "ไม่พบคำขอลา" });
  const leave = await db.leaveRequest.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      employee: { select: { authUserId: true } },
      status: { select: { code: true } },
    },
  });
  if (!leave) throw new HrError("NOT_FOUND");
  if (leave.status?.code === "REJECTED" || leave.status?.code === "CANCELLED") {
    throw new HrError("VALIDATION_ERROR", {
      message: "ไม่สามารถกำหนดคนแทนให้คำขอที่ถูกปฏิเสธแล้ว",
    });
  }

  const coverEmployeeId =
    typeof input.coverEmployeeId === "string" && input.coverEmployeeId.trim()
      ? input.coverEmployeeId.trim()
      : null;

  if (coverEmployeeId) {
    await applyLeaveCoverToSchedule(ctx, leave, coverEmployeeId);
  } else if (leave.status?.code === "APPROVED") {
    await db.$transaction(async (tx) => {
      await restorePriorCoverAssignments(tx, leave);
      await tx.leaveRequest.update({
        where: { id: leave.id },
        data: { coverEmployeeId: null },
      });
    });
  } else {
    await clearLeaveScheduleEffects(leave);
    await db.leaveRequest.update({
      where: { id: leave.id },
      data: { coverEmployeeId: null },
    });
  }

  const updated = await db.leaveRequest.findFirst({
    where: { id },
    include: {
      employee: { select: leaveEmployeeSelect },
      coverEmployee: { select: leaveEmployeeSelect },
      leaveType: { select: { id: true, code: true, name: true } },
      status: { select: { id: true, code: true, name: true } },
    },
  });
  if (!updated) throw new HrError("NOT_FOUND");
  const [enriched] = await enrichLeaveRowsWithShifts([updated]);
  return enriched;
}

const DECIDED_OT_STATUSES = ["APPROVED", "REJECTED", "CANCELLED"] as const;

export async function listOvertimeRequests(
  ctx: HrServiceContext,
  input: {
    status?: string | null;
    scope?: "self" | "org" | null;
    /** `inbox` = pending + decided whose workDate is still today or later. */
    view?: "inbox" | "all" | null;
  } = {},
) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.overtimeRead,
    HR_PERMISSIONS.overtimeSelf,
    HR_PERMISSIONS.overtimeManage,
  ]);
  const statusCode = input.status?.trim() || null;
  const view =
    input.view ??
    (statusCode || input.scope === "self" ? "all" : "inbox");
  const canSeeOrg =
    hrCan(ctx, HR_PERMISSIONS.overtimeManage) ||
    hrCan(ctx, HR_PERMISSIONS.overtimeRead);
  const selfOnly = input.scope === "self" || !canSeeOrg;
  const self = selfOnly ? await resolveSelfEmployee(ctx) : null;
  const today = bangkokTodayUtcDate();
  const inboxWhere =
    view === "inbox"
      ? {
          OR: [
            { status: { code: "SUBMITTED" } },
            {
              status: { code: { in: [...DECIDED_OT_STATUSES] } },
              workDate: { gte: today },
            },
          ],
        }
      : {};
  const rows = await db.overtimeRequest.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(self
        ? { employeeId: self.id }
        : employeeBranchScopeWhere(ctx)),
      ...(statusCode ? { status: { code: statusCode } } : inboxWhere),
    },
    include: {
      employee: {
        select: {
          id: true,
          displayName: true,
          employeeCode: true,
          photoUrl: true,
          branchId: true,
        },
      },
      status: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
  });
  return pendingFirstBySubmitted(rows);
}

export async function listOvertimeHistory(
  ctx: HrServiceContext,
  input: {
    page?: number;
    pageSize?: number;
    scope?: "self" | "org" | null;
  } = {},
) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.overtimeRead,
    HR_PERMISSIONS.overtimeSelf,
    HR_PERMISSIONS.overtimeManage,
  ]);
  const pagination = normalizePagination({
    page: input.page,
    pageSize: input.pageSize ?? 10,
  });
  const canSeeOrg =
    hrCan(ctx, HR_PERMISSIONS.overtimeManage) ||
    hrCan(ctx, HR_PERMISSIONS.overtimeRead);
  const selfOnly = input.scope === "self" || !canSeeOrg;
  const self = selfOnly ? await resolveSelfEmployee(ctx) : null;
  const today = bangkokTodayUtcDate();
  const where = {
    organizationId: ctx.organizationId,
    ...(self
      ? { employeeId: self.id }
      : employeeBranchScopeWhere(ctx)),
    status: { code: { in: [...DECIDED_OT_STATUSES] } },
    workDate: { lt: today },
  };
  const [total, rows] = await Promise.all([
    db.overtimeRequest.count({ where }),
    db.overtimeRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            displayName: true,
            employeeCode: true,
            photoUrl: true,
            branchId: true,
          },
        },
        status: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ workDate: "desc" }, { reviewedAt: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);
  return toPagedResponse({ rows, total }, pagination);
}

export async function submitLeave(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, [HR_PERMISSIONS.leaveSelf, HR_PERMISSIONS.leaveManage]);
  const canManage = hrCan(ctx, HR_PERMISSIONS.leaveManage);
  let employeeId =
    typeof input.employeeId === "string" ? input.employeeId.trim() : "";
  if (!employeeId || !canManage) {
    employeeId = (await resolveSelfEmployee(ctx)).id;
  } else {
    await owned("employee", ctx, employeeId);
  }

  const leaveTypeId =
    typeof input.leaveTypeId === "string" ? input.leaveTypeId.trim() : "";
  if (!leaveTypeId) {
    throw new HrError("VALIDATION_ERROR", { message: "กรุณาเลือกประเภทการลา" });
  }
  const leaveType = await db.leaveType.findFirst({
    where: {
      id: leaveTypeId,
      organizationId: ctx.organizationId,
      isActive: true,
    },
  });
  if (!leaveType) {
    throw new HrError("VALIDATION_ERROR", { message: "ไม่พบประเภทการลา" });
  }

  const startDate = requireIsoDate(input.startDate, "วันเริ่มลา");
  const endDate = requireIsoDate(input.endDate, "วันสิ้นสุดลา");
  if (endDate.getTime() < startDate.getTime()) {
    throw new HrError("VALIDATION_ERROR", {
      message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มลา",
    });
  }

  const startUnitId =
    typeof input.startUnitId === "string" && input.startUnitId.trim()
      ? input.startUnitId.trim()
      : leaveType.unitId;
  const endUnitId =
    typeof input.endUnitId === "string" && input.endUnitId.trim()
      ? input.endUnitId.trim()
      : leaveType.unitId;
  const parsedAmount = Number(input.requestedAmount);
  const requestedAmount =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? parsedAmount
      : Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;

  const employee = await db.employee.findFirst({
    where: { id: employeeId, organizationId: ctx.organizationId },
    select: { id: true, branchId: true },
  });
  if (!employee) throw new HrError("NOT_FOUND");

  const { assertLeaveBalanceAvailable } = await import(
    "@/lib/hr/services/leave-entitlements"
  );
  await assertLeaveBalanceAvailable(ctx, {
    employeeId: employee.id,
    leaveTypeId: leaveType.id,
    requestedAmount,
    branchId: employee.branchId,
  });

  const submitted = await master("leaveRequestStatus", "SUBMITTED");
  const overlap = await db.leaveRequest.findFirst({
    where: {
      employeeId,
      status: { code: { in: ["SUBMITTED", "APPROVED"] } },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
  if (overlap) {
    throw new HrError("VALIDATION_ERROR", {
      message: "วันลาซ้อนทับกับคำขอเดิม",
    });
  }

  const created = await db.leaveRequest.create({
    data: {
      organizationId: ctx.organizationId,
      employeeId,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      startUnitId,
      endUnitId,
      requestedAmount,
      reason:
        typeof input.reason === "string" ? input.reason.trim() || null : null,
      statusId: submitted.id,
      submittedAt: new Date(),
    },
    include: {
      leaveType: { select: { id: true, code: true, name: true } },
      status: { select: { id: true, code: true, name: true } },
      employee: {
        select: { displayName: true, firstNameTh: true, lastNameTh: true },
      },
    },
  });
  const empName =
    created.employee.displayName?.trim() ||
    `${created.employee.firstNameTh} ${created.employee.lastNameTh}`.trim();
  const { formatThaiDateRange } = await import("@/lib/hr/thai-date");
  const leaveDates = formatThaiDateRange(created.startDate, created.endDate);
  const { emitHrNotification } = await import("@/lib/hr/services/notify");
  void emitHrNotification(ctx, {
    typeCode: "LEAVE_SUBMITTED",
    title: "คำขอลาใหม่รออนุมัติ",
    body: `${empName} ส่งคำขอ${created.leaveType.name} ${created.requestedAmount} วัน · ${leaveDates}`,
    branchId: employee.branchId,
    entityType: "LEAVE_REQUEST",
    entityId: created.id,
    excludeAuthUserId: actor(ctx),
  });
  return created;
}
export async function listLeaveTypes(ctx: HrServiceContext) {
  assertHrPermission(ctx, [HR_PERMISSIONS.leaveSelf, HR_PERMISSIONS.leaveManage]);
  return db.leaveType.findMany({
    where: { organizationId: ctx.organizationId, isActive: true },
    include: { unit: true },
    orderBy: { code: "asc" },
  });
}
export async function listLeaveBalances(ctx: HrServiceContext, employeeId?: string) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.leaveSelf,
    HR_PERMISSIONS.leaveManage,
    HR_PERMISSIONS.leaveRead,
  ]);
  if (employeeId) await owned("employee", ctx, employeeId);
  return db.employeeLeaveBalance.findMany({
    where: {
      ...(employeeId
        ? { employeeId }
        : { employee: { organizationId: ctx.organizationId } }),
    },
    include: {
      leaveType: { select: { id: true, code: true, name: true } },
      employee: {
        select: {
          id: true,
          displayName: true,
          employeeCode: true,
          photoUrl: true,
        },
      },
    },
    orderBy: [{ balanceYear: "desc" }, { createdAt: "desc" }],
  });
}
export async function reviewLeave(
  ctx: HrServiceContext,
  id: string,
  approve: boolean,
  note?: string,
  coverEmployeeId?: string | null,
) {
  assertHrPermission(ctx, HR_PERMISSIONS.leaveApprove);
  const row = await db.leaveRequest.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      employee: { select: { authUserId: true, branchId: true } },
      status: { select: { code: true } },
    },
  });
  if (!row) throw new HrError("NOT_FOUND");
  assertBranchInScope(ctx, row.employee?.branchId);
  assertNoSelfApproval(row.employee?.authUserId, actor(ctx)!);
  const status = await master(
    "leaveRequestStatus",
    approve ? "APPROVED" : "REJECTED",
  );

  const {
    applyApprovedLeaveUsage,
    reverseLeaveUsageIfAny,
  } = await import("@/lib/hr/services/leave-entitlements");

  if (approve) {
    const nextCover =
      typeof coverEmployeeId === "string" && coverEmployeeId.trim()
        ? coverEmployeeId.trim()
        : (row.coverEmployeeId ?? null);
    await applyLeaveCoverToSchedule(ctx, row, nextCover);
    await applyApprovedLeaveUsage(ctx, {
      leaveRequestId: row.id,
      employeeId: row.employeeId,
      leaveTypeId: row.leaveTypeId,
      branchId: row.employee.branchId,
      requestedAmount: Number(row.requestedAmount),
      workDate: row.startDate,
    });
  } else {
    await clearLeaveScheduleEffects(row);
    await reverseLeaveUsageIfAny(row.id);
  }

  const reviewedByName = await resolveActorDisplayName(ctx);
  const updated = await db.leaveRequest.update({
    where: { id },
    data: {
      statusId: status.id,
      reviewedAt: new Date(),
      reviewedByAuthUserId: actor(ctx),
      reviewNote: note ?? null,
      ...(approve
        ? {}
        : { coverEmployeeId: null }),
    },
    include: {
      employee: { select: leaveEmployeeSelect },
      coverEmployee: { select: leaveEmployeeSelect },
      leaveType: { select: { id: true, code: true, name: true } },
      status: { select: { id: true, code: true, name: true } },
    },
  });
  await stampReviewedByName("leave_requests", id, reviewedByName);
  if (row.employee?.authUserId) {
    const { formatThaiDateRange } = await import("@/lib/hr/thai-date");
    const leaveDates = formatThaiDateRange(row.startDate, row.endDate);
    const { emitHrNotification } = await import("@/lib/hr/services/notify");
    void emitHrNotification(ctx, {
      typeCode: approve ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
      title: approve ? "คำขอลาได้รับการอนุมัติ" : "คำขอลาไม่ได้รับการอนุมัติ",
      body: approve
        ? `คำขอ${updated.leaveType.name} (${leaveDates}) ของคุณได้รับการอนุมัติแล้ว`
        : `คำขอ${updated.leaveType.name} (${leaveDates}) ของคุณไม่ได้รับการอนุมัติ`,
      branchId: row.employee.branchId,
      entityType: "LEAVE_REQUEST",
      entityId: updated.id,
      recipientAuthUserIds: [row.employee.authUserId],
      recipientEmployeeId: row.employeeId,
    });
  }
  return { ...updated, reviewedByName };
}
export async function submitOvertime(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.overtimeSelf,
    HR_PERMISSIONS.overtimeManage,
  ]);
  const canManage = hrCan(ctx, HR_PERMISSIONS.overtimeManage);
  let employeeId =
    typeof input.employeeId === "string" ? input.employeeId.trim() : "";
  if (!employeeId || !canManage) {
    employeeId = (await resolveSelfEmployee(ctx)).id;
  } else {
    await owned("employee", ctx, employeeId);
  }

  const workDate = requireIsoDate(input.workDate, "วันที่ทำ OT");
  const startAt = requireDateTime(input.startAt, "เวลาเริ่ม OT");
  const endAt = requireDateTime(input.endAt, "เวลาสิ้นสุด OT");
  if (endAt.getTime() <= startAt.getTime()) {
    throw new HrError("VALIDATION_ERROR", {
      message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม",
    });
  }
  const requestedMinutes = Math.max(
    0,
    Math.round((endAt.getTime() - startAt.getTime()) / 60_000),
  );
  if (requestedMinutes <= 0) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ระยะเวลา OT ต้องมากกว่า 0 นาที",
    });
  }

  const employee = await db.employee.findFirst({
    where: { id: employeeId, organizationId: ctx.organizationId },
    select: { id: true, branchId: true },
  });
  if (!employee) throw new HrError("NOT_FOUND");

  const submitted = await master("overtimeRequestStatus", "SUBMITTED");
  const created = await db.overtimeRequest.create({
    data: {
      organizationId: ctx.organizationId,
      employeeId: employee.id,
      branchId:
        typeof input.branchId === "string" && input.branchId.trim()
          ? input.branchId.trim()
          : employee.branchId,
      workDate,
      startAt,
      endAt,
      requestedMinutes,
      reason:
        typeof input.reason === "string" ? input.reason.trim() || null : null,
      statusId: submitted.id,
      submittedAt: new Date(),
    },
    include: {
      status: { select: { id: true, code: true, name: true } },
      employee: {
        select: { displayName: true, firstNameTh: true, lastNameTh: true },
      },
    },
  });
  const empName =
    created.employee.displayName?.trim() ||
    `${created.employee.firstNameTh} ${created.employee.lastNameTh}`.trim();
  const hours = (requestedMinutes / 60).toFixed(1);
  const { formatThaiDate } = await import("@/lib/hr/thai-date");
  const workDateLabel = formatThaiDate(workDate);
  const { emitHrNotification } = await import("@/lib/hr/services/notify");
  void emitHrNotification(ctx, {
    typeCode: "OT_SUBMITTED",
    title: "คำขอ OT ใหม่รออนุมัติ",
    body: `${empName} ส่งคำขอ OT ${hours} ชั่วโมง · ${workDateLabel}`,
    branchId: created.branchId,
    entityType: "OVERTIME_REQUEST",
    entityId: created.id,
    excludeAuthUserId: actor(ctx),
  });
  return created;
}
export async function reviewOvertime(ctx: HrServiceContext, id: string, approve: boolean, note?: string) {
  assertHrPermission(ctx, HR_PERMISSIONS.overtimeApprove);
  const row = await db.overtimeRequest.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: { employee: { select: { authUserId: true, branchId: true } } },
  });
  if (!row) throw new HrError("NOT_FOUND");
  assertBranchInScope(ctx, row.employee?.branchId ?? row.branchId);
  assertNoSelfApproval(row.employee?.authUserId, actor(ctx)!);
  const status = await master("overtimeRequestStatus", approve ? "APPROVED" : "REJECTED");
  const reviewedByName = await resolveActorDisplayName(ctx);
  const updated = await db.overtimeRequest.update({
    where: { id },
    data: {
      statusId: status.id,
      reviewedAt: new Date(),
      reviewedByAuthUserId: actor(ctx),
      reviewNote: note ?? null,
      ...(approve ? { approvedMinutes: row.requestedMinutes } : {}),
    },
  });
  await stampReviewedByName("overtime_requests", id, reviewedByName);
  if (row.employee?.authUserId) {
    const { formatThaiDate } = await import("@/lib/hr/thai-date");
    const workDateLabel = formatThaiDate(row.workDate);
    const { emitHrNotification } = await import("@/lib/hr/services/notify");
    void emitHrNotification(ctx, {
      typeCode: approve ? "OT_APPROVED" : "OT_REJECTED",
      title: approve ? "คำขอ OT ได้รับการอนุมัติ" : "คำขอ OT ไม่ได้รับการอนุมัติ",
      body: approve
        ? `คำขอ OT วันที่ ${workDateLabel} ของคุณได้รับการอนุมัติแล้ว`
        : `คำขอ OT วันที่ ${workDateLabel} ของคุณไม่ได้รับการอนุมัติ`,
      branchId: row.employee.branchId ?? row.branchId,
      entityType: "OVERTIME_REQUEST",
      entityId: updated.id,
      recipientAuthUserIds: [row.employee.authUserId],
      recipientEmployeeId: row.employeeId,
    });
  }
  return { ...updated, reviewedByName };
}

export async function createPayrollRun(ctx: HrServiceContext, payrollPeriodId: string) {
  assertHrPermission(ctx, HR_PERMISSIONS.payrollCalculate); await owned("payrollPeriod", ctx, payrollPeriodId);
  const count = await db.payrollRun.count({ where: { payrollPeriodId } }); const draft = await master("payrollPeriodStatus", "DRAFT");
  return db.payrollRun.create({ data: { organizationId: ctx.organizationId, payrollPeriodId, runNumber: count + 1, statusId: draft.id, createdByAuthUserId: actor(ctx)! } });
}
export async function payrollAction(ctx: HrServiceContext, id: string, action: string) {
  const run = await owned("payrollRun", ctx, id); const status = await db.payrollPeriodStatus.findUnique({ where: { id: run.statusId } });
  if (action === "calculate") {
    assertHrPermission(ctx, HR_PERMISSIONS.payrollCalculate);
    assertPayrollRecalculable(status?.code ?? "");
    const [
      employees,
      deductionRates,
      attendancePaySettings,
      period,
      baseEarn,
      otEarn,
      advancePayoutEarn,
      taxDed,
      ssoDed,
      advanceDed,
      lateDed,
      absenceDed,
      review,
    ] = await Promise.all([
      db.employee.findMany({
        where: {
          organizationId: ctx.organizationId,
          isActive: true,
          ...employeeOwnBranchWhere(ctx),
        },
        include: {
          compensations: {
            where: { isCurrent: true },
            include: { wageType: true },
            take: 1,
          },
        },
      }),
      loadDeductionRatesForOrg(ctx.organizationId),
      loadAttendancePaySettingsForOrg(ctx.organizationId),
      db.payrollPeriod.findFirst({
        where: { id: run.payrollPeriodId, organizationId: ctx.organizationId },
        select: { id: true, periodStart: true, periodEnd: true },
      }),
      master("earningType", "BASE_SALARY"),
      master("earningType", "OVERTIME").catch(() => null),
      master("earningType", "ADVANCE_PAYOUT").catch(() => null),
      master("deductionType", "TAX"),
      master("deductionType", "SOCIAL_SECURITY"),
      master("deductionType", "ADVANCE").catch(() =>
        master("deductionType", "LOAN"),
      ),
      master("deductionType", "LATE").catch(() => null),
      master("deductionType", "ABSENCE").catch(() => null),
      master("payrollPeriodStatus", "REVIEW"),
    ]);
    if (!period) throw new HrError("NOT_FOUND", { message: "ไม่พบงวดเงินเดือน" });
    const employeeIds = employees.map((e: { id: string }) => e.id);
    if (employeeIds.length > 0) {
      await reopenAdvanceEffectsForRun(id, employeeIds);
    }
    const periodId = run.payrollPeriodId as string;
    const wageByEmployee = new Map<
      string,
      { wageType: "DAILY" | "MONTHLY" | "HOURLY"; wageAmount: number }
    >();
    for (const employee of employees) {
      const compensation = employee.compensations[0];
      if (!compensation) continue;
      wageByEmployee.set(employee.id, {
        wageType: compensation.wageType.code as "DAILY" | "MONTHLY" | "HOURLY",
        wageAmount: Number(compensation.amount),
      });
    }
    const [
      { deductionsByEmployee, creditsByEmployee },
      legacyByEmployee,
      attendanceEffects,
    ] = await Promise.all([
      loadAdvanceEffectsForPeriod(
        ctx.organizationId,
        periodId,
        employeeIds,
      ),
      loadLegacyApprovedAdvancesByEmployee(ctx.organizationId, employeeIds),
      loadAttendancePayEffectsForPeriod({
        organizationId: ctx.organizationId,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        employeeIds,
        settings: attendancePaySettings,
        wageByEmployee,
      }),
    ]);
    const installmentIds: string[] = [];
    const creditedAdvanceIds: string[] = [];
    const legacyAdvanceIds: string[] = [];
    await db.$transaction(async (tx: any) => {
      // Never wipe other branches when header has a branch selected.
      const wipeWhere = { payrollRunId: id, ...employeeBranchWhere(ctx) };
      const existingEmpIds = (
        await tx.payrollRunEmployee.findMany({
          where: wipeWhere,
          select: { id: true },
        })
      ).map((r: { id: string }) => r.id);
      if (existingEmpIds.length > 0) {
        await tx.payslip.deleteMany({
          where: { payrollRunEmployeeId: { in: existingEmpIds } },
        });
      }
      await tx.payrollRunEmployee.deleteMany({ where: wipeWhere });
      for (const employee of employees) {
        const compensation = employee.compensations[0];
        if (!compensation) continue;
        const installmentRows = deductionsByEmployee.get(employee.id) ?? [];
        const creditRows = creditsByEmployee.get(employee.id) ?? [];
        const legacyRows = legacyByEmployee.get(employee.id) ?? [];
        const attendance = attendanceEffects.get(employee.id);
        const advanceTotal =
          installmentRows.reduce((s, a) => s + a.amount, 0) +
          legacyRows.reduce((s, a) => s + a.amount, 0);
        const creditTotal = creditRows.reduce((s, a) => s + a.amount, 0);
        for (const row of installmentRows) installmentIds.push(row.installmentId);
        for (const row of creditRows) creditedAdvanceIds.push(row.advanceId);
        for (const row of legacyRows) legacyAdvanceIds.push(row.id);
        const earnings = [
          ...(attendance?.overtimeEarnings ?? []),
          ...(creditTotal > 0
            ? [
                {
                  code: "ADVANCE_PAYOUT",
                  amount: creditTotal,
                  description: "โอนเบิกล่วงหน้า (พร้อมเงินเดือน)",
                },
              ]
            : []),
        ];
        const deductions = [
          ...(attendance?.lateDeductions ?? []),
          ...(attendance?.absenceDeductions ?? []),
          ...(advanceTotal > 0
            ? [
                {
                  code: "ADVANCE",
                  amount: advanceTotal,
                  description: "หักเบิกล่วงหน้า",
                },
              ]
            : []),
        ];
        const calc = calculatePayroll({
          wageType: compensation.wageType.code as "DAILY" | "MONTHLY" | "HOURLY",
          wageAmount: Number(compensation.amount),
          deductionRates,
          earnings: earnings.length > 0 ? earnings : undefined,
          deductions: deductions.length > 0 ? deductions : undefined,
        });
        await tx.payrollRunEmployee.create({
          data: {
            payrollRunId: id,
            employeeId: employee.id,
            grossEarnings: calc.gross,
            totalDeductions: calc.deductions,
            netPay: calc.net,
            overtimeMinutes: attendance?.overtimeMinutes ?? 0,
            statusId: review.id,
            calculatedAt: new Date(),
            items: {
              create: calc.lines.map((line: { kind: string; code: string; description: string; amount: number }) => ({
                sourceType: "CALCULATED",
                description: line.description,
                amount: line.amount,
                earningTypeId:
                  line.kind === "EARNING"
                    ? line.code === "BASE_PAY"
                      ? baseEarn.id
                      : line.code === "OVERTIME"
                        ? otEarn?.id ?? null
                        : line.code === "ADVANCE_PAYOUT"
                          ? advancePayoutEarn?.id ?? null
                          : null
                    : null,
                deductionTypeId:
                  line.kind === "DEDUCTION"
                    ? line.code === "TAX"
                      ? taxDed.id
                      : line.code === "SOCIAL_SECURITY"
                        ? ssoDed.id
                        : line.code === "ADVANCE"
                          ? advanceDed.id
                          : line.code === "LATE"
                            ? lateDed?.id ?? null
                            : line.code === "ABSENCE"
                              ? absenceDed?.id ?? null
                              : null
                    : null,
              })),
            },
          },
        });
      }
    });
    await markAdvanceEffectsApplied({
      payrollRunId: id,
      installmentIds,
      creditedAdvanceIds,
      legacyAdvanceIds,
    });
    return db.payrollRun.update({
      where: { id },
      data: {
        statusId: review.id,
        completedAt: new Date(),
        approvedAt: null,
        approvedByAuthUserId: null,
      },
    });
  }
  const requirements: Record<string, any> = { review: HR_PERMISSIONS.payrollReview, approve: HR_PERMISSIONS.payrollApprove, markPaid: HR_PERMISSIONS.payrollMarkPaid, lock: HR_PERMISSIONS.payrollLock };
  if (!requirements[action]) throw new HrError("VALIDATION_ERROR", { message: "ไม่รู้จักคำสั่งประมวลผล" });
  assertHrPermission(ctx, requirements[action]); const code = action === "markPaid" ? "PAID" : action === "lock" ? "LOCKED" : action === "approve" ? "APPROVED" : "REVIEW"; const next = await master("payrollPeriodStatus", code);
  return db.payrollRun.update({ where: { id }, data: { statusId: next.id, ...(action === "approve" ? { approvedAt: new Date(), approvedByAuthUserId: actor(ctx) } : {}) } });
}
export async function issuePayslips(ctx: HrServiceContext, runId: string) {
  assertHrPermission(ctx, [HR_PERMISSIONS.payslipRead, HR_PERMISSIONS.payrollApprove]); const run = await owned("payrollRun", ctx, runId); const status = await db.payrollPeriodStatus.findUnique({ where: { id: run.statusId } }); if (!["APPROVED", "PAID", "LOCKED"].includes(status?.code ?? "")) throw new HrError("INVALID_STATUS_TRANSITION");
  const rows = await db.payrollRunEmployee.findMany({ where: { payrollRunId: runId, ...employeeBranchWhere(ctx) }, include: { items: true, employee: { select: { displayName: true } } } });
  await db.$transaction(rows.map((row: any) => db.payslip.upsert({ where: { payrollRunEmployeeId: row.id }, create: { payrollRunEmployeeId: row.id, employeeId: row.employeeId, issuedAt: new Date(), issuedByAuthUserId: actor(ctx), grossEarnings: row.grossEarnings, totalDeductions: row.totalDeductions, netPay: row.netPay, snapshot: { employeeId: row.employeeId, displayName: row.employee?.displayName, items: row.items, gross: row.grossEarnings, deductions: row.totalDeductions, net: row.netPay } }, update: { issuedAt: new Date(), issuedByAuthUserId: actor(ctx) } }))); return { count: rows.length };
}

export {
  createNotification,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  countUnreadNotifications,
  emitHrNotification,
} from "@/lib/hr/services/notify";

export async function report(ctx: HrServiceContext, kind: string, input: any = {}) {
  assertHrPermission(ctx, HR_PERMISSIONS.reportRead);
  if (kind === "summary") {
    const { loadReportsHubSummary } = await import(
      "@/lib/hr/services/report-summaries"
    );
    return loadReportsHubSummary(ctx);
  }
  if (kind === "advances") {
    const { reportSalaryAdvances } = await import(
      "@/lib/hr/services/salary-advances"
    );
    return reportSalaryAdvances(ctx);
  }
  const map: Record<string, string> = { attendance: "attendanceDay", leave: "leaveRequest", overtime: "overtimeRequest", payroll: "payrollRun", headcount: "employee" };
  const model = map[kind]; if (!model) throw new HrError("NOT_FOUND");
  const rows = await db[model].findMany({ where: { organizationId: ctx.organizationId, ...(input.from ? { createdAt: { gte: date(input.from), lte: date(input.to ?? input.from) } } : {}) } });
  return { kind, count: rows.length, rows };
}
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ""; const keys = Object.keys(rows[0]); const cell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return [keys.join(","), ...rows.map(row => keys.map(key => cell(row[key])).join(","))].join("\n");
}

export async function listPayItems(ctx: HrServiceContext, employeeId?: string) {
  assertHrPermission(ctx, [HR_PERMISSIONS.payrollRead, HR_PERMISSIONS.payrollManage]);
  return {
    earningTypes: await db.earningType.findMany({ where: { OR: [{ organizationId: null }, { organizationId: ctx.organizationId }], isActive: true } }),
    deductionTypes: await db.deductionType.findMany({ where: { OR: [{ organizationId: null }, { organizationId: ctx.organizationId }], isActive: true } }),
    recurring: employeeId ? await db.employeeRecurringPayItem.findMany({ where: { employeeId, isActive: true } }) : [],
  };
}
export async function saveRecurringPayItem(ctx: HrServiceContext, input: any, id?: string) {
  assertHrPermission(ctx, HR_PERMISSIONS.payrollManage); await owned("employee", ctx, input.employeeId);
  if (!!input.earningTypeId === !!input.deductionTypeId) throw new HrError("VALIDATION_ERROR", { message: "ต้องระบุรายการรับหรือรายการหักเพียงอย่างเดียว" });
  const start = date(input.effectiveFrom), end = input.effectiveTo ? date(input.effectiveTo) : null;
  const overlap = await db.employeeRecurringPayItem.findFirst({ where: { employeeId: input.employeeId, ...(id ? { NOT: { id } } : {}), effectiveFrom: { lte: end ?? new Date("9999-12-31") }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }] } });
  if (overlap) throw new HrError("OVERLAP_COMPENSATION");
  const data = { ...input, effectiveFrom: start, effectiveTo: end, createdByAuthUserId: actor(ctx) };
  return id ? db.employeeRecurringPayItem.update({ where: { id }, data }) : db.employeeRecurringPayItem.create({ data });
}
async function listShiftMismatchRequestsRaw(
  organizationId: string,
  statusCode: string,
) {
  return db.$queryRaw<
    Array<{
      id: string;
      employee_id: string;
      work_date: Date;
      reason: string;
      status_id: string;
      status_code: string;
      status_name: string;
      employee_code: string;
      display_name: string;
      photo_url: string | null;
      from_shift_id: string;
      from_shift_name: string;
      from_start: Date;
      from_end: Date;
      to_shift_id: string;
      to_shift_name: string;
      to_start: Date;
      to_end: Date;
    }>
  >`
    SELECT
      r.id::text AS id,
      r.employee_id::text AS employee_id,
      r.work_date,
      r.reason,
      r.status_id::text AS status_id,
      s.code AS status_code,
      s.name AS status_name,
      e.employee_code,
      e.display_name,
      e.photo_url,
      fs.id::text AS from_shift_id,
      fs.name AS from_shift_name,
      fs.start_time AS from_start,
      fs.end_time AS from_end,
      ts.id::text AS to_shift_id,
      ts.name AS to_shift_name,
      ts.start_time AS to_start,
      ts.end_time AS to_end
    FROM hr.shift_mismatch_requests r
    JOIN hr.leave_request_statuses s ON s.id = r.status_id
    JOIN hr.employees e ON e.id = r.employee_id
    JOIN hr.shifts fs ON fs.id = r.from_shift_id
    JOIN hr.shifts ts ON ts.id = r.to_shift_id
    WHERE r.organization_id = ${organizationId}::uuid
      AND s.code = ${statusCode}
    ORDER BY r.work_date DESC, r.created_at DESC
  `.then((rows: Array<any>) =>
    rows.map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      workDate: row.work_date,
      reason: row.reason,
      employee: {
        id: row.employee_id,
        employeeCode: row.employee_code,
        displayName: row.display_name,
        photoUrl: row.photo_url,
      },
      fromShift: {
        id: row.from_shift_id,
        name: row.from_shift_name,
        startTime: row.from_start,
        endTime: row.from_end,
      },
      toShift: {
        id: row.to_shift_id,
        name: row.to_shift_name,
        startTime: row.to_start,
        endTime: row.to_end,
      },
      status: {
        id: row.status_id,
        code: row.status_code,
        name: row.status_name,
      },
    })),
  );
}

export async function listShiftMismatchRequests(
  ctx: HrServiceContext,
  input: { status?: string | null } = {},
) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.attendanceManage,
    HR_PERMISSIONS.approvalManage,
    HR_PERMISSIONS.approvalRead,
  ]);
  const statusCode = input.status?.trim() || "SUBMITTED";
  if (!db.shiftMismatchRequest?.findMany) {
    return listShiftMismatchRequestsRaw(ctx.organizationId, statusCode);
  }
  return db.shiftMismatchRequest.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: { code: statusCode },
      ...employeeBranchScopeWhere(ctx),
    },
    include: {
      employee: { select: adjustmentEmployeeSelect },
      fromShift: {
        select: { id: true, name: true, startTime: true, endTime: true },
      },
      toShift: {
        select: { id: true, name: true, startTime: true, endTime: true },
      },
      status: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function reviewShiftMismatchRequest(
  ctx: HrServiceContext,
  id: string,
  approve: boolean,
  note?: string,
) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.attendanceManage,
    HR_PERMISSIONS.approvalManage,
  ]);
  let row: any = null;
  if (db.shiftMismatchRequest?.findFirst) {
    row = await db.shiftMismatchRequest.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        employee: { select: { authUserId: true, id: true } },
        status: { select: { code: true } },
        fromShift: { select: { id: true, name: true } },
        toShift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            graceLateMinutes: true,
            graceEarlyLeaveMinutes: true,
            crossesMidnight: true,
          },
        },
      },
    });
  } else {
    const rows = await db.$queryRaw<Array<any>>`
      SELECT
        r.*,
        s.code AS status_code,
        e.auth_user_id AS employee_auth_user_id,
        ts.start_time AS to_start,
        ts.end_time AS to_end,
        ts.grace_late_minutes AS to_grace_late,
        ts.grace_early_leave_minutes AS to_grace_early,
        ts.crosses_midnight AS to_crosses
      FROM hr.shift_mismatch_requests r
      JOIN hr.leave_request_statuses s ON s.id = r.status_id
      JOIN hr.employees e ON e.id = r.employee_id
      JOIN hr.shifts ts ON ts.id = r.to_shift_id
      WHERE r.id = ${id}::uuid
        AND r.organization_id = ${ctx.organizationId}::uuid
      LIMIT 1
    `;
    const raw = rows[0];
    if (raw) {
      row = {
        id: raw.id,
        employeeId: raw.employee_id,
        workDate: raw.work_date,
        schedulePeriodId: raw.schedule_period_id,
        fromShiftId: raw.from_shift_id,
        toShiftId: raw.to_shift_id,
        status: { code: raw.status_code },
        employee: { authUserId: raw.employee_auth_user_id, id: raw.employee_id },
        toShift: {
          id: raw.to_shift_id,
          startTime: raw.to_start,
          endTime: raw.to_end,
          graceLateMinutes: raw.to_grace_late,
          graceEarlyLeaveMinutes: raw.to_grace_early,
          crossesMidnight: raw.to_crosses,
        },
      };
    }
  }
  if (!row) throw new HrError("NOT_FOUND");
  if (row.status?.code !== "SUBMITTED") {
    throw new HrError("INVALID_STATUS_TRANSITION", {
      message: "คำขอนี้ไม่อยู่ในสถานะรออนุมัติ",
    });
  }
  assertBranchInScope(ctx, row.employee?.branchId);
  assertNoSelfApproval(row.employee?.authUserId, actor(ctx)!);

  const workDateIso = row.workDate.toISOString().slice(0, 10);
  const reviewedByName = await resolveActorDisplayName(ctx);

  if (approve) {
    await applyApprovedShiftMismatchMove({
      organizationId: ctx.organizationId,
      schedulePeriodId: row.schedulePeriodId,
      employeeId: row.employeeId,
      fromShiftId: row.fromShiftId,
      toShiftId: row.toShiftId,
      workDate: row.workDate,
    });

    const day = await db.attendanceDay.findUnique({
      where: {
        employeeId_workDate: {
          employeeId: row.employeeId,
          workDate: row.workDate,
        },
      },
    });
    if (day) {
      const metrics = computeLateEarlyMinutes({
        workDate: workDateIso,
        clockInAt: day.clockInAt,
        clockOutAt: day.clockOutAt,
        startTime: row.toShift?.startTime ?? null,
        endTime: row.toShift?.endTime ?? null,
        graceLateMinutes: row.toShift?.graceLateMinutes ?? 0,
        graceEarlyLeaveMinutes: row.toShift?.graceEarlyLeaveMinutes ?? 0,
        crossesMidnight: row.toShift?.crossesMidnight ?? false,
      });
      let statusCode = "INCOMPLETE";
      if (day.clockInAt && day.clockOutAt) {
        statusCode = metrics.lateMinutes > 0 ? "LATE" : "PRESENT";
      }
      const nextStatus = await master("attendanceStatus", statusCode);
      await db.attendanceDay.update({
        where: { id: day.id },
        data: {
          statusId: nextStatus.id,
          lateMinutes: metrics.lateMinutes,
          earlyLeaveMinutes: metrics.earlyLeaveMinutes,
        },
      });
      await db.$executeRaw`
        UPDATE hr.attendance_days
        SET shift_mismatch_status = 'APPROVED', updated_at = NOW()
        WHERE id = ${day.id}::uuid
      `.catch(() => undefined);
    }
  } else {
    const wrong = await master("attendanceStatus", "WRONG_SHIFT");
    await db.attendanceDay.updateMany({
      where: {
        employeeId: row.employeeId,
        workDate: row.workDate,
      },
      data: {
        statusId: wrong.id,
      },
    });
    await db.$executeRaw`
      UPDATE hr.attendance_days
      SET shift_mismatch_status = 'REJECTED', updated_at = NOW()
      WHERE employee_id = ${row.employeeId}::uuid
        AND work_date = ${row.workDate}::date
    `.catch(() => undefined);
  }

  const status = await master(
    "leaveRequestStatus",
    approve ? "APPROVED" : "REJECTED",
  );
  if (db.shiftMismatchRequest?.update) {
    const updated = await db.shiftMismatchRequest.update({
      where: { id },
      data: {
        statusId: status.id,
        reviewedAt: new Date(),
        reviewedByAuthUserId: actor(ctx),
        reviewNote: note?.trim() || null,
      },
      include: {
        employee: { select: adjustmentEmployeeSelect },
        fromShift: {
          select: { id: true, name: true, startTime: true, endTime: true },
        },
        toShift: {
          select: { id: true, name: true, startTime: true, endTime: true },
        },
        status: { select: { id: true, code: true, name: true } },
      },
    });
    await stampReviewedByName("shift_mismatch_requests", id, reviewedByName);
    return { ...updated, reviewedByName };
  }
  await db.$executeRaw`
    UPDATE hr.shift_mismatch_requests
    SET status_id = ${status.id}::uuid,
        reviewed_at = NOW(),
        reviewed_by_auth_user_id = ${actor(ctx)}::uuid,
        reviewed_by_name = ${reviewedByName},
        review_note = ${note?.trim() || null},
        updated_at = NOW()
    WHERE id = ${id}::uuid
  `;
  const listed = await listShiftMismatchRequestsRaw(
    ctx.organizationId,
    approve ? "APPROVED" : "REJECTED",
  );
  return listed.find((item: { id: string }) => item.id === id) ?? { id, ok: true };
}

/** Load one request for notification deep-link (org-scoped; ignore inbox filters). */
export async function getLeaveRequestById(ctx: HrServiceContext, id: string) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.approvalRead,
    HR_PERMISSIONS.leaveApprove,
    HR_PERMISSIONS.leaveRead,
  ]);
  const row = await db.leaveRequest.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      employee: { select: { ...leaveEmployeeSelect, authUserId: true } },
      coverEmployee: { select: leaveEmployeeSelect },
      leaveType: { select: { name: true, code: true } },
      status: { select: { code: true, name: true } },
    },
  });
  if (!row) return null;
  const [enriched] = await enrichLeaveRowsWithShifts([row]);
  return enriched ?? row;
}

export async function getOvertimeRequestById(ctx: HrServiceContext, id: string) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.approvalRead,
    HR_PERMISSIONS.overtimeApprove,
    HR_PERMISSIONS.overtimeRead,
  ]);
  return db.overtimeRequest.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      employee: {
        select: {
          id: true,
          displayName: true,
          employeeCode: true,
          photoUrl: true,
          authUserId: true,
        },
      },
      status: { select: { code: true, name: true } },
    },
  });
}

export async function approvalInbox(ctx: HrServiceContext) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.approvalRead,
    HR_PERMISSIONS.leaveApprove,
    HR_PERMISSIONS.overtimeApprove,
    HR_PERMISSIONS.advanceApprove,
  ]);
  const employeeSelect = {
    id: true,
    displayName: true,
    employeeCode: true,
    photoUrl: true,
    authUserId: true,
  };
  const branchScope = employeeBranchScopeWhere(ctx);
  const today = bangkokTodayUtcDate();
  /** Pending always; decided stay visible until the event/leave date passes. */
  const leaveInboxWhere = {
    OR: [
      { status: { code: "SUBMITTED" } },
      {
        status: { code: { in: [...DECIDED_LEAVE_STATUSES] } },
        endDate: { gte: today },
      },
    ],
  };
  const workDateInboxWhere = {
    OR: [
      { status: { code: "SUBMITTED" } },
      {
        status: { code: { in: [...DECIDED_OT_STATUSES] } },
        workDate: { gte: today },
      },
    ],
  };
  const [leaveRows, overtimeRows, adjustments, shiftMismatches, advanceRows] =
    await Promise.all([
    db.leaveRequest.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...leaveInboxWhere,
        ...branchScope,
      },
      include: {
        employee: { select: { ...employeeSelect, ...leaveEmployeeSelect } },
        coverEmployee: { select: leaveEmployeeSelect },
        leaveType: { select: { name: true, code: true } },
        status: { select: { code: true, name: true } },
      },
      orderBy: { submittedAt: "desc" },
    }),
    db.overtimeRequest.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...workDateInboxWhere,
        ...branchScope,
      },
      include: {
        employee: { select: employeeSelect },
        status: { select: { code: true, name: true } },
      },
      orderBy: { submittedAt: "desc" },
    }),
    db.attendanceAdjustment.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...workDateInboxWhere,
        ...branchScope,
      },
      include: {
        employee: { select: adjustmentEmployeeSelect },
        status: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.shiftMismatchRequest?.findMany
      ? db.shiftMismatchRequest.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...workDateInboxWhere,
            ...branchScope,
          },
          include: {
            employee: { select: adjustmentEmployeeSelect },
            fromShift: {
              select: { id: true, name: true, startTime: true, endTime: true },
            },
            toShift: {
              select: { id: true, name: true, startTime: true, endTime: true },
            },
            status: { select: { id: true, code: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : listShiftMismatchRequestsRaw(ctx.organizationId, "SUBMITTED").then(
          (rows) => {
            if (ctx.allowedBranchIds == null) return rows;
            const allowed = new Set(ctx.allowedBranchIds);
            return rows.filter((row: { employee?: { branchId?: string | null } }) =>
              row.employee?.branchId
                ? allowed.has(row.employee.branchId)
                : false,
            );
          },
        ),
    import("@/lib/hr/services/salary-advances").then(({ listPendingSalaryAdvances }) =>
      listPendingSalaryAdvances(ctx).then((rows) =>
        rows.filter((row) => row.status === "SUBMITTED"),
      ),
    ).catch(() => []),
  ]);
  const leave = await enrichLeaveRowsWithShifts(leaveRows);
  return {
    leave: pendingFirstBySubmitted(leave),
    overtime: pendingFirstBySubmitted(overtimeRows),
    attendanceAdjustments: pendingFirstBySubmitted(adjustments),
    shiftMismatches: pendingFirstBySubmitted(shiftMismatches),
    advances: advanceRows,
  };
}
export async function resolveSelfEmployee(ctx: HrServiceContext, platformUserId?: string | null) {
  const employee = await db.employee.findFirst({ where: { organizationId: ctx.organizationId, OR: [{ platformUserId: platformUserId ?? undefined }, { authUserId: actor(ctx) ?? undefined }] } });
  if (!employee) throw new HrError("NOT_FOUND", { message: "บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลพนักงาน" });
  return employee;
}

function formatShiftClock(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 5);
  const hh = String(value.getUTCHours()).padStart(2, "0");
  const mm = String(value.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Published (or locked) assignments for the signed-in employee. */
export async function listMySchedule(ctx: HrServiceContext) {
  assertHrPermission(ctx, HR_PERMISSIONS.scheduleRead);
  const employee = await resolveSelfEmployee(ctx);
  const rows = await db.shiftAssignment.findMany({
    where: { employeeId: employee.id },
    include: {
      shift: {
        select: {
          name: true,
          startTime: true,
          endTime: true,
          crossesMidnight: true,
        },
      },
      coversForEmployee: {
        select: {
          id: true,
          displayName: true,
          firstNameTh: true,
          lastNameTh: true,
        },
      },
      schedulePeriod: {
        select: {
          id: true,
          name: true,
          periodStart: true,
          periodEnd: true,
          status: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: [{ workDate: "asc" }, { sequenceNo: "asc" }],
    take: 400,
  });

  const visibleStatuses = new Set(["PUBLISHED", "LOCKED"]);
  const visible = rows.filter((row: {
    schedulePeriod: { status: { code: string } };
  }) => visibleStatuses.has(row.schedulePeriod.status.code));

  const previousShiftIds = new Set<string>();
  for (const row of visible as Array<{ notes?: string | null }>) {
    const fromId = parseCoverFromShiftId(row.notes);
    if (fromId) previousShiftIds.add(fromId);
  }
  const previousShiftNameById = new Map<string, string>();
  if (previousShiftIds.size > 0) {
    const previousShifts = await db.shift.findMany({
      where: { id: { in: [...previousShiftIds] } },
      select: { id: true, name: true },
    });
    for (const shift of previousShifts as Array<{ id: string; name: string }>) {
      previousShiftNameById.set(shift.id, shift.name);
    }
  }

  return {
    pendingPublish: visible.length === 0 && rows.length > 0,
    assignments: visible.map(
      (row: {
        id: string;
        workDate: Date;
        isRestDay: boolean;
        isLeaveDay: boolean;
        notes?: string | null;
        coversForEmployee: {
          displayName: string;
          firstNameTh: string;
          lastNameTh: string;
        } | null;
        shift: {
          name: string;
          startTime: Date;
          endTime: Date;
          crossesMidnight: boolean;
        } | null;
        schedulePeriod: {
          id: string;
          name: string;
          periodStart: Date;
          periodEnd: Date;
          status: { code: string; name: string };
        };
      }) => {
        const startTime = formatShiftClock(row.shift?.startTime);
        const endTime = formatShiftClock(row.shift?.endTime);
        const coversForName = row.coversForEmployee
          ? row.coversForEmployee.displayName?.trim() ||
            `${row.coversForEmployee.firstNameTh} ${row.coversForEmployee.lastNameTh}`.trim()
          : null;
        const fromShiftId = parseCoverFromShiftId(row.notes);
        const previousShiftName = fromShiftId
          ? (previousShiftNameById.get(fromShiftId) ?? null)
          : null;
        return {
          id: row.id,
          workDate: toDateKey(row.workDate),
          isRestDay: row.isRestDay,
          isLeaveDay: row.isLeaveDay,
          coversForName,
          previousShiftName,
          isCoverDuty: Boolean(coversForName),
          shiftName: row.shift?.name ?? null,
          startTime,
          endTime,
          timeLabel:
            startTime && endTime
              ? `${startTime}–${endTime}${row.shift?.crossesMidnight ? " (+1)" : ""}`
              : null,
          periodId: row.schedulePeriod.id,
          periodName: row.schedulePeriod.name,
          periodStart: toDateKey(row.schedulePeriod.periodStart),
          periodEnd: toDateKey(row.schedulePeriod.periodEnd),
          statusCode: row.schedulePeriod.status.code,
          statusName: row.schedulePeriod.status.name,
        };
      },
    ),
  };
}

export async function selfService(ctx: HrServiceContext, area: string, platformUserId?: string | null) {
  const employee = await resolveSelfEmployee(ctx, platformUserId);
  if (area === "profile") return employee;
  if (area === "schedule") return listMySchedule(ctx);
  if (area === "attendance") return listSelfAttendanceToday(ctx);
  if (area === "leave") return db.leaveRequest.findMany({ where: { employeeId: employee.id }, orderBy: { createdAt: "desc" } });
  if (area === "overtime") return db.overtimeRequest.findMany({ where: { employeeId: employee.id }, orderBy: { createdAt: "desc" } });
  if (area === "payslips") return db.payslip.findMany({ where: { employeeId: employee.id }, orderBy: { createdAt: "desc" } });
  throw new HrError("NOT_FOUND");
}
