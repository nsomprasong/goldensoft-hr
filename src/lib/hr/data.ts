/**
 * Read layer for HR server components.
 *
 * Pages go through the same repository + domain services as the API routes
 * (no self-HTTP), and every read is wrapped: if the `hr` schema is not migrated
 * yet — or the repository is otherwise unreachable — the page renders empty
 * data plus a Thai notice instead of crashing.
 */
import { resolveAllowedBranchIds } from "@/lib/hr/api";
import { HrError } from "@/lib/hr/errors";
import { getHrRepository } from "@/lib/hr/repository";
import type {
  HrMasterKind,
  HrRepository,
  MasterRecord,
} from "@/lib/hr/repository/types";
import { listCompensations } from "@/lib/hr/services/compensations";
import {
  getHrDashboard,
  listApprovalHistory as listApprovalHistoryService,
  type DashboardDecisionItem,
} from "@/lib/hr/services/dashboard";
import { listDepartments as listDepartmentsService } from "@/lib/hr/services/departments";
import {
  getEmployee as getEmployeeService,
  listEmployees as listEmployeesService,
} from "@/lib/hr/services/employees";
import { listOvertimeRules as listOvertimeRulesService } from "@/lib/hr/services/overtime-rules";
import {
  getPayrollDeductionSettings as getPayrollDeductionSettingsService,
  type PayrollDeductionSettingsRow,
} from "@/lib/hr/services/payroll-deduction-settings";
import {
  getPayrollPeriod as getPayrollPeriodService,
  listPayrollPeriods as listPayrollPeriodsService,
} from "@/lib/hr/services/payroll-periods";
import {
  getPayrollRun as getPayrollRunService,
  getPayslip as getPayslipService,
  listOrgPayslips as listOrgPayslipsService,
  listPayrollRuns as listPayrollRunsService,
  listPayslipPeriodOptions as listPayslipPeriodOptionsService,
  listSelfPayslips as listSelfPayslipsService,
  resolveDefaultPayslipPeriodId,
  type PayrollRunDetail,
  type PayrollRunListItem,
  type PayslipDetail,
  type PayslipListItem,
  type PayslipPeriodOption,
} from "@/lib/hr/services/payroll-runs";
import { listPayrollSchedules as listPayrollSchedulesService } from "@/lib/hr/services/payroll-schedules";
import { listPositions as listPositionsService } from "@/lib/hr/services/positions";
import {
  listSalaryAdvances as listSalaryAdvancesService,
  type SalaryAdvanceRow,
} from "@/lib/hr/services/salary-advances";
import { listShifts as listShiftsService } from "@/lib/hr/services/shifts";
import {
  getSchedulePeriod as getSchedulePeriodService,
  getScheduleShiftBoard as getScheduleShiftBoardService,
  listSchedulePeriods as listSchedulePeriodsService,
} from "@/lib/hr/services/schedules";
import {
  listCalendars as listCalendarsService,
  listHolidayTypes as listHolidayTypesService,
} from "@/lib/hr/services/calendars";
import {
  approvalInbox as approvalInboxService,
  listAttendanceAdjustments as listAttendanceAdjustmentsService,
  listLeaveBalances as listLeaveBalancesService,
  listLeaveCoverCandidates as listLeaveCoverCandidatesService,
  listLeaveHistory as listLeaveHistoryService,
  listLeaveRequests as listLeaveRequestsService,
  listOvertimeHistory as listOvertimeHistoryService,
  listOvertimeRequests as listOvertimeRequestsService,
  listWorkLocations as listWorkLocationsService,
} from "@/lib/hr/services/operations";
import {
  toHrServiceContext,
  type HrServiceContext,
  type PagedResponse,
} from "@/lib/hr/services/shared";
import type { HrRequestContext } from "@/lib/platform/types";

export const HR_DB_UNAVAILABLE_MESSAGE =
  "ฐานข้อมูล HR ยังไม่พร้อม — รออนุมัติ migration";

export type HrDataResult<T> = {
  data: T;
  available: boolean;
  message: string | null;
};

/** Large enough for master lists; page-level lists pass their own paging. */
const ALL = 200;

function ok<T>(data: T): HrDataResult<T> {
  return { data, available: true, message: null };
}

function serviceContext(ctx: HrRequestContext): HrServiceContext {
  return toHrServiceContext(ctx, {
    allowedBranchIds: resolveAllowedBranchIds(ctx),
  });
}

/**
 * Run a read against the repository. Domain "not found" stays a normal empty
 * result; anything else (missing tables, no connection) degrades the page.
 */
async function safeRead<T>(
  fallback: T,
  run: (repository: HrRepository) => Promise<T>,
): Promise<HrDataResult<T>> {
  try {
    const repository = await getHrRepository();
    return ok(await run(repository));
  } catch (error) {
    if (error instanceof HrError) {
      if (error.code === "NOT_FOUND") return ok(fallback);
      // Surface so schedule pages can redirect when header branch changes.
      if (error.code === "BRANCH_OUT_OF_SCOPE") {
        return {
          data: fallback,
          available: true,
          message: "BRANCH_OUT_OF_SCOPE",
        };
      }
      return { data: fallback, available: false, message: error.message };
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn("[hr/data] read failed, falling back to empty", error);
    }
    return {
      data: fallback,
      available: false,
      message: HR_DB_UNAVAILABLE_MESSAGE,
    };
  }
}

export function combineAvailability(
  ...results: Array<{ available: boolean; message: string | null }>
): { available: boolean; message: string | null } {
  const failed = results.find((r) => !r.available);
  return failed
    ? { available: false, message: failed.message ?? HR_DB_UNAVAILABLE_MESSAGE }
    : { available: true, message: null };
}

function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

// ─── Master data ──────────────────────────────────────────────────────────

export type MasterOption = {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
};

export type HrMasterData = {
  employmentTypes: MasterOption[];
  employeeStatuses: MasterOption[];
  shiftTypes: MasterOption[];
  payFrequencies: MasterOption[];
  wageTypes: MasterOption[];
  overtimeRateTypes: MasterOption[];
  payrollPeriodStatuses: MasterOption[];
};

const EMPTY_MASTER: HrMasterData = {
  employmentTypes: [],
  employeeStatuses: [],
  shiftTypes: [],
  payFrequencies: [],
  wageTypes: [],
  overtimeRateTypes: [],
  payrollPeriodStatuses: [],
};

function toOption(row: MasterRecord): MasterOption {
  return {
    id: row.id,
    code: row.code,
    nameTh: row.nameTh,
    nameEn: row.nameEn,
  };
}

async function readMasters(
  repository: HrRepository,
  kind: HrMasterKind,
): Promise<MasterOption[]> {
  const rows = await repository.masters.list(kind, { activeOnly: true });
  return rows.map(toOption);
}

export async function loadHrMasterData(): Promise<HrDataResult<HrMasterData>> {
  return safeRead(EMPTY_MASTER, async (repository) => {
    const [
      employmentTypes,
      employeeStatuses,
      shiftTypes,
      payFrequencies,
      wageTypes,
      overtimeRateTypes,
      payrollPeriodStatuses,
    ] = await Promise.all([
      readMasters(repository, "employmentType"),
      readMasters(repository, "employeeStatus"),
      readMasters(repository, "shiftType"),
      readMasters(repository, "payFrequency"),
      readMasters(repository, "wageType"),
      readMasters(repository, "overtimeRateType"),
      readMasters(repository, "payrollPeriodStatus"),
    ]);

    return {
      employmentTypes,
      employeeStatuses,
      shiftTypes,
      payFrequencies,
      wageTypes,
      overtimeRateTypes,
      payrollPeriodStatuses,
    };
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────

export type HrDashboardActions = {
  pendingLeave: number;
  pendingOvertime: number;
  pendingAttendanceAdjustments: number;
  attendanceExceptionsToday: number;
  missingClockOutToday: number;
  draftSchedules: number;
  payrollWarnings: number;
  probationEndingSoon: number;
};

export type HrDashboardInboxItem = {
  id: string;
  kind: "leave" | "overtime" | "attendance_adjustment";
  label: string;
  employeeName: string;
  branchId: string | null;
  branchName: string;
  submittedAt: string | null;
  href: string;
};

export type HrDashboardDecisionItem = {
  id: string;
  kind: "leave" | "overtime" | "attendance_adjustment" | "shift_mismatch";
  label: string;
  employeeName: string;
  branchId: string | null;
  branchName: string;
  decision: "APPROVED" | "REJECTED";
  reviewedByName: string;
  reviewedAt: string | null;
  href: string;
};

export type HrDashboard = {
  branchId: string | null;
  activeEmployees: number;
  byBranch: Array<{ branchId: string; branchName: string; count: number }>;
  byEmploymentType: Array<{ code: string; nameTh: string; count: number }>;
  activeShifts: number;
  currentPeriod: PayrollPeriodRow | null;
  actions: HrDashboardActions;
  recentInbox: HrDashboardInboxItem[];
  recentDecisions: HrDashboardDecisionItem[];
};

const EMPTY_ACTIONS: HrDashboardActions = {
  pendingLeave: 0,
  pendingOvertime: 0,
  pendingAttendanceAdjustments: 0,
  attendanceExceptionsToday: 0,
  missingClockOutToday: 0,
  draftSchedules: 0,
  payrollWarnings: 0,
  probationEndingSoon: 0,
};

const EMPTY_DASHBOARD: HrDashboard = {
  branchId: null,
  activeEmployees: 0,
  byBranch: [],
  byEmploymentType: [],
  activeShifts: 0,
  currentPeriod: null,
  actions: EMPTY_ACTIONS,
  recentInbox: [],
  recentDecisions: [],
};

export async function loadHrDashboard(
  ctx: HrRequestContext,
  input: { branchId?: string | null } = {},
): Promise<HrDataResult<HrDashboard>> {
  return safeRead(EMPTY_DASHBOARD, async (repository) => {
    const service = serviceContext(ctx);
    const [summary, branches] = await Promise.all([
      getHrDashboard(repository, service, input),
      listOrganizationBranches(ctx),
    ]);
    const branchNameById = new Map(
      branches.data.map((row) => [row.id, row.label]),
    );
    const resolveBranchName = (branchId: string | null | undefined) => {
      if (!branchId) return "ไม่ระบุสาขา";
      return (
        branchNameById.get(branchId) ??
        (ctx.branch?.id === branchId ? ctx.branch.name : null) ??
        "ไม่ระบุสาขา"
      );
    };
    const withBranchLabel = <
      T extends { branchId: string | null; branchName?: string },
    >(
      row: T,
    ): T & { branchName: string } => ({
      ...row,
      branchName: resolveBranchName(row.branchId),
    });
    const byBranchThenDate = <
      T extends { branchName: string; submittedAt?: string | null; reviewedAt?: string | null },
    >(
      a: T,
      b: T,
      dateKey: "submittedAt" | "reviewedAt",
    ) => {
      const branchCmp = a.branchName.localeCompare(b.branchName, "th");
      if (branchCmp !== 0) return branchCmp;
      const aDate = (dateKey === "submittedAt" ? a.submittedAt : a.reviewedAt) ?? "";
      const bDate = (dateKey === "submittedAt" ? b.submittedAt : b.reviewedAt) ?? "";
      return bDate.localeCompare(aDate);
    };

    let currentPeriod: PayrollPeriodRow | null = null;
    if (summary.currentOpenPeriod) {
      const [schedules, statuses] = await Promise.all([
        repository.payrollSchedules.list({
          organizationId: ctx.organizationId,
          skip: 0,
          take: ALL,
        }),
        repository.masters.list("payrollPeriodStatus"),
      ]);
      currentPeriod = toPayrollPeriodRow(
        summary.currentOpenPeriod,
        new Map(schedules.rows.map((s) => [s.id, s.name])),
        new Map(statuses.map((s) => [s.id, s])),
      );
    }

    const recentInbox = summary.recentInbox
      .map(withBranchLabel)
      .sort((a, b) => byBranchThenDate(a, b, "submittedAt"));
    const recentDecisions = summary.recentDecisions
      .map(withBranchLabel)
      .sort((a, b) => byBranchThenDate(a, b, "reviewedAt"));

    return {
      branchId: summary.branchId,
      activeEmployees: summary.activeEmployees.total,
      byBranch: summary.activeEmployees.byBranch.map((row) => ({
        branchId: row.id,
        branchName:
          branchNameById.get(row.id) ??
          (ctx.branch?.id === row.id ? ctx.branch.name : `สาขา ${row.id.slice(0, 8)}`),
        count: row.count,
      })),
      byEmploymentType: summary.activeEmployees.byEmploymentType
        .filter((row) => row.count > 0)
        .map((row) => ({
          code: row.code ?? "UNKNOWN",
          nameTh: row.label ?? "ไม่ระบุ",
          count: row.count,
        })),
      activeShifts: summary.activeShifts,
      currentPeriod,
      actions: summary.actions,
      recentInbox,
      recentDecisions,
    };
  });
}

export async function listApprovalHistory(
  ctx: HrRequestContext,
  input: {
    page?: number;
    pageSize?: number;
    branchId?: string | null;
  } = {},
): Promise<HrDataResult<PagedResponse<HrDashboardDecisionItem>>> {
  const empty: PagedResponse<HrDashboardDecisionItem> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 20,
    pageCount: 1,
  };
  return safeRead(empty, async () => {
    const [page, branches] = await Promise.all([
      listApprovalHistoryService(serviceContext(ctx), input),
      listOrganizationBranches(ctx),
    ]);
    const branchNameById = new Map(
      branches.data.map((row) => [row.id, row.label]),
    );
    const resolveBranchName = (branchId: string | null | undefined) => {
      if (!branchId) return "ไม่ระบุสาขา";
      return (
        branchNameById.get(branchId) ??
        (ctx.branch?.id === branchId ? ctx.branch.name : null) ??
        "ไม่ระบุสาขา"
      );
    };
    const rows = page.rows
      .map((row: DashboardDecisionItem) => ({
        ...row,
        branchName: resolveBranchName(row.branchId),
      }))
      .sort((a, b) => {
        const branchCmp = a.branchName.localeCompare(b.branchName, "th");
        if (branchCmp !== 0) return branchCmp;
        return (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? "");
      });
    return { ...page, rows };
  });
}

// ─── Employees ────────────────────────────────────────────────────────────

export const EMPLOYEE_PAGE_SIZE = 20;

export type EmployeeRow = {
  id: string;
  employeeCode: string;
  displayName: string;
  photoUrl: string | null;
  branchId: string;
  departmentNameTh: string | null;
  positionNameTh: string | null;
  employmentTypeNameTh: string;
  statusCode: string;
  statusNameTh: string;
  phone: string;
  email: string | null;
  hireDate: string;
  isActive: boolean;
};

export type EmployeeDetail = EmployeeRow & {
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn: string | null;
  lastNameEn: string | null;
  departmentId: string | null;
  positionId: string | null;
  employmentTypeId: string;
  employeeStatusId: string;
  platformUserId: string | null;
  authUserId: string | null;
  probationEndDate: string | null;
  resignationDate: string | null;
  notes: string | null;
};

export type EmployeeListFilters = {
  search?: string;
  branchId?: string;
  employeeStatusId?: string;
  employmentTypeId?: string;
  page?: number;
};

export type EmployeeListResult = {
  rows: EmployeeRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type EmployeeRecordLike = {
  id: string;
  employeeCode: string;
  displayName: string;
  photoUrl?: string | null;
  branchId: string;
  departmentId: string | null;
  positionId: string | null;
  employmentTypeId: string;
  employeeStatusId: string;
  phone: string;
  email: string | null;
  hireDate: Date;
  isActive: boolean;
};

type NameLookups = {
  departments: Map<string, string>;
  positions: Map<string, string>;
  employmentTypes: Map<string, MasterRecord>;
  employeeStatuses: Map<string, MasterRecord>;
};

async function loadNameLookups(
  repository: HrRepository,
  organizationId: string,
): Promise<NameLookups> {
  const [departments, positions, employmentTypes, employeeStatuses] =
    await Promise.all([
      repository.departments.list({ organizationId, skip: 0, take: ALL }),
      repository.positions.list({ organizationId, skip: 0, take: ALL }),
      repository.masters.list("employmentType"),
      repository.masters.list("employeeStatus"),
    ]);

  return {
    departments: new Map(departments.rows.map((d) => [d.id, d.nameTh])),
    positions: new Map(positions.rows.map((p) => [p.id, p.nameTh])),
    employmentTypes: new Map(employmentTypes.map((t) => [t.id, t])),
    employeeStatuses: new Map(employeeStatuses.map((s) => [s.id, s])),
  };
}

function toEmployeeRow(
  employee: EmployeeRecordLike,
  lookups: NameLookups,
): EmployeeRow {
  const status = lookups.employeeStatuses.get(employee.employeeStatusId);
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    displayName: employee.displayName,
    photoUrl: employee.photoUrl ?? null,
    branchId: employee.branchId,
    departmentNameTh: employee.departmentId
      ? (lookups.departments.get(employee.departmentId) ?? null)
      : null,
    positionNameTh: employee.positionId
      ? (lookups.positions.get(employee.positionId) ?? null)
      : null,
    employmentTypeNameTh:
      lookups.employmentTypes.get(employee.employmentTypeId)?.nameTh ?? "—",
    statusCode: status?.code ?? "UNKNOWN",
    statusNameTh: status?.nameTh ?? "ไม่ทราบสถานะ",
    phone: employee.phone,
    email: employee.email,
    hireDate: isoDate(employee.hireDate) ?? "",
    isActive: employee.isActive,
  };
}

export async function listEmployees(
  ctx: HrRequestContext,
  filters: EmployeeListFilters,
): Promise<HrDataResult<EmployeeListResult>> {
  const page = Math.max(1, filters.page ?? 1);
  const fallback: EmployeeListResult = {
    rows: [],
    total: 0,
    page,
    pageSize: EMPLOYEE_PAGE_SIZE,
    pageCount: 1,
  };

  return safeRead(fallback, async (repository) => {
    const service = serviceContext(ctx);
    const [result, lookups] = await Promise.all([
      listEmployeesService(repository, service, {
        page,
        pageSize: EMPLOYEE_PAGE_SIZE,
        search: filters.search || null,
        branchId: filters.branchId || null,
        employeeStatusId: filters.employeeStatusId || null,
        employmentTypeId: filters.employmentTypeId || null,
      }),
      loadNameLookups(repository, ctx.organizationId),
    ]);

    return {
      rows: result.rows.map((row) => toEmployeeRow(row, lookups)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      pageCount: result.pageCount,
    };
  });
}

/** Distinct branch ids that already have employees — used for list filters. */
export async function listEmployeeBranchIds(
  ctx: HrRequestContext,
): Promise<HrDataResult<string[]>> {
  return safeRead<string[]>([], async (repository) => {
    const counts = await repository.employees.countActive(ctx.organizationId);
    const allowed = resolveAllowedBranchIds(ctx);
    return Object.keys(counts.byBranchId)
      .filter((id) => allowed == null || allowed.includes(id))
      .sort();
  });
}

export async function getEmployeeDetail(
  ctx: HrRequestContext,
  employeeId: string,
): Promise<HrDataResult<EmployeeDetail | null>> {
  return safeRead<EmployeeDetail | null>(null, async (repository) => {
    const service = serviceContext(ctx);
    const employee = await getEmployeeService(repository, service, employeeId);
    const lookups = await loadNameLookups(repository, ctx.organizationId);

    return {
      ...toEmployeeRow(employee, lookups),
      firstNameTh: employee.firstNameTh,
      lastNameTh: employee.lastNameTh,
      firstNameEn: employee.firstNameEn,
      lastNameEn: employee.lastNameEn,
      departmentId: employee.departmentId,
      positionId: employee.positionId,
      employmentTypeId: employee.employmentTypeId,
      employeeStatusId: employee.employeeStatusId,
      platformUserId: employee.platformUserId,
      authUserId: employee.authUserId,
      probationEndDate: isoDate(employee.probationEndDate),
      resignationDate: isoDate(employee.resignationDate),
      notes: employee.notes,
    };
  });
}

// ─── Compensation (caller must hold hr.compensation.read) ─────────────────

export type CompensationRow = {
  id: string;
  wageTypeId: string;
  wageTypeNameTh: string;
  amount: string;
  amountValue: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  overtimeEligible: boolean;
  isCurrent: boolean;
};

export async function listEmployeeCompensations(
  ctx: HrRequestContext,
  employeeId: string,
): Promise<HrDataResult<CompensationRow[]>> {
  return safeRead<CompensationRow[]>([], async (repository) => {
    const service = serviceContext(ctx);
    const [rows, wageTypes] = await Promise.all([
      listCompensations(repository, service, employeeId),
      repository.masters.list("wageType"),
    ]);
    const byId = new Map(wageTypes.map((w) => [w.id, w.nameTh]));

    return rows.map((row) => ({
      id: row.id,
      wageTypeId: row.wageTypeId,
      wageTypeNameTh: byId.get(row.wageTypeId) ?? "—",
      amount: row.amount.toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      amountValue: String(row.amount),
      currency: row.currency,
      effectiveFrom: isoDate(row.effectiveFrom) ?? "",
      effectiveTo: isoDate(row.effectiveTo),
      overtimeEligible: row.overtimeEligible,
      isCurrent: row.isCurrent,
    }));
  });
}

// ─── Departments / positions ──────────────────────────────────────────────

export type DepartmentRow = {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  description: string | null;
  isActive: boolean;
};

export type PositionRow = DepartmentRow & {
  departmentId: string | null;
  departmentNameTh: string | null;
};

export async function listDepartments(
  ctx: HrRequestContext,
): Promise<HrDataResult<DepartmentRow[]>> {
  return safeRead<DepartmentRow[]>([], async (repository) => {
    const result = await listDepartmentsService(repository, serviceContext(ctx), {
      pageSize: ALL,
    });
    return result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      nameTh: row.nameTh,
      nameEn: row.nameEn,
      description: row.description,
      isActive: row.isActive,
    }));
  });
}

export async function listPositions(
  ctx: HrRequestContext,
): Promise<HrDataResult<PositionRow[]>> {
  return safeRead<PositionRow[]>([], async (repository) => {
    const service = serviceContext(ctx);
    const [positions, departments] = await Promise.all([
      listPositionsService(repository, service, { pageSize: ALL }),
      repository.departments.list({
        organizationId: ctx.organizationId,
        skip: 0,
        take: ALL,
      }),
    ]);
    const byId = new Map(departments.rows.map((d) => [d.id, d.nameTh]));

    return positions.rows.map((row) => ({
      id: row.id,
      code: row.code,
      nameTh: row.nameTh,
      nameEn: row.nameEn,
      description: row.description,
      isActive: row.isActive,
      departmentId: row.departmentId,
      departmentNameTh: row.departmentId
        ? (byId.get(row.departmentId) ?? null)
        : null,
    }));
  });
}

// ─── Shifts ───────────────────────────────────────────────────────────────

export type ShiftRow = {
  id: string;
  code: string;
  name: string;
  shiftTypeId: string;
  shiftTypeNameTh: string;
  branchId: string | null;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceLateMinutes: number;
  graceEarlyLeaveMinutes: number;
  crossesMidnight: boolean;
  standardWorkMinutes: number;
  overtimeAfterMinutes: number | null;
  isActive: boolean;
};

export async function listShifts(
  ctx: HrRequestContext,
): Promise<HrDataResult<ShiftRow[]>> {
  return safeRead<ShiftRow[]>([], async (repository) => {
    const service = serviceContext(ctx);
    const [shifts, shiftTypes] = await Promise.all([
      listShiftsService(repository, service, { pageSize: ALL }),
      repository.masters.list("shiftType"),
    ]);
    const byId = new Map(shiftTypes.map((t) => [t.id, t.nameTh]));

    return shifts.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      shiftTypeId: row.shiftTypeId,
      shiftTypeNameTh: byId.get(row.shiftTypeId) ?? "—",
      branchId: row.branchId,
      startTime: row.startTime,
      endTime: row.endTime,
      breakMinutes: row.breakMinutes,
      graceLateMinutes: row.graceLateMinutes,
      graceEarlyLeaveMinutes: row.graceEarlyLeaveMinutes,
      crossesMidnight: row.crossesMidnight,
      standardWorkMinutes: row.standardWorkMinutes,
      overtimeAfterMinutes: row.overtimeAfterMinutes,
      isActive: row.isActive,
    }));
  });
}

// ─── Overtime rules ───────────────────────────────────────────────────────

export type OvertimeRuleRow = {
  id: string;
  code: string;
  name: string;
  rateTypeId: string;
  rateTypeNameTh: string;
  multiplier: number;
  fixedAmount: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
};

export async function listOvertimeRules(
  ctx: HrRequestContext,
): Promise<HrDataResult<OvertimeRuleRow[]>> {
  return safeRead<OvertimeRuleRow[]>([], async (repository) => {
    const service = serviceContext(ctx);
    const [rules, rateTypes] = await Promise.all([
      listOvertimeRulesService(repository, service, { pageSize: ALL }),
      repository.masters.list("overtimeRateType"),
    ]);
    const byId = new Map(rateTypes.map((t) => [t.id, t.nameTh]));

    return rules.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      rateTypeId: row.rateTypeId,
      rateTypeNameTh: byId.get(row.rateTypeId) ?? "—",
      multiplier: row.multiplier,
      fixedAmount: row.fixedAmount,
      effectiveFrom: isoDate(row.effectiveFrom) ?? "",
      effectiveTo: isoDate(row.effectiveTo),
      isActive: row.isActive,
    }));
  });
}

// ─── Payroll ──────────────────────────────────────────────────────────────

export type PayrollScheduleRow = {
  id: string;
  code: string;
  name: string;
  payFrequencyId: string;
  payFrequencyNameTh: string;
  periodStartRule: string;
  periodEndRule: string;
  paymentDayRule: string;
  timezone: string;
  isActive: boolean;
};

export type PayrollPeriodRow = {
  id: string;
  scheduleId: string;
  scheduleName: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  statusId: string;
  statusCode: string;
  statusNameTh: string;
  lockedAt: string | null;
};

export async function listPayrollSchedules(
  ctx: HrRequestContext,
): Promise<HrDataResult<PayrollScheduleRow[]>> {
  return safeRead<PayrollScheduleRow[]>([], async (repository) => {
    const service = serviceContext(ctx);
    const [schedules, frequencies] = await Promise.all([
      listPayrollSchedulesService(repository, service, { pageSize: ALL }),
      repository.masters.list("payFrequency"),
    ]);
    const byId = new Map(frequencies.map((f) => [f.id, f.nameTh]));

    return schedules.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      payFrequencyId: row.payFrequencyId,
      payFrequencyNameTh: byId.get(row.payFrequencyId) ?? "—",
      periodStartRule: row.periodStartRule,
      periodEndRule: row.periodEndRule,
      paymentDayRule: row.paymentDayRule,
      timezone: row.timezone,
      isActive: row.isActive,
    }));
  });
}

function toPayrollPeriodRow(
  row: {
    id: string;
    payrollScheduleId: string;
    periodStart: Date;
    periodEnd: Date;
    paymentDate: Date;
    statusId: string;
    lockedAt: Date | null;
  },
  scheduleNames: Map<string, string>,
  statuses: Map<string, MasterRecord>,
): PayrollPeriodRow {
  const status = statuses.get(row.statusId);
  return {
    id: row.id,
    scheduleId: row.payrollScheduleId,
    scheduleName: scheduleNames.get(row.payrollScheduleId) ?? "—",
    periodStart: isoDate(row.periodStart) ?? "",
    periodEnd: isoDate(row.periodEnd) ?? "",
    paymentDate: isoDate(row.paymentDate) ?? "",
    statusId: row.statusId,
    statusCode: status?.code ?? "UNKNOWN",
    statusNameTh: status?.nameTh ?? "ไม่ทราบสถานะ",
    lockedAt: row.lockedAt ? row.lockedAt.toISOString().slice(0, 16) : null,
  };
}

async function payrollLookups(
  repository: HrRepository,
  organizationId: string,
): Promise<{
  scheduleNames: Map<string, string>;
  statuses: Map<string, MasterRecord>;
}> {
  const [schedules, statuses] = await Promise.all([
    repository.payrollSchedules.list({ organizationId, skip: 0, take: ALL }),
    repository.masters.list("payrollPeriodStatus"),
  ]);
  return {
    scheduleNames: new Map(schedules.rows.map((s) => [s.id, s.name])),
    statuses: new Map(statuses.map((s) => [s.id, s])),
  };
}

export async function listPayrollPeriods(
  ctx: HrRequestContext,
): Promise<HrDataResult<PayrollPeriodRow[]>> {
  return safeRead<PayrollPeriodRow[]>([], async (repository) => {
    const service = serviceContext(ctx);
    const [periods, lookups] = await Promise.all([
      listPayrollPeriodsService(repository, service, { pageSize: 60 }),
      payrollLookups(repository, ctx.organizationId),
    ]);
    return periods.rows.map((row) =>
      toPayrollPeriodRow(row, lookups.scheduleNames, lookups.statuses),
    );
  });
}

export async function getPayrollPeriod(
  ctx: HrRequestContext,
  periodId: string,
): Promise<HrDataResult<PayrollPeriodRow | null>> {
  return safeRead<PayrollPeriodRow | null>(null, async (repository) => {
    const service = serviceContext(ctx);
    const [row, lookups] = await Promise.all([
      getPayrollPeriodService(repository, service, periodId),
      payrollLookups(repository, ctx.organizationId),
    ]);
    return toPayrollPeriodRow(row, lookups.scheduleNames, lookups.statuses);
  });
}

export type {
  PayrollDeductionSettingsRow,
  PayrollRunDetail,
  PayrollRunListItem,
  PayslipDetail,
  PayslipListItem,
  PayslipPeriodOption,
};

export { resolveDefaultPayslipPeriodId };

export async function listPayrollRuns(
  ctx: HrRequestContext,
): Promise<HrDataResult<PayrollRunListItem[]>> {
  return safeRead<PayrollRunListItem[]>([], async () =>
    listPayrollRunsService(serviceContext(ctx)),
  );
}

export async function getPayrollRun(
  ctx: HrRequestContext,
  id: string,
): Promise<HrDataResult<PayrollRunDetail | null>> {
  return safeRead<PayrollRunDetail | null>(null, async () =>
    getPayrollRunService(serviceContext(ctx), id),
  );
}

export async function listOrgPayslips(
  ctx: HrRequestContext,
): Promise<HrDataResult<PayslipListItem[]>> {
  return safeRead<PayslipListItem[]>([], async () =>
    listOrgPayslipsService(serviceContext(ctx)),
  );
}

export async function listPayslipPeriodOptions(
  ctx: HrRequestContext,
  options: { employeeId?: string | null } = {},
): Promise<HrDataResult<PayslipPeriodOption[]>> {
  return safeRead<PayslipPeriodOption[]>([], async () =>
    listPayslipPeriodOptionsService(serviceContext(ctx), options),
  );
}

export async function listSelfPayslips(
  ctx: HrRequestContext,
): Promise<HrDataResult<PayslipListItem[]>> {
  return safeRead<PayslipListItem[]>([], async () =>
    listSelfPayslipsService(serviceContext(ctx)),
  );
}

export async function getPayslip(
  ctx: HrRequestContext,
  id: string,
): Promise<HrDataResult<PayslipDetail | null>> {
  return safeRead<PayslipDetail | null>(null, async () =>
    getPayslipService(serviceContext(ctx), id),
  );
}

export async function getPayrollDeductionSettings(
  ctx: HrRequestContext,
): Promise<HrDataResult<PayrollDeductionSettingsRow | null>> {
  return safeRead<PayrollDeductionSettingsRow | null>(null, async () =>
    getPayrollDeductionSettingsService(serviceContext(ctx)),
  );
}

export type { SalaryAdvanceRow };

export async function listSalaryAdvances(
  ctx: HrRequestContext,
): Promise<HrDataResult<SalaryAdvanceRow[]>> {
  return safeRead([], async () =>
    listSalaryAdvancesService(serviceContext(ctx)),
  );
}

export async function listMySalaryAdvances(
  ctx: HrRequestContext,
  employeeId: string,
): Promise<HrDataResult<SalaryAdvanceRow[]>> {
  const { listMySalaryAdvances: listMine } = await import(
    "@/lib/hr/services/salary-advances"
  );
  return safeRead([], async () => listMine(serviceContext(ctx), employeeId));
}

export async function listAdvancePeriodOptions(
  ctx: HrRequestContext,
): Promise<
  HrDataResult<
    import("@/lib/hr/services/salary-advances").AdvancePeriodOption[]
  >
> {
  const { listAdvancePeriodOptions: listOptions } = await import(
    "@/lib/hr/services/salary-advances"
  );
  return safeRead([], async () => listOptions(serviceContext(ctx)));
}

// ─── Schedule periods ─────────────────────────────────────────────────────

export type SchedulePeriodRow = {
  id: string;
  code: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  statusCode: string;
  statusName: string;
  timezone: string;
  branchId: string | null;
  assignmentCount?: number;
};

export async function listSchedulePeriods(
  ctx: HrRequestContext,
  input: { branchId?: string | null } = {},
): Promise<HrDataResult<SchedulePeriodRow[]>> {
  return safeRead<SchedulePeriodRow[]>([], async () => {
    const rows = await listSchedulePeriodsService(serviceContext(ctx), input);
    return rows
      .map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        periodStart: isoDate(row.periodStart) ?? "",
        periodEnd: isoDate(row.periodEnd) ?? "",
        statusCode: row.status?.code ?? "—",
        statusName: row.status?.name ?? row.status?.code ?? "—",
        timezone: row.timezone,
        branchId: row.branchId ?? null,
      }))
      .sort((a, b) => {
        const byStart = b.periodStart.localeCompare(a.periodStart);
        if (byStart !== 0) return byStart;
        return b.periodEnd.localeCompare(a.periodEnd);
      });
  });
}

export type SchedulePeriodShiftRow = {
  id: string;
  shiftId: string;
  name: string;
  timeLabel: string;
  employeeCount: number;
};

/** Compact employee + shift lists for schedule UIs. */
export type ScheduleRosterOption = {
  id: string;
  label: string;
};

function formatShiftClock(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 5);
  const hh = String(value.getUTCHours()).padStart(2, "0");
  const mm = String(value.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export async function getSchedulePeriod(
  ctx: HrRequestContext,
  id: string,
): Promise<
  HrDataResult<{
    period: SchedulePeriodRow;
    periodShifts: SchedulePeriodShiftRow[];
  } | null>
> {
  return safeRead(null, async () => {
    const row = await getSchedulePeriodService(serviceContext(ctx), id);
    type PeriodShiftLink = {
      id: string;
      shiftId: string;
      employeeCount?: number;
      shift: {
        name: string;
        startTime: Date | string;
        endTime: Date | string;
      };
    };
    const periodShifts: SchedulePeriodShiftRow[] = (
      (row.periodShifts ?? []) as PeriodShiftLink[]
    ).map((link) => {
      const start = formatShiftClock(link.shift.startTime);
      const end = formatShiftClock(link.shift.endTime);
      return {
        id: link.id,
        shiftId: link.shiftId,
        name: link.shift.name,
        timeLabel: `${start}–${end}`,
        employeeCount: link.employeeCount ?? 0,
      };
    });

    return {
      period: {
        id: row.id,
        code: row.code,
        name: row.name,
        periodStart: isoDate(row.periodStart) ?? "",
        periodEnd: isoDate(row.periodEnd) ?? "",
        statusCode: row.status?.code ?? "—",
        statusName: row.status?.name ?? row.status?.code ?? "—",
        timezone: row.timezone,
        branchId: row.branchId ?? null,
        assignmentCount: Number(row.assignmentCount ?? 0),
      },
      periodShifts,
    };
  });
}

export type ScheduleShiftBoard = {
  period: SchedulePeriodRow;
  shift: { id: string; name: string; timeLabel: string };
  onShift: Array<{
    employeeId: string;
    label: string;
    dayCount: number;
    workDates: string[];
    coverNote?: string | null;
    moveNote?: string | null;
    leaveNote?: string | null;
  }>;
  unassigned: ScheduleRosterOption[];
  otherShifts: ScheduleRosterOption[];
  employeeOptions: ScheduleRosterOption[];
};

export async function getScheduleShiftBoard(
  ctx: HrRequestContext,
  scheduleId: string,
  shiftId: string,
): Promise<HrDataResult<ScheduleShiftBoard | null>> {
  return safeRead(null, async () => {
    const board = await getScheduleShiftBoardService(
      serviceContext(ctx),
      scheduleId,
      shiftId,
    );
    const start = formatShiftClock(board.shift.startTime);
    const end = formatShiftClock(board.shift.endTime);
    return {
      period: {
        id: board.period.id,
        code: board.period.code,
        name: board.period.name,
        periodStart: isoDate(board.period.periodStart) ?? "",
        periodEnd: isoDate(board.period.periodEnd) ?? "",
        statusCode: board.period.status?.code ?? "—",
        statusName:
          board.period.status?.name ?? board.period.status?.code ?? "—",
        timezone: board.period.timezone,
        branchId: board.period.branchId ?? null,
      },
      shift: {
        id: board.shift.id,
        name: board.shift.name,
        timeLabel: `${start}–${end}`,
      },
      onShift: board.onShift,
      unassigned: board.unassigned,
      otherShifts: board.otherShifts,
      employeeOptions: board.employeeOptions,
    };
  });
}

export async function listScheduleComposerOptions(
  ctx: HrRequestContext,
  options?: { shiftsOnly?: boolean },
): Promise<
  HrDataResult<{
    employees: ScheduleRosterOption[];
    shifts: ScheduleRosterOption[];
  }>
> {
  const empty = { employees: [] as ScheduleRosterOption[], shifts: [] as ScheduleRosterOption[] };
  return safeRead(empty, async (repository) => {
    const service = serviceContext(ctx);
    const shiftsOnly = Boolean(options?.shiftsOnly);
    const [employees, shifts] = await Promise.all([
      shiftsOnly
        ? Promise.resolve({ rows: [] as Array<{ id: string; employeeCode: string; displayName: string }> })
        : listEmployeesService(repository, service, {
            page: 1,
            pageSize: ALL,
            isActive: true,
          }),
      listShiftsService(repository, service, { pageSize: ALL }),
    ]);

    return {
      employees: employees.rows.map((row) => ({
        id: row.id,
        label: `${row.employeeCode} · ${row.displayName}`,
      })),
      shifts: shifts.rows
        .filter((row) => row.isActive)
        .map((row) => ({
          id: row.id,
          label: `${row.name} (${row.startTime.slice(0, 5)}–${row.endTime.slice(0, 5)})`,
        })),
    };
  });
}

// ─── Work calendars ───────────────────────────────────────────────────────

export type HolidayTypeOption = {
  id: string;
  code: string;
  name: string;
};

export type HolidayRow = {
  id: string;
  holidayDate: string;
  name: string;
  isPaid: boolean;
  holidayTypeId: string;
  holidayTypeName: string;
};

export type WorkCalendarRow = {
  id: string;
  code: string;
  name: string;
  timezone: string;
  workDays: number[];
  isActive: boolean;
  holidays: HolidayRow[];
};

function parseWorkDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
}

export async function listWorkCalendars(
  ctx: HrRequestContext,
): Promise<HrDataResult<WorkCalendarRow[]>> {
  return safeRead<WorkCalendarRow[]>([], async () => {
    const rows = await listCalendarsService(serviceContext(ctx));
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      timezone: row.timezone,
      workDays: parseWorkDays(row.workDays),
      isActive: row.isActive,
      holidays: (row.holidays ?? []).map((h) => ({
        id: h.id,
        holidayDate: isoDate(h.holidayDate) ?? "",
        name: h.name,
        isPaid: h.isPaid,
        holidayTypeId: h.holidayTypeId,
        holidayTypeName: h.holidayType?.name ?? "—",
      })),
    }));
  });
}

export async function listHolidayTypeOptions(
  ctx: HrRequestContext,
): Promise<HrDataResult<HolidayTypeOption[]>> {
  return safeRead<HolidayTypeOption[]>([], async () => {
    const rows = await listHolidayTypesService(serviceContext(ctx));
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
    }));
  });
}

// ─── Work locations ───────────────────────────────────────────────────────

export type WorkLocationRow = {
  id: string;
  code: string;
  name: string;
  branchId: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
  timezone: string;
  isActive: boolean;
};

export async function listWorkLocations(
  ctx: HrRequestContext,
  branchId?: string | null,
): Promise<HrDataResult<WorkLocationRow[]>> {
  return safeRead<WorkLocationRow[]>([], async () => {
    const rows = await listWorkLocationsService(
      serviceContext(ctx),
      branchId ?? null,
    );
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      branchId: row.branchId,
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
      geofenceRadiusMeters: row.geofenceRadiusMeters,
      timezone: row.timezone,
      isActive: row.isActive,
    }));
  });
}

export type OrganizationBranchOption = {
  id: string;
  label: string;
};

/** Branches from Platform for location forms (OWNER/ADMIN see all org branches). */
export async function listOrganizationBranches(
  ctx: HrRequestContext,
): Promise<HrDataResult<OrganizationBranchOption[]>> {
  return safeRead<OrganizationBranchOption[]>([], async () => {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRaw<
      Array<{ id: string; code: string; name: string }>
    >`
      SELECT id::text AS id, code, name
      FROM platform.branches
      WHERE organization_id = ${ctx.organizationId}::uuid
        AND deleted_at IS NULL
      ORDER BY is_primary DESC, code ASC
    `;
    const allowed = resolveAllowedBranchIds(ctx);
    const filtered =
      allowed == null ? rows : rows.filter((row) => allowed.includes(row.id));
    if (filtered.length > 0) {
      return filtered.map((row) => ({
        id: row.id,
        label: row.name,
      }));
    }
    if (ctx.branch) {
      return [{ id: ctx.branch.id, label: ctx.branch.name }];
    }
    if (ctx.branchId) {
      return [{ id: ctx.branchId, label: "สาขาปัจจุบัน" }];
    }
    return [];
  });
}

// ─── Leave / OT / approvals ───────────────────────────────────────────────

export type LeaveScheduledShift = {
  shiftId: string | null;
  shiftName: string;
  workDates: string[];
  timeLabel: string | null;
};

export type LeaveCoverCandidate = {
  id: string;
  employeeCode: string;
  displayName: string;
  photoUrl: string | null;
  shiftId?: string | null;
  shiftName?: string;
  timeLabel?: string | null;
  workDates?: string[];
};

export type LeaveRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  photoUrl: string | null;
  leaveTypeName: string;
  statusCode: string;
  statusName: string;
  startDate: string;
  endDate: string;
  requestedAmount: number;
  reason: string | null;
  coverEmployeeId: string | null;
  coverEmployeeName: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  scheduledShifts: LeaveScheduledShift[];
};

function mapLeaveRequestRow(row: {
  id: string;
  employeeId: string;
  employee?: {
    employeeCode?: string | null;
    displayName?: string | null;
    photoUrl?: string | null;
  } | null;
  leaveType?: { name?: string | null } | null;
  status?: { code?: string | null; name?: string | null } | null;
  startDate: Date | string;
  endDate: Date | string;
  requestedAmount: unknown;
  reason?: string | null;
  coverEmployeeId?: string | null;
  coverEmployee?: {
    displayName?: string | null;
  } | null;
  submittedAt?: Date | string | null;
  reviewedAt?: Date | string | null;
  createdAt?: Date | string | null;
  scheduledShifts?: LeaveScheduledShift[];
}): LeaveRequestRow {
  const submitted =
    row.submittedAt ?? row.createdAt ?? null;
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeCode: row.employee?.employeeCode ?? "—",
    employeeName: row.employee?.displayName ?? "—",
    photoUrl: row.employee?.photoUrl ?? null,
    leaveTypeName: row.leaveType?.name ?? "—",
    statusCode: row.status?.code ?? "—",
    statusName: row.status?.name ?? row.status?.code ?? "—",
    startDate: isoDate(row.startDate) ?? "",
    endDate: isoDate(row.endDate) ?? "",
    requestedAmount: Number(row.requestedAmount),
    reason: row.reason ?? null,
    coverEmployeeId: row.coverEmployeeId ?? null,
    coverEmployeeName: row.coverEmployee?.displayName ?? null,
    submittedAt:
      submitted instanceof Date
        ? submitted.toISOString()
        : typeof submitted === "string"
          ? submitted
          : null,
    reviewedAt:
      row.reviewedAt instanceof Date
        ? row.reviewedAt.toISOString()
        : typeof row.reviewedAt === "string"
          ? row.reviewedAt
          : null,
    scheduledShifts: Array.isArray(row.scheduledShifts)
      ? row.scheduledShifts
      : [],
  };
}

export type OvertimeRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  photoUrl: string | null;
  statusCode: string;
  statusName: string;
  workDate: string;
  startAt: string;
  endAt: string;
  requestedMinutes: number;
  approvedMinutes: number | null;
  reason: string | null;
  submittedAt: string | null;
};

export type LeaveBalanceRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  photoUrl: string | null;
  leaveTypeName: string;
  balanceYear: number;
  openingBalance: number;
  usedBalance: number;
  availableBalance: number;
};

export type AttendanceAdjustmentRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  photoUrl: string | null;
  statusCode: string;
  statusName: string;
  workDate: string;
  requestedClockInAt: string | null;
  requestedClockOutAt: string | null;
  reason: string;
};

export type ShiftMismatchRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  photoUrl: string | null;
  statusCode: string;
  statusName: string;
  workDate: string;
  fromShiftName: string;
  toShiftName: string;
  fromTimeLabel: string;
  toTimeLabel: string;
  reason: string;
};

export type ApprovalInboxData = {
  leave: LeaveRequestRow[];
  overtime: OvertimeRequestRow[];
  attendanceAdjustments: AttendanceAdjustmentRow[];
  attendanceAdjustmentCount: number;
  shiftMismatches: ShiftMismatchRow[];
  shiftMismatchCount: number;
  advances: import("@/lib/hr/services/salary-advances").SalaryAdvanceRow[];
};

function formatShiftTimeLabel(start?: Date | string | null, end?: Date | string | null) {
  const fmt = (value: Date | string | null | undefined) => {
    if (!value) return "—";
    if (typeof value === "string") return value.slice(0, 5);
    const hh = String(value.getUTCHours()).padStart(2, "0");
    const mm = String(value.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };
  return `${fmt(start)}–${fmt(end)}`;
}

function mapShiftMismatchRow(row: {
  id: string;
  employeeId: string;
  workDate: Date | string;
  reason: string;
  employee?: {
    employeeCode?: string | null;
    displayName?: string | null;
    photoUrl?: string | null;
  } | null;
  fromShift?: {
    name?: string | null;
    startTime?: Date | string | null;
    endTime?: Date | string | null;
  } | null;
  toShift?: {
    name?: string | null;
    startTime?: Date | string | null;
    endTime?: Date | string | null;
  } | null;
  status?: { code?: string | null; name?: string | null } | null;
}): ShiftMismatchRow {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeCode: row.employee?.employeeCode ?? "—",
    employeeName: row.employee?.displayName ?? "—",
    photoUrl: row.employee?.photoUrl ?? null,
    statusCode: row.status?.code ?? "—",
    statusName: row.status?.name ?? row.status?.code ?? "—",
    workDate: isoDate(row.workDate) ?? "",
    fromShiftName: row.fromShift?.name ?? "—",
    toShiftName: row.toShift?.name ?? "—",
    fromTimeLabel: formatShiftTimeLabel(
      row.fromShift?.startTime,
      row.fromShift?.endTime,
    ),
    toTimeLabel: formatShiftTimeLabel(
      row.toShift?.startTime,
      row.toShift?.endTime,
    ),
    reason: row.reason,
  };
}

function mapAttendanceAdjustmentRow(row: {
  id: string;
  employeeId: string;
  workDate: Date | string;
  requestedClockInAt?: Date | string | null;
  requestedClockOutAt?: Date | string | null;
  reason: string;
  employee?: {
    employeeCode?: string | null;
    displayName?: string | null;
    photoUrl?: string | null;
  } | null;
  status?: { code?: string | null; name?: string | null } | null;
}): AttendanceAdjustmentRow {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeCode: row.employee?.employeeCode ?? "—",
    employeeName: row.employee?.displayName ?? "—",
    photoUrl: row.employee?.photoUrl ?? null,
    statusCode: row.status?.code ?? "—",
    statusName: row.status?.name ?? row.status?.code ?? "—",
    workDate: isoDate(row.workDate) ?? "",
    requestedClockInAt:
      row.requestedClockInAt instanceof Date
        ? row.requestedClockInAt.toISOString()
        : row.requestedClockInAt
          ? String(row.requestedClockInAt)
          : null,
    requestedClockOutAt:
      row.requestedClockOutAt instanceof Date
        ? row.requestedClockOutAt.toISOString()
        : row.requestedClockOutAt
          ? String(row.requestedClockOutAt)
          : null,
    reason: row.reason,
  };
}

export async function listLeaveRequests(
  ctx: HrRequestContext,
  status?: string | null,
  options?: { view?: "inbox" | "all" | null },
): Promise<HrDataResult<LeaveRequestRow[]>> {
  return safeRead<LeaveRequestRow[]>([], async () => {
    const rows = await listLeaveRequestsService(serviceContext(ctx), {
      status: status ?? null,
      view: options?.view ?? (status ? "all" : "inbox"),
    });
    return rows.map((row) => mapLeaveRequestRow(row));
  });
}

export async function listLeaveHistory(
  ctx: HrRequestContext,
  input: { page?: number; pageSize?: number } = {},
): Promise<HrDataResult<PagedResponse<LeaveRequestRow>>> {
  const empty: PagedResponse<LeaveRequestRow> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 10,
    pageCount: 1,
  };
  return safeRead(empty, async () => {
    const page = await listLeaveHistoryService(serviceContext(ctx), {
      page: input.page,
      pageSize: input.pageSize ?? 10,
    });
    return {
      ...page,
      rows: page.rows.map((row) => mapLeaveRequestRow(row)),
    };
  });
}

export async function listLeaveCoverCandidates(
  ctx: HrRequestContext,
  leaveRequestId: string,
): Promise<HrDataResult<LeaveCoverCandidate[]>> {
  return safeRead<LeaveCoverCandidate[]>([], async () => {
    const rows = await listLeaveCoverCandidatesService(serviceContext(ctx), {
      leaveRequestId,
    });
    return rows.map((row) => ({
      id: row.id,
      employeeCode: row.employeeCode,
      displayName: row.displayName,
      photoUrl: row.photoUrl ?? null,
      shiftId: row.shiftId ?? null,
      shiftName: row.shiftName,
      timeLabel: row.timeLabel ?? null,
      workDates: row.workDates ?? [],
    }));
  });
}

function mapOvertimeRequestRow(row: {
  id: string;
  employeeId: string;
  employee?: {
    employeeCode?: string | null;
    displayName?: string | null;
    photoUrl?: string | null;
  } | null;
  status?: { code?: string | null; name?: string | null } | null;
  workDate: Date | string;
  startAt: Date | string;
  endAt: Date | string;
  requestedMinutes: number;
  approvedMinutes?: number | null;
  reason?: string | null;
  submittedAt?: Date | string | null;
  createdAt?: Date | string | null;
}): OvertimeRequestRow {
  const submitted = row.submittedAt ?? row.createdAt ?? null;
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeCode: row.employee?.employeeCode ?? "—",
    employeeName: row.employee?.displayName ?? "—",
    photoUrl: row.employee?.photoUrl ?? null,
    statusCode: row.status?.code ?? "—",
    statusName: row.status?.name ?? row.status?.code ?? "—",
    workDate: isoDate(row.workDate) ?? "",
    startAt:
      row.startAt instanceof Date
        ? row.startAt.toISOString()
        : String(row.startAt ?? ""),
    endAt:
      row.endAt instanceof Date
        ? row.endAt.toISOString()
        : String(row.endAt ?? ""),
    requestedMinutes: row.requestedMinutes,
    approvedMinutes: row.approvedMinutes ?? null,
    reason: row.reason ?? null,
    submittedAt:
      submitted instanceof Date
        ? submitted.toISOString()
        : typeof submitted === "string"
          ? submitted
          : null,
  };
}

export async function listOvertimeRequests(
  ctx: HrRequestContext,
  status?: string | null,
  options?: { view?: "inbox" | "all" | null },
): Promise<HrDataResult<OvertimeRequestRow[]>> {
  return safeRead<OvertimeRequestRow[]>([], async () => {
    const rows = await listOvertimeRequestsService(serviceContext(ctx), {
      status: status ?? null,
      view: options?.view ?? (status ? "all" : "inbox"),
    });
    return rows.map((row) => mapOvertimeRequestRow(row));
  });
}

export async function listOvertimeHistory(
  ctx: HrRequestContext,
  input: { page?: number; pageSize?: number } = {},
): Promise<HrDataResult<PagedResponse<OvertimeRequestRow>>> {
  const empty: PagedResponse<OvertimeRequestRow> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 10,
    pageCount: 1,
  };
  return safeRead(empty, async () => {
    const page = await listOvertimeHistoryService(serviceContext(ctx), {
      page: input.page,
      pageSize: input.pageSize ?? 10,
    });
    return {
      ...page,
      rows: page.rows.map((row) => mapOvertimeRequestRow(row)),
    };
  });
}

export async function listLeaveBalances(
  ctx: HrRequestContext,
): Promise<HrDataResult<LeaveBalanceRow[]>> {
  return safeRead<LeaveBalanceRow[]>([], async () => {
    const rows = await listLeaveBalancesService(serviceContext(ctx));
    return rows.map((row) => ({
      id: row.id,
      employeeId: row.employeeId,
      employeeCode: row.employee?.employeeCode ?? "—",
      employeeName: row.employee?.displayName ?? "—",
      photoUrl: row.employee?.photoUrl ?? null,
      leaveTypeName: row.leaveType?.name ?? "—",
      balanceYear: row.balanceYear,
      openingBalance: Number(row.openingBalance),
      usedBalance: Number(row.usedBalance),
      availableBalance: Number(row.availableBalance),
    }));
  });
}

export async function getApprovalInbox(
  ctx: HrRequestContext,
): Promise<HrDataResult<ApprovalInboxData>> {
  return safeRead<ApprovalInboxData>(
    {
      leave: [],
      overtime: [],
      attendanceAdjustments: [],
      attendanceAdjustmentCount: 0,
      shiftMismatches: [],
      shiftMismatchCount: 0,
      advances: [],
    },
    async () => {
      const inbox = await approvalInboxService(serviceContext(ctx));
      const attendanceAdjustments = inbox.attendanceAdjustments.map((row) =>
        mapAttendanceAdjustmentRow(row),
      );
      const shiftMismatches = (inbox.shiftMismatches ?? []).map((row) =>
        mapShiftMismatchRow(row),
      );
      return {
        leave: inbox.leave.map((row) => mapLeaveRequestRow(row)),
        overtime: inbox.overtime.map((row) => mapOvertimeRequestRow(row)),
        attendanceAdjustments,
        attendanceAdjustmentCount: attendanceAdjustments.length,
        shiftMismatches,
        shiftMismatchCount: shiftMismatches.length,
        advances: inbox.advances ?? [],
      };
    },
  );
}

export async function listAttendanceAdjustments(
  ctx: HrRequestContext,
  status?: string | null,
): Promise<HrDataResult<AttendanceAdjustmentRow[]>> {
  return safeRead<AttendanceAdjustmentRow[]>([], async () => {
    const rows = await listAttendanceAdjustmentsService(serviceContext(ctx), {
      status: status ?? null,
    });
    return rows.map((row) => mapAttendanceAdjustmentRow(row));
  });
}

