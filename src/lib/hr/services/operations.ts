/**
 * Phase 8C operational services.  These services deliberately use the HR
 * Prisma schema directly: the legacy repository only models the Phase 8B
 * tables and must not silently discard operational fields.
 */
import { prisma } from "@/lib/prisma";
import { assertHrPermission } from "@/lib/hr/authorize";
import { HrError } from "@/lib/hr/errors";
import { insideGeofence } from "@/lib/hr/geo";
import { calculateAttendanceDay } from "@/lib/hr/attendance-calc";
import { calculatePayroll } from "@/lib/hr/payroll-calc";
import { findOverlappingAssignments } from "@/lib/hr/schedule-conflicts";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { HrServiceContext } from "@/lib/hr/services/shared";
import {
  assertConfirmed,
  assertNoSelfApproval,
  assertPayrollMutable,
} from "@/lib/hr/services/operation-guards";

export { assertConfirmed, assertNoSelfApproval, assertPayrollMutable } from "@/lib/hr/services/operation-guards";

type Db = typeof prisma & Record<string, any>;
const db = prisma as Db;
const date = (value: string | Date) => new Date(value);
const actor = (ctx: HrServiceContext) => ctx.actorAuthUserId;

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
export async function createWorkLocation(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, HR_PERMISSIONS.locationManage);
  return db.workLocation.create({ data: { organizationId: ctx.organizationId, branchId: input.branchId, code: input.code.trim().toUpperCase(), name: input.name.trim(), latitude: input.latitude ?? null, longitude: input.longitude ?? null, geofenceRadiusMeters: input.geofenceRadiusMeters ?? 50, timezone: input.timezone ?? "Asia/Bangkok" } });
}
export async function updateWorkLocation(ctx: HrServiceContext, id: string, input: any) {
  assertHrPermission(ctx, HR_PERMISSIONS.locationManage); await owned("workLocation", ctx, id);
  return db.workLocation.update({ where: { id }, data: input });
}
export async function assignEmployeeWorkLocation(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, HR_PERMISSIONS.locationManage);
  await owned("employee", ctx, input.employeeId); await owned("workLocation", ctx, input.workLocationId);
  return db.employeeWorkLocation.create({ data: { ...input, effectiveFrom: date(input.effectiveFrom), effectiveTo: input.effectiveTo ? date(input.effectiveTo) : null } });
}

export async function listCalendars(ctx: HrServiceContext) {
  assertHrPermission(ctx, HR_PERMISSIONS.calendarManage);
  return db.workCalendar.findMany({ where: { organizationId: ctx.organizationId }, include: { holidays: true } });
}
export async function saveCalendar(ctx: HrServiceContext, input: any, id?: string) {
  assertHrPermission(ctx, HR_PERMISSIONS.calendarManage);
  const data = { ...input, organizationId: ctx.organizationId, workDays: input.workDays ?? [], branchId: input.branchId ?? null };
  if (!id) return db.workCalendar.create({ data });
  await owned("workCalendar", ctx, id); return db.workCalendar.update({ where: { id }, data });
}
export async function saveHoliday(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, HR_PERMISSIONS.calendarManage);
  return db.holiday.create({ data: { ...input, organizationId: ctx.organizationId, holidayDate: date(input.holidayDate), branchId: input.branchId ?? null, workCalendarId: input.workCalendarId ?? null } });
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

export async function createSchedulePeriod(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, HR_PERMISSIONS.scheduleManage);
  const draft = await master("schedulePeriodStatus", "DRAFT");
  return db.schedulePeriod.create({ data: { ...input, organizationId: ctx.organizationId, periodStart: date(input.periodStart), periodEnd: date(input.periodEnd), branchId: input.branchId ?? null, statusId: draft.id } });
}
export async function scheduleAction(ctx: HrServiceContext, id: string, input: any) {
  const period = await owned("schedulePeriod", ctx, id); const status = await db.schedulePeriodStatus.findUnique({ where: { id: period.statusId } });
  mutable(status?.code ?? "DRAFT"); assertConfirmed(input.confirm);
  if (input.action === "publish" || input.action === "unpublish" || input.action === "lock") {
    assertHrPermission(ctx, input.action === "publish" ? HR_PERMISSIONS.schedulePublish : HR_PERMISSIONS.scheduleManage);
    const code = input.action === "publish" ? "PUBLISHED" : input.action === "lock" ? "LOCKED" : "DRAFT";
    const next = await master("schedulePeriodStatus", code);
    return db.schedulePeriod.update({ where: { id }, data: { statusId: next.id, publishedAt: code === "PUBLISHED" ? new Date() : null, publishedByAuthUserId: code === "PUBLISHED" ? actor(ctx) : null, lockedAt: code === "LOCKED" ? new Date() : null, lockedByAuthUserId: code === "LOCKED" ? actor(ctx) : null } });
  }
  assertHrPermission(ctx, HR_PERMISSIONS.scheduleManage);
  if (input.action === "delete") return db.shiftAssignment.deleteMany({ where: { schedulePeriodId: id, ...(input.assignmentId ? { id: input.assignmentId } : { employeeId: input.employeeId, workDate: date(input.workDate) }) } });
  const employees: string[] = input.employeeIds ?? [input.employeeId];
  const dates: string[] = input.workDates ?? [input.workDate];
  const assignments = employees.flatMap(employeeId => dates.map(workDate => ({ schedulePeriodId: id, employeeId, workDate: date(workDate), shiftId: input.shiftId ?? null, workLocationId: input.workLocationId ?? null, isRestDay: !!input.isRestDay, isLeaveDay: !!input.isLeaveDay, createdByAuthUserId: actor(ctx) })));
  const existing = await db.shiftAssignment.findMany({ where: { employeeId: { in: employees }, workDate: { gte: period.periodStart, lte: period.periodEnd } }, include: { shift: true } });
  const conflicts = findOverlappingAssignments(existing.filter((x: any) => x.shift).map((x: any) => ({ id: x.id, workDate: x.workDate.toISOString().slice(0, 10), startTime: x.shift.startTime, endTime: x.shift.endTime, crossesMidnight: x.shift.crossesMidnight })));
  if (conflicts.length) throw new HrError("INVALID_SHIFT", { details: { conflicts } });
  await db.shiftAssignment.createMany({ data: assignments, skipDuplicates: true }); return { count: assignments.length };
}

export async function clock(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, HR_PERMISSIONS.attendanceSelf);
  const employee = await db.employee.findFirst({ where: { organizationId: ctx.organizationId, platformUserId: input.platformUserId ?? undefined, authUserId: actor(ctx) ?? undefined } });
  if (!employee) throw new HrError("NOT_FOUND", { message: "ไม่พบข้อมูลพนักงานที่เชื่อมต่อ" });
  const existing = await db.attendanceEvent.findFirst({ where: { employeeId: employee.id, idempotencyKey: input.idempotencyKey } }); if (existing) return existing;
  let distance: number | null = null;
  if (input.workLocationId) {
    const location = await owned("workLocation", ctx, input.workLocationId);
    if (location.latitude != null && location.longitude != null) {
      const check = insideGeofence({ latitude: Number(location.latitude), longitude: Number(location.longitude) }, input, location.geofenceRadiusMeters);
      distance = check.distanceMeters; if (!check.accepted) throw new HrError("FORBIDDEN", { message: "ตำแหน่งอยู่นอกพื้นที่ลงเวลา", details: { reason: check.reason } });
    }
  }
  const type = await master("attendanceEventType", input.action === "clockOut" ? "CLOCK_OUT" : input.action === "breakStart" ? "BREAK_START" : input.action === "breakEnd" ? "BREAK_END" : "CLOCK_IN");
  return db.attendanceEvent.create({ data: { organizationId: ctx.organizationId, branchId: employee.branchId, employeeId: employee.id, eventTypeId: type.id, occurredAt: new Date(), latitude: input.latitude ?? null, longitude: input.longitude ?? null, workLocationId: input.workLocationId ?? null, geofenceDistanceMeters: distance, idempotencyKey: input.idempotencyKey, source: "WEB" } });
}
export async function listAttendanceDays(ctx: HrServiceContext, input: any = {}) {
  assertHrPermission(ctx, [HR_PERMISSIONS.attendanceRead, HR_PERMISSIONS.attendanceSelf]);
  return db.attendanceDay.findMany({ where: { organizationId: ctx.organizationId, ...(input.employeeId ? { employeeId: input.employeeId } : {}), ...(input.from ? { workDate: { gte: date(input.from), lte: date(input.to ?? input.from) } } : {}) }, orderBy: { workDate: "desc" } });
}
export async function createAttendanceAdjustment(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, [HR_PERMISSIONS.attendanceSelf, HR_PERMISSIONS.attendanceManage]);
  const pending = await master("leaveRequestStatus", "PENDING");
  return db.attendanceAdjustment.create({ data: { ...input, organizationId: ctx.organizationId, workDate: date(input.workDate), requestedClockInAt: input.requestedClockInAt ? date(input.requestedClockInAt) : null, requestedClockOutAt: input.requestedClockOutAt ? date(input.requestedClockOutAt) : null, statusId: pending.id, requestedByAuthUserId: actor(ctx)! } });
}

export async function submitLeave(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, [HR_PERMISSIONS.leaveSelf, HR_PERMISSIONS.leaveManage]);
  const pending = await master("leaveRequestStatus", "PENDING");
  const overlap = await db.leaveRequest.findFirst({ where: { employeeId: input.employeeId, status: { code: { in: ["PENDING", "APPROVED"] } }, startDate: { lte: date(input.endDate) }, endDate: { gte: date(input.startDate) } } });
  if (overlap) throw new HrError("VALIDATION_ERROR", { message: "วันลาซ้อนทับกับคำขอเดิม" });
  return db.leaveRequest.create({ data: { ...input, organizationId: ctx.organizationId, startDate: date(input.startDate), endDate: date(input.endDate), statusId: pending.id, submittedAt: new Date() } });
}
export async function reviewLeave(ctx: HrServiceContext, id: string, approve: boolean, note?: string) {
  assertHrPermission(ctx, HR_PERMISSIONS.leaveApprove); const row = await owned("leaveRequest", ctx, id); assertNoSelfApproval(row.employee?.authUserId, actor(ctx)!);
  const status = await master("leaveRequestStatus", approve ? "APPROVED" : "REJECTED");
  return db.leaveRequest.update({ where: { id }, data: { statusId: status.id, reviewedAt: new Date(), reviewedByAuthUserId: actor(ctx), reviewNote: note ?? null } });
}
export async function submitOvertime(ctx: HrServiceContext, input: any) {
  assertHrPermission(ctx, [HR_PERMISSIONS.overtimeSelf, HR_PERMISSIONS.overtimeManage]);
  const pending = await master("overtimeRequestStatus", "PENDING");
  return db.overtimeRequest.create({ data: { ...input, organizationId: ctx.organizationId, workDate: date(input.workDate), startAt: date(input.startAt), endAt: date(input.endAt), requestedMinutes: Math.max(0, Math.round((date(input.endAt).getTime() - date(input.startAt).getTime()) / 60000)), statusId: pending.id, submittedAt: new Date() } });
}
export async function reviewOvertime(ctx: HrServiceContext, id: string, approve: boolean, note?: string) {
  assertHrPermission(ctx, HR_PERMISSIONS.overtimeApprove); const status = await master("overtimeRequestStatus", approve ? "APPROVED" : "REJECTED");
  return db.overtimeRequest.update({ where: { id }, data: { statusId: status.id, reviewedAt: new Date(), reviewedByAuthUserId: actor(ctx), reviewNote: note ?? null } });
}

export async function createPayrollRun(ctx: HrServiceContext, payrollPeriodId: string) {
  assertHrPermission(ctx, HR_PERMISSIONS.payrollCalculate); await owned("payrollPeriod", ctx, payrollPeriodId);
  const count = await db.payrollRun.count({ where: { payrollPeriodId } }); const draft = await master("payrollPeriodStatus", "DRAFT");
  return db.payrollRun.create({ data: { organizationId: ctx.organizationId, payrollPeriodId, runNumber: count + 1, statusId: draft.id, createdByAuthUserId: actor(ctx)! } });
}
export async function payrollAction(ctx: HrServiceContext, id: string, action: string) {
  const run = await owned("payrollRun", ctx, id); const status = await db.payrollPeriodStatus.findUnique({ where: { id: run.statusId } });
  if (action === "calculate") {
    assertHrPermission(ctx, HR_PERMISSIONS.payrollCalculate); assertPayrollMutable(status?.code ?? "");
    const employees = await db.employee.findMany({ where: { organizationId: ctx.organizationId, isActive: true }, include: { compensations: { where: { isCurrent: true }, include: { wageType: true } } } });
    const review = await master("payrollPeriodStatus", "REVIEW");
    await db.$transaction(async (tx: any) => { await tx.payrollRunEmployee.deleteMany({ where: { payrollRunId: id } }); for (const employee of employees) { const compensation = employee.compensations[0]; if (!compensation) continue; const calc = calculatePayroll({ wageType: compensation.wageType.code as "DAILY" | "MONTHLY" | "HOURLY", wageAmount: Number(compensation.amount) }); await tx.payrollRunEmployee.create({ data: { payrollRunId: id, employeeId: employee.id, grossEarnings: calc.gross, totalDeductions: calc.deductions, netPay: calc.net, statusId: review.id, calculatedAt: new Date(), items: { create: calc.lines.map(line => ({ sourceType: "CALCULATED", description: line.description, amount: line.amount })) } } }); } });
    return db.payrollRun.update({ where: { id }, data: { statusId: review.id, completedAt: new Date() } });
  }
  const requirements: Record<string, any> = { review: HR_PERMISSIONS.payrollReview, approve: HR_PERMISSIONS.payrollApprove, markPaid: HR_PERMISSIONS.payrollMarkPaid, lock: HR_PERMISSIONS.payrollLock };
  assertHrPermission(ctx, requirements[action]); const code = action === "markPaid" ? "PAID" : action === "lock" ? "LOCKED" : action === "approve" ? "APPROVED" : "REVIEW"; const next = await master("payrollPeriodStatus", code);
  return db.payrollRun.update({ where: { id }, data: { statusId: next.id, ...(action === "approve" ? { approvedAt: new Date(), approvedByAuthUserId: actor(ctx) } : {}) } });
}
export async function issuePayslips(ctx: HrServiceContext, runId: string) {
  assertHrPermission(ctx, HR_PERMISSIONS.payslipRead); const run = await owned("payrollRun", ctx, runId); const status = await db.payrollPeriodStatus.findUnique({ where: { id: run.statusId } }); if (!["APPROVED", "PAID", "LOCKED"].includes(status?.code ?? "")) throw new HrError("INVALID_STATUS_TRANSITION");
  const rows = await db.payrollRunEmployee.findMany({ where: { payrollRunId: runId }, include: { items: true } });
  await db.$transaction(rows.map((row: any) => db.payslip.upsert({ where: { payrollRunEmployeeId: row.id }, create: { payrollRunEmployeeId: row.id, employeeId: row.employeeId, issuedAt: new Date(), issuedByAuthUserId: actor(ctx), grossEarnings: row.grossEarnings, totalDeductions: row.totalDeductions, netPay: row.netPay, snapshot: { employeeId: row.employeeId, items: row.items, gross: row.grossEarnings, deductions: row.totalDeductions, net: row.netPay } }, update: {} }))); return { count: rows.length };
}

export async function createNotification(ctx: HrServiceContext, input: any) {
  const pending = await master("notificationStatus", "PENDING");
  const notification = await db.notification.create({ data: { ...input, organizationId: ctx.organizationId, statusId: pending.id } });
  await db.notificationOutbox.create({ data: { notificationId: notification.id, statusId: pending.id, payload: { notificationId: notification.id } } });
  return notification;
}
export async function listNotifications(ctx: HrServiceContext) {
  return db.notification.findMany({ where: { organizationId: ctx.organizationId, recipientAuthUserId: actor(ctx) }, orderBy: { createdAt: "desc" } });
}
export async function markNotificationRead(ctx: HrServiceContext, id: string) {
  return db.notification.updateMany({ where: { id, organizationId: ctx.organizationId, recipientAuthUserId: actor(ctx) }, data: { readAt: new Date() } });
}
export async function report(ctx: HrServiceContext, kind: string, input: any = {}) {
  assertHrPermission(ctx, HR_PERMISSIONS.reportRead);
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
export async function approvalInbox(ctx: HrServiceContext) {
  assertHrPermission(ctx, HR_PERMISSIONS.approvalRead);
  const [leave, overtime, adjustments] = await Promise.all([
    db.leaveRequest.findMany({ where: { organizationId: ctx.organizationId, status: { code: "PENDING" } } }),
    db.overtimeRequest.findMany({ where: { organizationId: ctx.organizationId, status: { code: "PENDING" } } }),
    db.attendanceAdjustment.findMany({ where: { organizationId: ctx.organizationId, status: { code: "PENDING" } } }),
  ]);
  return { leave, overtime, attendanceAdjustments: adjustments };
}
export async function resolveSelfEmployee(ctx: HrServiceContext, platformUserId?: string | null) {
  const employee = await db.employee.findFirst({ where: { organizationId: ctx.organizationId, OR: [{ platformUserId: platformUserId ?? undefined }, { authUserId: actor(ctx) ?? undefined }] } });
  if (!employee) throw new HrError("NOT_FOUND", { message: "บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลพนักงาน" });
  return employee;
}
export async function selfService(ctx: HrServiceContext, area: string, platformUserId?: string | null) {
  const employee = await resolveSelfEmployee(ctx, platformUserId);
  if (area === "profile") return employee;
  if (area === "schedule") return db.shiftAssignment.findMany({ where: { employeeId: employee.id }, include: { shift: true }, orderBy: { workDate: "desc" } });
  if (area === "attendance") return db.attendanceDay.findMany({ where: { employeeId: employee.id }, orderBy: { workDate: "desc" } });
  if (area === "leave") return db.leaveRequest.findMany({ where: { employeeId: employee.id }, orderBy: { createdAt: "desc" } });
  if (area === "overtime") return db.overtimeRequest.findMany({ where: { employeeId: employee.id }, orderBy: { createdAt: "desc" } });
  if (area === "payslips") return db.payslip.findMany({ where: { employeeId: employee.id }, orderBy: { createdAt: "desc" } });
  throw new HrError("NOT_FOUND");
}
