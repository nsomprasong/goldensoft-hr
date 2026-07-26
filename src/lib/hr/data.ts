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
import { getHrDashboard } from "@/lib/hr/services/dashboard";
import { listDepartments as listDepartmentsService } from "@/lib/hr/services/departments";
import {
  getEmployee as getEmployeeService,
  listEmployees as listEmployeesService,
} from "@/lib/hr/services/employees";
import { listOvertimeRules as listOvertimeRulesService } from "@/lib/hr/services/overtime-rules";
import {
  getPayrollPeriod as getPayrollPeriodService,
  listPayrollPeriods as listPayrollPeriodsService,
} from "@/lib/hr/services/payroll-periods";
import { listPayrollSchedules as listPayrollSchedulesService } from "@/lib/hr/services/payroll-schedules";
import { listPositions as listPositionsService } from "@/lib/hr/services/positions";
import { listShifts as listShiftsService } from "@/lib/hr/services/shifts";
import {
  toHrServiceContext,
  type HrServiceContext,
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

function isoDate(value: Date | null | undefined): string | null {
  if (!value) return null;
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

export type HrDashboard = {
  activeEmployees: number;
  byBranch: Array<{ branchId: string; count: number }>;
  byEmploymentType: Array<{ code: string; nameTh: string; count: number }>;
  activeShifts: number;
  currentPeriod: PayrollPeriodRow | null;
};

const EMPTY_DASHBOARD: HrDashboard = {
  activeEmployees: 0,
  byBranch: [],
  byEmploymentType: [],
  activeShifts: 0,
  currentPeriod: null,
};

export async function loadHrDashboard(
  ctx: HrRequestContext,
): Promise<HrDataResult<HrDashboard>> {
  return safeRead(EMPTY_DASHBOARD, async (repository) => {
    const service = serviceContext(ctx);
    const summary = await getHrDashboard(repository, service);

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

    return {
      activeEmployees: summary.activeEmployees.total,
      byBranch: summary.activeEmployees.byBranch.map((row) => ({
        branchId: row.id,
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
    };
  });
}

// ─── Employees ────────────────────────────────────────────────────────────

export const EMPLOYEE_PAGE_SIZE = 20;

export type EmployeeRow = {
  id: string;
  employeeCode: string;
  displayName: string;
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
  wageTypeNameTh: string;
  amount: string;
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
      wageTypeNameTh: byId.get(row.wageTypeId) ?? "—",
      amount: row.amount.toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
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
