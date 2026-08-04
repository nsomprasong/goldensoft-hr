/**
 * In-memory implementation of {@link HrRepository}. Reads return copies so a
 * caller can never mutate stored state by accident.
 */
import { HrError } from "@/lib/hr/errors";
import {
  createSeededHrMemoryStore,
  newId,
  type HrMemoryStore,
} from "@/lib/hr/repository/memory-store";
import type {
  AuditLogCreateInput,
  AuditLogRecord,
  CompensationCreateInput,
  CompensationPatch,
  CompensationRecord,
  DepartmentCreateInput,
  DepartmentPatch,
  DepartmentRecord,
  EmployeeActiveCounts,
  EmployeeCreateInput,
  EmployeeListFilter,
  EmployeePatch,
  EmployeeRecord,
  HrMasterKind,
  HrRepository,
  ListResult,
  MasterRecord,
  MasterUpsertInput,
  OvertimeRuleCreateInput,
  OvertimeRulePatch,
  OvertimeRuleRecord,
  PayrollPeriodCreateInput,
  PayrollPeriodListFilter,
  PayrollPeriodPatch,
  PayrollPeriodRecord,
  PayrollScheduleCreateInput,
  PayrollSchedulePatch,
  PayrollScheduleRecord,
  PositionCreateInput,
  PositionPatch,
  PositionRecord,
  ShiftCreateInput,
  ShiftPatch,
  ShiftRecord,
} from "@/lib/hr/repository/types";
import { deterministicUuid } from "@/lib/hr/repository/memory-store";

function clone<T>(value: T): T {
  return { ...value };
}

function cloneAll<T>(rows: T[]): T[] {
  return rows.map((row) => clone(row));
}

function paginate<T>(rows: T[], skip: number, take: number): ListResult<T> {
  return { rows: cloneAll(rows.slice(skip, skip + take)), total: rows.length };
}

function matches(haystack: Array<string | null | undefined>, needle: string) {
  const term = needle.trim().toLowerCase();
  if (!term) return true;
  return haystack.some((value) => value?.toLowerCase().includes(term));
}

function requireRow<T>(row: T | undefined, label: string): T {
  if (!row) {
    throw new HrError("NOT_FOUND", { details: { entity: label } });
  }
  return row;
}

function applyPatch<T extends object>(target: T, patch: Partial<T>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    (target as Record<string, unknown>)[key] = value;
  }
}

export function createMemoryHrRepository(
  store: HrMemoryStore = createSeededHrMemoryStore(),
): HrRepository & { store: HrMemoryStore } {
  const now = () => new Date();

  const masters = {
    async list(kind: HrMasterKind, options?: { activeOnly?: boolean }) {
      const rows = store.masters[kind]
        .filter((row) => (options?.activeOnly ? row.isActive : true))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
      return cloneAll(rows);
    },
    async findById(kind: HrMasterKind, id: string) {
      const hit = store.masters[kind].find((row) => row.id === id);
      return hit ? clone(hit) : null;
    },
    async findByCode(kind: HrMasterKind, code: string) {
      const hit = store.masters[kind].find((row) => row.code === code);
      return hit ? clone(hit) : null;
    },
    async upsert(kind: HrMasterKind, row: MasterUpsertInput) {
      const existing = store.masters[kind].find((m) => m.code === row.code);
      if (existing) {
        existing.nameTh = row.nameTh;
        existing.nameEn = row.nameEn;
        existing.sortOrder = row.sortOrder;
        return { record: clone(existing), created: false };
      }
      const record: MasterRecord = {
        id: deterministicUuid(kind, row.code),
        code: row.code,
        nameTh: row.nameTh,
        nameEn: row.nameEn,
        description: null,
        sortOrder: row.sortOrder,
        isActive: true,
        isSystem: true,
      };
      store.masters[kind].push(record);
      return { record: clone(record), created: true };
    },
  };

  const departments = {
    async list(input: {
      organizationId: string;
      isActive?: boolean | null;
      search?: string | null;
      skip: number;
      take: number;
    }) {
      const rows = store.departments
        .filter((row) => row.organizationId === input.organizationId)
        .filter((row) =>
          input.isActive == null ? true : row.isActive === input.isActive,
        )
        .filter((row) =>
          input.search
            ? matches([row.code, row.nameTh, row.nameEn], input.search)
            : true,
        )
        .sort((a, b) => a.code.localeCompare(b.code));
      return paginate(rows, input.skip, input.take);
    },
    async findById(organizationId: string, id: string) {
      const hit = store.departments.find(
        (row) => row.id === id && row.organizationId === organizationId,
      );
      return hit ? clone(hit) : null;
    },
    async findByCode(organizationId: string, code: string) {
      const hit = store.departments.find(
        (row) => row.organizationId === organizationId && row.code === code,
      );
      return hit ? clone(hit) : null;
    },
    async create(input: DepartmentCreateInput) {
      const record: DepartmentRecord = {
        ...input,
        id: newId(),
        createdAt: now(),
        updatedAt: now(),
      };
      store.departments.push(record);
      return clone(record);
    },
    async update(id: string, patch: DepartmentPatch) {
      const row = requireRow(
        store.departments.find((item) => item.id === id),
        "department",
      );
      applyPatch(row, patch);
      row.updatedAt = now();
      return clone(row);
    },
  };

  const positions = {
    async list(input: {
      organizationId: string;
      departmentId?: string | null;
      isActive?: boolean | null;
      search?: string | null;
      skip: number;
      take: number;
    }) {
      const rows = store.positions
        .filter((row) => row.organizationId === input.organizationId)
        .filter((row) =>
          input.departmentId == null
            ? true
            : row.departmentId === input.departmentId,
        )
        .filter((row) =>
          input.isActive == null ? true : row.isActive === input.isActive,
        )
        .filter((row) =>
          input.search
            ? matches([row.code, row.nameTh, row.nameEn], input.search)
            : true,
        )
        .sort((a, b) => a.code.localeCompare(b.code));
      return paginate(rows, input.skip, input.take);
    },
    async findById(organizationId: string, id: string) {
      const hit = store.positions.find(
        (row) => row.id === id && row.organizationId === organizationId,
      );
      return hit ? clone(hit) : null;
    },
    async findByCode(organizationId: string, code: string) {
      const hit = store.positions.find(
        (row) => row.organizationId === organizationId && row.code === code,
      );
      return hit ? clone(hit) : null;
    },
    async create(input: PositionCreateInput) {
      const record: PositionRecord = {
        ...input,
        id: newId(),
        createdAt: now(),
        updatedAt: now(),
      };
      store.positions.push(record);
      return clone(record);
    },
    async update(id: string, patch: PositionPatch) {
      const row = requireRow(
        store.positions.find((item) => item.id === id),
        "position",
      );
      applyPatch(row, patch);
      row.updatedAt = now();
      return clone(row);
    },
  };

  const employees = {
    async list(filter: EmployeeListFilter) {
      const rows = store.employees
        .filter((row) => row.organizationId === filter.organizationId)
        .filter((row) =>
          filter.branchIds == null
            ? true
            : filter.branchIds.includes(row.branchId),
        )
        .filter((row) =>
          filter.branchId == null ? true : row.branchId === filter.branchId,
        )
        .filter((row) =>
          filter.departmentId == null
            ? true
            : row.departmentId === filter.departmentId,
        )
        .filter((row) =>
          filter.positionId == null
            ? true
            : row.positionId === filter.positionId,
        )
        .filter((row) =>
          filter.employmentTypeId == null
            ? true
            : row.employmentTypeId === filter.employmentTypeId,
        )
        .filter((row) =>
          filter.employeeStatusId == null
            ? true
            : row.employeeStatusId === filter.employeeStatusId,
        )
        .filter((row) =>
          filter.isActive == null ? true : row.isActive === filter.isActive,
        )
        .filter((row) =>
          filter.search
            ? matches(
                [
                  row.employeeCode,
                  row.displayName,
                  row.firstNameTh,
                  row.lastNameTh,
                  row.firstNameEn,
                  row.lastNameEn,
                  row.email,
                  row.phone,
                ],
                filter.search,
              )
            : true,
        )
        .sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));
      return paginate(rows, filter.skip, filter.take);
    },
    async findById(organizationId: string, id: string) {
      const hit = store.employees.find(
        (row) => row.id === id && row.organizationId === organizationId,
      );
      return hit ? clone(hit) : null;
    },
    async findByIdAnyOrganization(id: string) {
      const hit = store.employees.find((row) => row.id === id);
      return hit ? clone(hit) : null;
    },
    async findByCode(organizationId: string, employeeCode: string) {
      const hit = store.employees.find(
        (row) =>
          row.organizationId === organizationId &&
          row.employeeCode === employeeCode,
      );
      return hit ? clone(hit) : null;
    },
    async findByPlatformUserId(organizationId: string, platformUserId: string) {
      const rows = store.employees.filter(
        (row) =>
          row.organizationId === organizationId &&
          row.platformUserId === platformUserId,
      );
      const hit =
        rows.find((row) => row.isActive) ??
        rows[0] ??
        null;
      return hit ? clone(hit) : null;
    },
    async findByAuthUserId(
      organizationId: string,
      authUserId: string,
      options?: { activeOnly?: boolean },
    ) {
      let rows = store.employees.filter(
        (row) =>
          row.organizationId === organizationId &&
          row.authUserId === authUserId,
      );
      if (options?.activeOnly) {
        rows = rows.filter((row) => row.isActive);
      }
      const hit = rows.find((row) => row.isActive) ?? rows[0] ?? null;
      return hit ? clone(hit) : null;
    },
    async create(input: EmployeeCreateInput) {
      const record: EmployeeRecord = {
        ...input,
        id: newId(),
        createdAt: now(),
        updatedAt: now(),
      };
      store.employees.push(record);
      return clone(record);
    },
    async update(id: string, patch: EmployeePatch) {
      const row = requireRow(
        store.employees.find((item) => item.id === id),
        "employee",
      );
      applyPatch(row, patch);
      row.updatedAt = now();
      return clone(row);
    },
    async countActive(
      organizationId: string,
      options?: { branchIds?: readonly string[] | null },
    ): Promise<EmployeeActiveCounts> {
      const rows = store.employees.filter(
        (row) =>
          row.organizationId === organizationId &&
          row.isActive &&
          (options?.branchIds == null ||
            options.branchIds.includes(row.branchId)),
      );
      const byBranchId: Record<string, number> = {};
      const byEmploymentTypeId: Record<string, number> = {};
      for (const row of rows) {
        byBranchId[row.branchId] = (byBranchId[row.branchId] ?? 0) + 1;
        byEmploymentTypeId[row.employmentTypeId] =
          (byEmploymentTypeId[row.employmentTypeId] ?? 0) + 1;
      }
      return { total: rows.length, byBranchId, byEmploymentTypeId };
    },
  };

  const compensations = {
    async listByEmployee(employeeId: string) {
      const rows = store.compensations
        .filter((row) => row.employeeId === employeeId)
        .sort(
          (a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime(),
        );
      return cloneAll(rows);
    },
    async findCurrent(employeeId: string) {
      const hit = store.compensations.find(
        (row) => row.employeeId === employeeId && row.isCurrent,
      );
      return hit ? clone(hit) : null;
    },
    async create(input: CompensationCreateInput) {
      const record: CompensationRecord = {
        ...input,
        id: newId(),
        createdAt: now(),
      };
      store.compensations.push(record);
      return clone(record);
    },
    async update(id: string, patch: CompensationPatch) {
      const row = requireRow(
        store.compensations.find((item) => item.id === id),
        "compensation",
      );
      applyPatch(row, patch);
      return clone(row);
    },
  };

  const overtimeRules = {
    async list(input: {
      organizationId: string;
      rateTypeId?: string | null;
      isActive?: boolean | null;
      search?: string | null;
      skip: number;
      take: number;
    }) {
      const rows = store.overtimeRules
        .filter((row) => row.organizationId === input.organizationId)
        .filter((row) =>
          input.rateTypeId == null ? true : row.rateTypeId === input.rateTypeId,
        )
        .filter((row) =>
          input.isActive == null ? true : row.isActive === input.isActive,
        )
        .filter((row) =>
          input.search ? matches([row.code, row.name], input.search) : true,
        )
        .sort((a, b) => a.code.localeCompare(b.code));
      return paginate(rows, input.skip, input.take);
    },
    async findById(organizationId: string, id: string) {
      const hit = store.overtimeRules.find(
        (row) => row.id === id && row.organizationId === organizationId,
      );
      return hit ? clone(hit) : null;
    },
    async findByCode(organizationId: string, code: string) {
      const hit = store.overtimeRules.find(
        (row) => row.organizationId === organizationId && row.code === code,
      );
      return hit ? clone(hit) : null;
    },
    async create(input: OvertimeRuleCreateInput) {
      const record: OvertimeRuleRecord = {
        ...input,
        id: newId(),
        createdAt: now(),
        updatedAt: now(),
      };
      store.overtimeRules.push(record);
      return clone(record);
    },
    async update(id: string, patch: OvertimeRulePatch) {
      const row = requireRow(
        store.overtimeRules.find((item) => item.id === id),
        "overtimeRule",
      );
      applyPatch(row, patch);
      row.updatedAt = now();
      return clone(row);
    },
  };

  const shifts = {
    async list(input: {
      organizationId: string;
      branchIds?: readonly string[] | null;
      isActive?: boolean | null;
      search?: string | null;
      skip: number;
      take: number;
    }) {
      const rows = store.shifts
        .filter((row) => row.organizationId === input.organizationId)
        .filter((row) =>
          input.branchIds == null || row.branchId == null
            ? true
            : input.branchIds.includes(row.branchId),
        )
        .filter((row) =>
          input.isActive == null ? true : row.isActive === input.isActive,
        )
        .filter((row) =>
          input.search ? matches([row.code, row.name], input.search) : true,
        )
        .sort((a, b) => a.code.localeCompare(b.code));
      return paginate(rows, input.skip, input.take);
    },
    async findById(organizationId: string, id: string) {
      const hit = store.shifts.find(
        (row) => row.id === id && row.organizationId === organizationId,
      );
      return hit ? clone(hit) : null;
    },
    async findByCode(organizationId: string, code: string) {
      const hit = store.shifts.find(
        (row) => row.organizationId === organizationId && row.code === code,
      );
      return hit ? clone(hit) : null;
    },
    async create(input: ShiftCreateInput) {
      const record: ShiftRecord = {
        ...input,
        id: newId(),
        createdAt: now(),
        updatedAt: now(),
      };
      store.shifts.push(record);
      return clone(record);
    },
    async update(id: string, patch: ShiftPatch) {
      const row = requireRow(
        store.shifts.find((item) => item.id === id),
        "shift",
      );
      applyPatch(row, patch);
      row.updatedAt = now();
      return clone(row);
    },
    async countActive(organizationId: string) {
      return store.shifts.filter(
        (row) => row.organizationId === organizationId && row.isActive,
      ).length;
    },
  };

  const payrollSchedules = {
    async list(input: {
      organizationId: string;
      isActive?: boolean | null;
      skip: number;
      take: number;
    }) {
      const rows = store.payrollSchedules
        .filter((row) => row.organizationId === input.organizationId)
        .filter((row) =>
          input.isActive == null ? true : row.isActive === input.isActive,
        )
        .sort((a, b) => a.code.localeCompare(b.code));
      return paginate(rows, input.skip, input.take);
    },
    async findById(organizationId: string, id: string) {
      const hit = store.payrollSchedules.find(
        (row) => row.id === id && row.organizationId === organizationId,
      );
      return hit ? clone(hit) : null;
    },
    async findByCode(organizationId: string, code: string) {
      const hit = store.payrollSchedules.find(
        (row) => row.organizationId === organizationId && row.code === code,
      );
      return hit ? clone(hit) : null;
    },
    async create(input: PayrollScheduleCreateInput) {
      const record: PayrollScheduleRecord = {
        ...input,
        id: newId(),
        createdAt: now(),
        updatedAt: now(),
      };
      store.payrollSchedules.push(record);
      return clone(record);
    },
    async update(id: string, patch: PayrollSchedulePatch) {
      const row = requireRow(
        store.payrollSchedules.find((item) => item.id === id),
        "payrollSchedule",
      );
      applyPatch(row, patch);
      row.updatedAt = now();
      return clone(row);
    },
  };

  const payrollPeriods = {
    async list(filter: PayrollPeriodListFilter) {
      const rows = store.payrollPeriods
        .filter((row) => row.organizationId === filter.organizationId)
        .filter((row) =>
          filter.payrollScheduleId == null
            ? true
            : row.payrollScheduleId === filter.payrollScheduleId,
        )
        .filter((row) =>
          filter.statusIds == null
            ? true
            : filter.statusIds.includes(row.statusId),
        )
        .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
      return paginate(rows, filter.skip, filter.take);
    },
    async findById(organizationId: string, id: string) {
      const hit = store.payrollPeriods.find(
        (row) => row.id === id && row.organizationId === organizationId,
      );
      return hit ? clone(hit) : null;
    },
    async findByRange(input: {
      organizationId: string;
      payrollScheduleId: string;
      periodStart: Date;
      periodEnd: Date;
    }) {
      const hit = store.payrollPeriods.find(
        (row) =>
          row.organizationId === input.organizationId &&
          row.payrollScheduleId === input.payrollScheduleId &&
          row.periodStart.getTime() === input.periodStart.getTime() &&
          row.periodEnd.getTime() === input.periodEnd.getTime(),
      );
      return hit ? clone(hit) : null;
    },
    async create(input: PayrollPeriodCreateInput) {
      const record: PayrollPeriodRecord = {
        ...input,
        id: newId(),
        createdAt: now(),
        updatedAt: now(),
      };
      store.payrollPeriods.push(record);
      return clone(record);
    },
    async update(id: string, patch: PayrollPeriodPatch) {
      const row = requireRow(
        store.payrollPeriods.find((item) => item.id === id),
        "payrollPeriod",
      );
      applyPatch(row, patch);
      row.updatedAt = now();
      return clone(row);
    },
  };

  const audit = {
    async create(input: AuditLogCreateInput) {
      const record: AuditLogRecord = {
        ...input,
        id: newId(),
        createdAt: now(),
      };
      store.auditLogs.push(record);
      return clone(record);
    },
    async listByEntity(
      organizationId: string,
      entityType: string,
      entityId: string,
    ) {
      return cloneAll(
        store.auditLogs.filter(
          (row) =>
            row.organizationId === organizationId &&
            row.entityType === entityType &&
            row.entityId === entityId,
        ),
      );
    },
  };

  return {
    store,
    masters,
    departments,
    positions,
    employees,
    compensations,
    overtimeRules,
    shifts,
    payrollSchedules,
    payrollPeriods,
    audit,
  };
}
