/**
 * HR dashboard aggregates for OWNER/ADMIN command center.
 * Headcount + action queue (approvals, attendance exceptions, drafts, payroll).
 */
import { prisma } from "@/lib/prisma";
import { assertHrPermission, hrCan } from "@/lib/hr/authorize";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type {
  HrRepository,
  PayrollPeriodRecord,
} from "@/lib/hr/repository/types";
import { findCurrentOpenPeriod } from "@/lib/hr/services/payroll-periods";
import {
  resolveBranchScope,
  type HrServiceContext,
} from "@/lib/hr/services/shared";

export type DashboardCount = {
  id: string;
  code?: string;
  label?: string;
  count: number;
};

export type DashboardInboxItem = {
  id: string;
  kind: "leave" | "overtime" | "attendance_adjustment";
  label: string;
  employeeName: string;
  submittedAt: string | null;
  href: string;
};

export type DashboardActions = {
  pendingLeave: number;
  pendingOvertime: number;
  pendingAttendanceAdjustments: number;
  attendanceExceptionsToday: number;
  missingClockOutToday: number;
  draftSchedules: number;
  payrollWarnings: number;
  probationEndingSoon: number;
};

export type HrDashboardSummary = {
  organizationId: string;
  branchId: string | null;
  activeEmployees: {
    total: number;
    byBranch: DashboardCount[];
    byEmploymentType: DashboardCount[];
  };
  activeShifts: number;
  currentOpenPeriod: PayrollPeriodRecord | null;
  actions: DashboardActions;
  recentInbox: DashboardInboxItem[];
};

function bangkokTodayIso(at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d! + days));
  return utc.toISOString().slice(0, 10);
}

function toDateOnlyUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function employeeBranchWhere(branchId: string | null) {
  return branchId ? { employee: { branchId } } : {};
}

async function loadActionCounts(
  ctx: HrServiceContext,
  branchId: string | null,
  currentOpenPeriod: PayrollPeriodRecord | null,
): Promise<{ actions: DashboardActions; recentInbox: DashboardInboxItem[] }> {
  const emptyActions: DashboardActions = {
    pendingLeave: 0,
    pendingOvertime: 0,
    pendingAttendanceAdjustments: 0,
    attendanceExceptionsToday: 0,
    missingClockOutToday: 0,
    draftSchedules: 0,
    payrollWarnings: 0,
    probationEndingSoon: 0,
  };
  if (!process.env.DATABASE_URL) {
    return { actions: emptyActions, recentInbox: [] };
  }

  const todayIso = bangkokTodayIso();
  const today = toDateOnlyUtc(todayIso);
  const probationUntil = toDateOnlyUtc(addDaysIso(todayIso, 30));
  const orgId = ctx.organizationId;
  const branchEmployeeFilter = employeeBranchWhere(branchId);

  const canSeeApprovals = hrCan(ctx, [
    HR_PERMISSIONS.approvalRead,
    HR_PERMISSIONS.leaveApprove,
    HR_PERMISSIONS.overtimeApprove,
  ]);
  const canSeeAttendance = hrCan(ctx, [
    HR_PERMISSIONS.attendanceRead,
    HR_PERMISSIONS.attendanceManage,
  ]);
  const canSeeSchedule = hrCan(ctx, [
    HR_PERMISSIONS.scheduleRead,
    HR_PERMISSIONS.scheduleManage,
  ]);

  const [
    pendingLeave,
    pendingOvertime,
    pendingAdjustments,
    exceptionCount,
    missingClockOut,
    draftSchedules,
    probationEndingSoon,
    leaveInbox,
    otInbox,
    adjInbox,
  ] = await Promise.all([
    canSeeApprovals
      ? prisma.leaveRequest.count({
          where: {
            organizationId: orgId,
            status: { code: "SUBMITTED" },
            ...branchEmployeeFilter,
          },
        })
      : Promise.resolve(0),
    canSeeApprovals
      ? prisma.overtimeRequest.count({
          where: {
            organizationId: orgId,
            status: { code: "SUBMITTED" },
            ...branchEmployeeFilter,
          },
        })
      : Promise.resolve(0),
    canSeeApprovals
      ? prisma.attendanceAdjustment.count({
          where: {
            organizationId: orgId,
            status: { code: "SUBMITTED" },
            ...(branchId
              ? { employee: { branchId } }
              : {}),
          },
        })
      : Promise.resolve(0),
    canSeeAttendance
      ? prisma.attendanceDay.count({
          where: {
            organizationId: orgId,
            workDate: today,
            ...(branchId ? { branchId } : {}),
            status: {
              code: {
                in: [
                  "LATE",
                  "ABSENT",
                  "MISSING_CLOCK_OUT",
                  "MISSING_CLOCK_IN",
                  "INCOMPLETE",
                ],
              },
            },
          },
        })
      : Promise.resolve(0),
    canSeeAttendance
      ? prisma.attendanceDay.count({
          where: {
            organizationId: orgId,
            workDate: today,
            ...(branchId ? { branchId } : {}),
            status: { code: "MISSING_CLOCK_OUT" },
          },
        })
      : Promise.resolve(0),
    canSeeSchedule
      ? prisma.schedulePeriod.count({
          where: {
            organizationId: orgId,
            status: { code: "DRAFT" },
            ...(branchId ? { branchId } : {}),
          },
        })
      : Promise.resolve(0),
    prisma.employee.count({
      where: {
        organizationId: orgId,
        isActive: true,
        ...(branchId ? { branchId } : {}),
        probationEndDate: { gte: today, lte: probationUntil },
      },
    }),
    canSeeApprovals
      ? prisma.leaveRequest.findMany({
          where: {
            organizationId: orgId,
            status: { code: "SUBMITTED" },
            ...branchEmployeeFilter,
          },
          include: {
            employee: { select: { displayName: true, firstNameTh: true, lastNameTh: true } },
            leaveType: { select: { name: true } },
          },
          orderBy: { submittedAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    canSeeApprovals
      ? prisma.overtimeRequest.findMany({
          where: {
            organizationId: orgId,
            status: { code: "SUBMITTED" },
            ...branchEmployeeFilter,
          },
          include: {
            employee: { select: { displayName: true, firstNameTh: true, lastNameTh: true } },
          },
          orderBy: { submittedAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    canSeeApprovals
      ? prisma.attendanceAdjustment.findMany({
          where: {
            organizationId: orgId,
            status: { code: "SUBMITTED" },
            ...(branchId ? { employee: { branchId } } : {}),
          },
          include: {
            employee: { select: { displayName: true, firstNameTh: true, lastNameTh: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  let payrollWarnings = 0;
  if (currentOpenPeriod && hrCan(ctx, HR_PERMISSIONS.payrollRead)) {
    const status = await prisma.payrollPeriodStatus.findUnique({
      where: { id: currentOpenPeriod.statusId },
      select: { code: true },
    });
    const code = status?.code ?? "";
    const paymentIso = currentOpenPeriod.paymentDate.toISOString().slice(0, 10);
    const withinWeek =
      paymentIso >= todayIso && paymentIso <= addDaysIso(todayIso, 7);
    if (code === "CALCULATING" || code === "REVIEW" || withinWeek) {
      payrollWarnings = 1;
    }
  }

  type NameRow = {
    displayName: string;
    firstNameTh: string;
    lastNameTh: string;
  };
  const personName = (employee: NameRow | null | undefined) =>
    employee?.displayName?.trim() ||
    `${employee?.firstNameTh ?? ""} ${employee?.lastNameTh ?? ""}`.trim() ||
    "—";

  const recentInbox: DashboardInboxItem[] = [
    ...(leaveInbox as Array<{
      id: string;
      submittedAt: Date | null;
      leaveType: { name: string };
      employee: NameRow;
    }>).map((row) => ({
      id: row.id,
      kind: "leave" as const,
      label: `ลา · ${row.leaveType.name}`,
      employeeName: personName(row.employee),
      submittedAt: row.submittedAt?.toISOString() ?? null,
      href: "/hr/leave",
    })),
    ...(otInbox as Array<{
      id: string;
      submittedAt: Date | null;
      employee: NameRow;
    }>).map((row) => ({
      id: row.id,
      kind: "overtime" as const,
      label: "OT",
      employeeName: personName(row.employee),
      submittedAt: row.submittedAt?.toISOString() ?? null,
      href: "/hr/overtime",
    })),
    ...(adjInbox as Array<{
      id: string;
      createdAt: Date;
      employee: NameRow | null;
    }>).map((row) => ({
      id: row.id,
      kind: "attendance_adjustment" as const,
      label: "ปรับเวลาลงเวลา",
      employeeName: personName(row.employee),
      submittedAt: row.createdAt.toISOString(),
      href: "/hr/approvals",
    })),
  ]
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))
    .slice(0, 5);

  return {
    actions: {
      pendingLeave,
      pendingOvertime,
      pendingAttendanceAdjustments: pendingAdjustments,
      attendanceExceptionsToday: exceptionCount,
      missingClockOutToday: missingClockOut,
      draftSchedules,
      payrollWarnings,
      probationEndingSoon,
    },
    recentInbox,
  };
}

export async function getHrDashboard(
  repository: HrRepository,
  ctx: HrServiceContext,
  input: { branchId?: string | null } = {},
): Promise<HrDashboardSummary> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeRead);

  const requested = String(input.branchId ?? "").trim() || null;
  const scope = resolveBranchScope(ctx, requested);
  const branchId = scope.branchId;

  const [counts, activeShifts, employmentTypes, currentOpenPeriod] =
    await Promise.all([
      repository.employees.countActive(ctx.organizationId),
      repository.shifts.countActive(ctx.organizationId),
      repository.masters.list("employmentType"),
      findCurrentOpenPeriod(repository, ctx.organizationId),
    ]);

  const allowed = scope.branchIds;
  let branchEntries = Object.entries(counts.byBranchId).filter(([id]) =>
    allowed == null ? true : allowed.includes(id),
  );
  if (branchId) {
    branchEntries = branchEntries.filter(([id]) => id === branchId);
  }

  let actions: DashboardActions;
  let recentInbox: DashboardInboxItem[];
  try {
    ({ actions, recentInbox } = await loadActionCounts(
      ctx,
      branchId,
      currentOpenPeriod,
    ));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[hr/dashboard] action counts failed", error);
    }
    actions = {
      pendingLeave: 0,
      pendingOvertime: 0,
      pendingAttendanceAdjustments: 0,
      attendanceExceptionsToday: 0,
      missingClockOutToday: 0,
      draftSchedules: 0,
      payrollWarnings: 0,
      probationEndingSoon: 0,
    };
    recentInbox = [];
  }

  return {
    organizationId: ctx.organizationId,
    branchId,
    activeEmployees: {
      total: branchEntries.reduce((sum, [, count]) => sum + count, 0),
      byBranch: branchEntries
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
      byEmploymentType: employmentTypes.map((type) => ({
        id: type.id,
        code: type.code,
        label: type.nameTh,
        count: counts.byEmploymentTypeId[type.id] ?? 0,
      })),
    },
    activeShifts,
    currentOpenPeriod,
    actions,
    recentInbox,
  };
}
