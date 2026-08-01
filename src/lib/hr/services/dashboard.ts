/**
 * HR dashboard aggregates for OWNER/ADMIN command center.
 * Headcount + action queue (approvals, attendance exceptions, drafts, payroll).
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { assertHrPermission, hrCan } from "@/lib/hr/authorize";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type {
  HrRepository,
  PayrollPeriodRecord,
} from "@/lib/hr/repository/types";
import { findCurrentOpenPeriod } from "@/lib/hr/services/payroll-periods";
import {
  normalizePagination,
  resolveBranchScope,
  toPagedResponse,
  type HrServiceContext,
  type PageRequest,
  type PagedResponse,
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
  branchId: string | null;
  /** Filled by data layer from Platform branch list when available. */
  branchName?: string;
  submittedAt: string | null;
  href: string;
};

/** Recently approved/rejected items for org executives (who approved). */
export type DashboardDecisionItem = {
  id: string;
  kind: "leave" | "overtime" | "attendance_adjustment" | "shift_mismatch";
  label: string;
  employeeName: string;
  branchId: string | null;
  /** Filled by data layer from Platform branch list when available. */
  branchName?: string;
  decision: "APPROVED" | "REJECTED";
  reviewedByName: string;
  reviewedAt: string | null;
  href: string;
};

export type DashboardActions = {
  pendingLeave: number;
  pendingOvertime: number;
  pendingAttendanceAdjustments: number;
  pendingAdvances: number;
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
  recentDecisions: DashboardDecisionItem[];
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

function approvalEmployeeFilter(
  ctx: HrServiceContext,
  branchId: string | null,
) {
  if (branchId) return { employee: { branchId } };
  if (ctx.allowedBranchIds != null) {
    return { employee: { branchId: { in: [...ctx.allowedBranchIds] } } };
  }
  return {};
}

async function loadActionCounts(
  ctx: HrServiceContext,
  branchId: string | null,
  currentOpenPeriod: PayrollPeriodRecord | null,
): Promise<{
  actions: DashboardActions;
  recentInbox: DashboardInboxItem[];
  recentDecisions: DashboardDecisionItem[];
}> {
  const emptyActions: DashboardActions = {
    pendingLeave: 0,
    pendingOvertime: 0,
    pendingAttendanceAdjustments: 0,
    pendingAdvances: 0,
    attendanceExceptionsToday: 0,
    missingClockOutToday: 0,
    draftSchedules: 0,
    payrollWarnings: 0,
    probationEndingSoon: 0,
  };
  if (!process.env.DATABASE_URL) {
    return { actions: emptyActions, recentInbox: [], recentDecisions: [] };
  }

  const todayIso = bangkokTodayIso();
  const today = toDateOnlyUtc(todayIso);
  const probationUntil = toDateOnlyUtc(addDaysIso(todayIso, 30));
  const orgId = ctx.organizationId;
  const branchEmployeeFilter = approvalEmployeeFilter(ctx, branchId);

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
  const canSeeAdvances = hrCan(ctx, [
    HR_PERMISSIONS.advanceApprove,
    HR_PERMISSIONS.payrollManage,
    HR_PERMISSIONS.approvalRead,
  ]);

  const [
    pendingLeave,
    pendingOvertime,
    pendingAdjustments,
    pendingAdvances,
    exceptionCount,
    missingClockOut,
    draftSchedules,
    probationEndingSoon,
    leaveInbox,
    otInbox,
    adjInbox,
    leaveDecisions,
    otDecisions,
    adjDecisions,
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
            ...branchEmployeeFilter,
          },
        })
      : Promise.resolve(0),
    canSeeAdvances
      ? (async () => {
          const branchClause = branchId
            ? prisma.$queryRaw<Array<{ c: number }>>`
                SELECT COUNT(*)::int AS c
                FROM hr.salary_advances a
                JOIN hr.employees e ON e.id = a.employee_id
                WHERE a.organization_id = ${orgId}::uuid
                  AND a.status = 'SUBMITTED'
                  AND e.branch_id = ${branchId}::uuid
              `
            : ctx.allowedBranchIds != null
              ? prisma.$queryRaw<Array<{ c: number }>>`
                  SELECT COUNT(*)::int AS c
                  FROM hr.salary_advances a
                  JOIN hr.employees e ON e.id = a.employee_id
                  WHERE a.organization_id = ${orgId}::uuid
                    AND a.status = 'SUBMITTED'
                    AND e.branch_id = ANY(${ctx.allowedBranchIds}::uuid[])
                `
              : prisma.$queryRaw<Array<{ c: number }>>`
                  SELECT COUNT(*)::int AS c
                  FROM hr.salary_advances a
                  WHERE a.organization_id = ${orgId}::uuid
                    AND a.status = 'SUBMITTED'
                `;
          const rows = await branchClause;
          return Number(rows[0]?.c ?? 0);
        })()
      : Promise.resolve(0),
    canSeeAttendance
      ? prisma.attendanceDay.count({
          where: {
            organizationId: orgId,
            workDate: today,
            ...(branchId
              ? { branchId }
              : ctx.allowedBranchIds != null
                ? { branchId: { in: [...ctx.allowedBranchIds] } }
                : {}),
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
            ...(branchId
              ? { branchId }
              : ctx.allowedBranchIds != null
                ? { branchId: { in: [...ctx.allowedBranchIds] } }
                : {}),
            status: { code: "MISSING_CLOCK_OUT" },
          },
        })
      : Promise.resolve(0),
    canSeeSchedule
      ? prisma.schedulePeriod.count({
          where: {
            organizationId: orgId,
            status: { code: "DRAFT" },
            ...(branchId
              ? { branchId }
              : ctx.allowedBranchIds != null
                ? { branchId: { in: [...ctx.allowedBranchIds] } }
                : {}),
          },
        })
      : Promise.resolve(0),
    prisma.employee.count({
      where: {
        organizationId: orgId,
        isActive: true,
        ...(branchId
          ? { branchId }
          : ctx.allowedBranchIds != null
            ? { branchId: { in: [...ctx.allowedBranchIds] } }
            : {}),
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
            employee: {
              select: {
                displayName: true,
                firstNameTh: true,
                lastNameTh: true,
                branchId: true,
              },
            },
            leaveType: { select: { name: true } },
          },
          orderBy: { submittedAt: "desc" },
          take: 12,
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
            employee: {
              select: {
                displayName: true,
                firstNameTh: true,
                lastNameTh: true,
                branchId: true,
              },
            },
          },
          orderBy: { submittedAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
    canSeeApprovals
      ? prisma.attendanceAdjustment.findMany({
          where: {
            organizationId: orgId,
            status: { code: "SUBMITTED" },
            ...branchEmployeeFilter,
          },
          include: {
            employee: {
              select: {
                displayName: true,
                firstNameTh: true,
                lastNameTh: true,
                branchId: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
    canSeeApprovals
      ? prisma.leaveRequest.findMany({
          where: {
            organizationId: orgId,
            status: { code: { in: ["APPROVED", "REJECTED"] } },
            ...branchEmployeeFilter,
          },
          include: {
            employee: {
              select: {
                displayName: true,
                firstNameTh: true,
                lastNameTh: true,
                branchId: true,
              },
            },
            leaveType: { select: { name: true } },
            status: { select: { code: true } },
          },
          orderBy: { reviewedAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
    canSeeApprovals
      ? prisma.overtimeRequest.findMany({
          where: {
            organizationId: orgId,
            status: { code: { in: ["APPROVED", "REJECTED"] } },
            ...branchEmployeeFilter,
          },
          include: {
            employee: {
              select: {
                displayName: true,
                firstNameTh: true,
                lastNameTh: true,
                branchId: true,
              },
            },
            status: { select: { code: true } },
          },
          orderBy: { reviewedAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
    canSeeApprovals
      ? prisma.attendanceAdjustment.findMany({
          where: {
            organizationId: orgId,
            status: { code: { in: ["APPROVED", "REJECTED"] } },
            ...branchEmployeeFilter,
          },
          include: {
            employee: {
              select: {
                displayName: true,
                firstNameTh: true,
                lastNameTh: true,
                branchId: true,
              },
            },
            status: { select: { code: true } },
          },
          orderBy: { reviewedAt: "desc" },
          take: 12,
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
    branchId?: string | null;
  };
  const personName = (employee: NameRow | null | undefined) =>
    employee?.displayName?.trim() ||
    `${employee?.firstNameTh ?? ""} ${employee?.lastNameTh ?? ""}`.trim() ||
    "—";
  const employeeBranchId = (employee: NameRow | null | undefined) =>
    employee?.branchId?.trim() || null;

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
      branchId: employeeBranchId(row.employee),
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
      branchId: employeeBranchId(row.employee),
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
      branchId: employeeBranchId(row.employee),
      submittedAt: row.createdAt.toISOString(),
      href: "/hr/approvals",
    })),
  ]
    .sort((a, b) => {
      const branchCmp = (a.branchId ?? "").localeCompare(b.branchId ?? "");
      if (branchCmp !== 0) return branchCmp;
      return (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "");
    })
    .slice(0, 8);

  type DecisionRow = {
    id: string;
    reviewedAt: Date | null;
    reviewedByName?: string | null;
    status?: { code?: string | null } | null;
    leaveType?: { name: string } | null;
    employee: NameRow | null;
  };

  async function loadReviewerNames(
    table:
      | "leave_requests"
      | "overtime_requests"
      | "attendance_adjustments",
    ids: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;
    const idList = Prisma.join(
      ids.map((id) => Prisma.sql`${id}::uuid`),
    );
    try {
      const rows =
        table === "leave_requests"
          ? await prisma.$queryRaw<Array<{ id: string; reviewed_by_name: string | null }>>`
              SELECT id::text AS id, reviewed_by_name
              FROM hr.leave_requests
              WHERE id IN (${idList})
            `
          : table === "overtime_requests"
            ? await prisma.$queryRaw<Array<{ id: string; reviewed_by_name: string | null }>>`
                SELECT id::text AS id, reviewed_by_name
                FROM hr.overtime_requests
                WHERE id IN (${idList})
              `
            : await prisma.$queryRaw<Array<{ id: string; reviewed_by_name: string | null }>>`
                SELECT id::text AS id, reviewed_by_name
                FROM hr.attendance_adjustments
                WHERE id IN (${idList})
              `;
      for (const row of rows) {
        if (row.reviewed_by_name?.trim()) {
          map.set(row.id, row.reviewed_by_name.trim());
        }
      }
    } catch {
      // Column missing or Prisma param mismatch — leave names empty.
    }
    return map;
  }

  const [leaveNames, otNames, adjNames] = await Promise.all([
    loadReviewerNames(
      "leave_requests",
      (leaveDecisions as DecisionRow[]).map((row) => row.id),
    ),
    loadReviewerNames(
      "overtime_requests",
      (otDecisions as DecisionRow[]).map((row) => row.id),
    ),
    loadReviewerNames(
      "attendance_adjustments",
      (adjDecisions as DecisionRow[]).map((row) => row.id),
    ),
  ]);

  const decisionOf = (
    row: DecisionRow,
    kind: DashboardDecisionItem["kind"],
    label: string,
    names: Map<string, string>,
  ): DashboardDecisionItem | null => {
    const code = row.status?.code;
    if (code !== "APPROVED" && code !== "REJECTED") return null;
    return {
      id: row.id,
      kind,
      label,
      employeeName: personName(row.employee),
      branchId: employeeBranchId(row.employee),
      decision: code,
      reviewedByName:
        names.get(row.id) || row.reviewedByName?.trim() || "—",
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      href: "/hr/approvals",
    };
  };

  const recentDecisions: DashboardDecisionItem[] = [
    ...(leaveDecisions as DecisionRow[])
      .map((row) =>
        decisionOf(
          row,
          "leave",
          `ลา · ${row.leaveType?.name ?? "—"}`,
          leaveNames,
        ),
      )
      .filter((row): row is DashboardDecisionItem => row != null),
    ...(otDecisions as DecisionRow[])
      .map((row) => decisionOf(row, "overtime", "OT", otNames))
      .filter((row): row is DashboardDecisionItem => row != null),
    ...(adjDecisions as DecisionRow[])
      .map((row) =>
        decisionOf(row, "attendance_adjustment", "ปรับเวลาลงเวลา", adjNames),
      )
      .filter((row): row is DashboardDecisionItem => row != null),
  ]
    .sort((a, b) => {
      const branchCmp = (a.branchId ?? "").localeCompare(b.branchId ?? "");
      if (branchCmp !== 0) return branchCmp;
      return (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? "");
    })
    .slice(0, 12);

  return {
    actions: {
      pendingLeave,
      pendingOvertime,
      pendingAttendanceAdjustments: pendingAdjustments,
      pendingAdvances,
      attendanceExceptionsToday: exceptionCount,
      missingClockOutToday: missingClockOut,
      draftSchedules,
      payrollWarnings,
      probationEndingSoon,
    },
    recentInbox,
    recentDecisions,
  };
}

export async function getHrDashboard(
  repository: HrRepository,
  ctx: HrServiceContext,
  input: { branchId?: string | null } = {},
): Promise<HrDashboardSummary> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.employeeRead,
    HR_PERMISSIONS.approvalRead,
    HR_PERMISSIONS.leaveApprove,
    HR_PERMISSIONS.overtimeApprove,
    HR_PERMISSIONS.attendanceRead,
  ]);

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
  let recentDecisions: DashboardDecisionItem[];
  try {
    ({ actions, recentInbox, recentDecisions } = await loadActionCounts(
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
      pendingAdvances: 0,
      attendanceExceptionsToday: 0,
      missingClockOutToday: 0,
      draftSchedules: 0,
      payrollWarnings: 0,
      probationEndingSoon: 0,
    };
    recentInbox = [];
    recentDecisions = [];
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
    recentDecisions,
  };
}

type HistorySqlRow = {
  id: string;
  kind: DashboardDecisionItem["kind"];
  label: string;
  employee_name: string;
  branch_id: string | null;
  decision: "APPROVED" | "REJECTED";
  reviewed_by_name: string | null;
  reviewed_at: Date | null;
};

function branchScopeSql(
  scope: { branchIds: readonly string[] | null; branchId: string | null },
): Prisma.Sql {
  if (scope.branchId) {
    return Prisma.sql`AND e.branch_id = ${scope.branchId}::uuid`;
  }
  if (scope.branchIds != null) {
    if (scope.branchIds.length === 0) {
      return Prisma.sql`AND FALSE`;
    }
    return Prisma.sql`AND e.branch_id IN (${Prisma.join(
      scope.branchIds.map((id) => Prisma.sql`${id}::uuid`),
    )})`;
  }
  return Prisma.empty;
}

/**
 * Paginated approval history (approved/rejected), sorted by branch then date.
 * Uses SQL UNION so large orgs do not load the full set into memory.
 */
export async function listApprovalHistory(
  ctx: HrServiceContext,
  input: PageRequest & { branchId?: string | null } = {},
): Promise<PagedResponse<DashboardDecisionItem>> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.approvalRead,
    HR_PERMISSIONS.leaveApprove,
    HR_PERMISSIONS.overtimeApprove,
  ]);

  const pagination = normalizePagination({
    ...input,
    pageSize: input.pageSize ?? 10,
  });
  const requested = String(input.branchId ?? "").trim() || null;
  const scope = resolveBranchScope(ctx, requested);
  const branchSql = branchScopeSql(scope);
  const orgId = ctx.organizationId;
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  if (!process.env.DATABASE_URL) {
    return toPagedResponse({ rows: [], total: 0 }, pagination);
  }

  // History = decided items whose event/leave date is already past (Bangkok today).
  const combined = Prisma.sql`
    (
      SELECT
        lr.id::text AS id,
        'leave'::text AS kind,
        ('ลา · ' || lt.name) AS label,
        COALESCE(
          NULLIF(TRIM(e.display_name), ''),
          TRIM(CONCAT(e.first_name_th, ' ', e.last_name_th)),
          '—'
        ) AS employee_name,
        e.branch_id::text AS branch_id,
        s.code AS decision,
        lr.reviewed_by_name,
        lr.reviewed_at
      FROM hr.leave_requests lr
      JOIN hr.employees e ON e.id = lr.employee_id
      JOIN hr.leave_request_statuses s ON s.id = lr.status_id
      JOIN hr.leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.organization_id = ${orgId}::uuid
        AND s.code IN ('APPROVED', 'REJECTED')
        AND lr.end_date < ${todayIso}::date
        ${branchSql}
    )
    UNION ALL
    (
      SELECT
        ot.id::text AS id,
        'overtime'::text AS kind,
        'OT'::text AS label,
        COALESCE(
          NULLIF(TRIM(e.display_name), ''),
          TRIM(CONCAT(e.first_name_th, ' ', e.last_name_th)),
          '—'
        ) AS employee_name,
        e.branch_id::text AS branch_id,
        s.code AS decision,
        ot.reviewed_by_name,
        ot.reviewed_at
      FROM hr.overtime_requests ot
      JOIN hr.employees e ON e.id = ot.employee_id
      JOIN hr.overtime_request_statuses s ON s.id = ot.status_id
      WHERE ot.organization_id = ${orgId}::uuid
        AND s.code IN ('APPROVED', 'REJECTED')
        AND ot.work_date < ${todayIso}::date
        ${branchSql}
    )
    UNION ALL
    (
      SELECT
        adj.id::text AS id,
        'attendance_adjustment'::text AS kind,
        'ปรับเวลาลงเวลา'::text AS label,
        COALESCE(
          NULLIF(TRIM(e.display_name), ''),
          TRIM(CONCAT(e.first_name_th, ' ', e.last_name_th)),
          '—'
        ) AS employee_name,
        e.branch_id::text AS branch_id,
        s.code AS decision,
        adj.reviewed_by_name,
        adj.reviewed_at
      FROM hr.attendance_adjustments adj
      JOIN hr.employees e ON e.id = adj.employee_id
      JOIN hr.leave_request_statuses s ON s.id = adj.status_id
      WHERE adj.organization_id = ${orgId}::uuid
        AND s.code IN ('APPROVED', 'REJECTED')
        AND adj.work_date < ${todayIso}::date
        ${branchSql}
    )
  `;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<HistorySqlRow[]>`
      SELECT * FROM (${combined}) AS history
      ORDER BY branch_id ASC NULLS LAST, reviewed_at DESC NULLS LAST, id ASC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `,
    prisma.$queryRaw<Array<{ total: number | bigint }>>`
      SELECT COUNT(*)::int AS total FROM (${combined}) AS history
    `,
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const mapped: DashboardDecisionItem[] = rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    label: row.label,
    employeeName: row.employee_name,
    branchId: row.branch_id,
    decision: row.decision,
    reviewedByName: row.reviewed_by_name?.trim() || "—",
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    href: "/hr/approvals",
  }));

  return toPagedResponse({ rows: mapped, total }, pagination);
}
