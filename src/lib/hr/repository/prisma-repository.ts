/**
 * Prisma-backed {@link HrRepository}. Only loaded when a DATABASE_URL exists;
 * the domain test-suite runs against the memory repository instead.
 */
import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "@/lib/prisma";
import { parseTimeToMinutes, timeMinutesToDate } from "@/lib/hr/shift-math";
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

type MasterRow = {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
};

type MasterDelegate = {
  findMany(args: unknown): Promise<MasterRow[]>;
  findUnique(args: unknown): Promise<MasterRow | null>;
  findFirst(args: unknown): Promise<MasterRow | null>;
  upsert(args: unknown): Promise<MasterRow>;
};

function decimalToNumber(value: Prisma.Decimal | number | null): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Number(value.toString());
}

function containsInsensitive(search: string): Prisma.StringFilter {
  return { contains: search, mode: "insensitive" };
}

export function createPrismaHrRepository(
  client: PrismaClient = defaultPrisma,
): HrRepository {
  const masterDelegate = (kind: HrMasterKind): MasterDelegate =>
    (client as unknown as Record<string, MasterDelegate>)[kind];

  const toMaster = (row: MasterRow): MasterRecord => ({
    id: row.id,
    code: row.code,
    nameTh: row.nameTh,
    nameEn: row.nameEn,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    isSystem: row.isSystem,
  });

  const toShift = (row: {
    id: string;
    organizationId: string;
    branchId: string | null;
    code: string;
    name: string;
    shiftTypeId: string;
    startTime: Date;
    endTime: Date;
    breakMinutes: number;
    graceLateMinutes: number;
    graceEarlyLeaveMinutes: number;
    crossesMidnight: boolean;
    standardWorkMinutes: number;
    overtimeAfterMinutes: number | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ShiftRecord => ({
    id: row.id,
    organizationId: row.organizationId,
    branchId: row.branchId,
    code: row.code,
    name: row.name,
    shiftTypeId: row.shiftTypeId,
    startMinutes: parseTimeToMinutes(row.startTime),
    endMinutes: parseTimeToMinutes(row.endTime),
    breakMinutes: row.breakMinutes,
    graceLateMinutes: row.graceLateMinutes,
    graceEarlyLeaveMinutes: row.graceEarlyLeaveMinutes,
    crossesMidnight: row.crossesMidnight,
    standardWorkMinutes: row.standardWorkMinutes,
    overtimeAfterMinutes: row.overtimeAfterMinutes,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  const toOvertimeRule = (row: {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    rateTypeId: string;
    multiplier: Prisma.Decimal;
    fixedAmount: Prisma.Decimal | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): OvertimeRuleRecord => ({
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    name: row.name,
    rateTypeId: row.rateTypeId,
    multiplier: decimalToNumber(row.multiplier) ?? 0,
    fixedAmount: decimalToNumber(row.fixedAmount),
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  const toCompensation = (row: {
    id: string;
    employeeId: string;
    wageTypeId: string;
    amount: Prisma.Decimal;
    currency: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    standardHoursPerDay: Prisma.Decimal | null;
    standardDaysPerMonth: Prisma.Decimal | null;
    overtimeEligible: boolean;
    isCurrent: boolean;
    createdBy: string;
    createdAt: Date;
  }): CompensationRecord => ({
    id: row.id,
    employeeId: row.employeeId,
    wageTypeId: row.wageTypeId,
    amount: decimalToNumber(row.amount) ?? 0,
    currency: row.currency,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    standardHoursPerDay: decimalToNumber(row.standardHoursPerDay),
    standardDaysPerMonth: decimalToNumber(row.standardDaysPerMonth),
    overtimeEligible: row.overtimeEligible,
    isCurrent: row.isCurrent,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  });

  return {
    masters: {
      async list(kind, options) {
        const rows = await masterDelegate(kind).findMany({
          where: options?.activeOnly ? { isActive: true } : {},
          orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        });
        return rows.map(toMaster);
      },
      async findById(kind, id) {
        const row = await masterDelegate(kind).findUnique({ where: { id } });
        return row ? toMaster(row) : null;
      },
      async findByCode(kind, code) {
        const row = await masterDelegate(kind).findUnique({ where: { code } });
        return row ? toMaster(row) : null;
      },
      async upsert(kind, row: MasterUpsertInput) {
        const existing = await masterDelegate(kind).findUnique({
          where: { code: row.code },
        });
        const saved = await masterDelegate(kind).upsert({
          where: { code: row.code },
          update: {
            nameTh: row.nameTh,
            nameEn: row.nameEn,
            sortOrder: row.sortOrder,
          },
          create: { ...row, isActive: true, isSystem: true },
        });
        return { record: toMaster(saved), created: existing === null };
      },
    },

    departments: {
      async list(input) {
        const where: Prisma.DepartmentWhereInput = {
          organizationId: input.organizationId,
          ...(input.isActive == null ? {} : { isActive: input.isActive }),
          ...(input.search
            ? {
                OR: [
                  { code: containsInsensitive(input.search) },
                  { nameTh: containsInsensitive(input.search) },
                  { nameEn: containsInsensitive(input.search) },
                ],
              }
            : {}),
        };
        const [rows, total] = await Promise.all([
          client.department.findMany({
            where,
            orderBy: { code: "asc" },
            skip: input.skip,
            take: input.take,
          }),
          client.department.count({ where }),
        ]);
        return { rows, total };
      },
      findById: async (organizationId, id) =>
        client.department.findFirst({ where: { id, organizationId } }),
      findByCode: async (organizationId, code) =>
        client.department.findUnique({
          where: { organizationId_code: { organizationId, code } },
        }),
      create: async (input: DepartmentCreateInput) =>
        client.department.create({ data: input }),
      update: async (id, patch: DepartmentPatch) =>
        client.department.update({ where: { id }, data: patch }),
    },

    positions: {
      async list(input) {
        const where: Prisma.PositionWhereInput = {
          organizationId: input.organizationId,
          ...(input.departmentId == null
            ? {}
            : { departmentId: input.departmentId }),
          ...(input.isActive == null ? {} : { isActive: input.isActive }),
          ...(input.search
            ? {
                OR: [
                  { code: containsInsensitive(input.search) },
                  { nameTh: containsInsensitive(input.search) },
                  { nameEn: containsInsensitive(input.search) },
                ],
              }
            : {}),
        };
        const [rows, total] = await Promise.all([
          client.position.findMany({
            where,
            orderBy: { code: "asc" },
            skip: input.skip,
            take: input.take,
          }),
          client.position.count({ where }),
        ]);
        return { rows, total };
      },
      findById: async (organizationId, id) =>
        client.position.findFirst({ where: { id, organizationId } }),
      findByCode: async (organizationId, code) =>
        client.position.findUnique({
          where: { organizationId_code: { organizationId, code } },
        }),
      create: async (input: PositionCreateInput) =>
        client.position.create({ data: input }),
      update: async (id, patch: PositionPatch) =>
        client.position.update({ where: { id }, data: patch }),
    },

    employees: {
      async list(filter: EmployeeListFilter) {
        const where: Prisma.EmployeeWhereInput = {
          organizationId: filter.organizationId,
          ...(filter.branchIds == null
            ? {}
            : { branchId: { in: [...filter.branchIds] } }),
          ...(filter.branchId == null ? {} : { branchId: filter.branchId }),
          ...(filter.departmentId == null
            ? {}
            : { departmentId: filter.departmentId }),
          ...(filter.positionId == null
            ? {}
            : { positionId: filter.positionId }),
          ...(filter.employmentTypeId == null
            ? {}
            : { employmentTypeId: filter.employmentTypeId }),
          ...(filter.employeeStatusId == null
            ? {}
            : { employeeStatusId: filter.employeeStatusId }),
          ...(filter.isActive == null ? {} : { isActive: filter.isActive }),
          ...(filter.search
            ? {
                OR: [
                  { employeeCode: containsInsensitive(filter.search) },
                  { displayName: containsInsensitive(filter.search) },
                  { firstNameTh: containsInsensitive(filter.search) },
                  { lastNameTh: containsInsensitive(filter.search) },
                  { email: containsInsensitive(filter.search) },
                  { phone: containsInsensitive(filter.search) },
                ],
              }
            : {}),
        };
        const [rows, total] = await Promise.all([
          client.employee.findMany({
            where,
            orderBy: { employeeCode: "asc" },
            skip: filter.skip,
            take: filter.take,
          }),
          client.employee.count({ where }),
        ]);
        return { rows, total };
      },
      findById: async (organizationId, id) =>
        client.employee.findFirst({ where: { id, organizationId } }),
      findByIdAnyOrganization: async (id) =>
        client.employee.findUnique({ where: { id } }),
      findByCode: async (organizationId, employeeCode) =>
        client.employee.findUnique({
          where: { organizationId_employeeCode: { organizationId, employeeCode } },
        }),
      findByPlatformUserId: async (organizationId, platformUserId) =>
        client.employee.findFirst({
          where: { organizationId, platformUserId },
          orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        }),
      findByAuthUserId: async (organizationId, authUserId, options) =>
        client.employee.findFirst({
          where: {
            organizationId,
            authUserId,
            ...(options?.activeOnly ? { isActive: true } : {}),
          },
          orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        }),
      create: async (input: EmployeeCreateInput) =>
        client.employee.create({ data: input }),
      update: async (id, patch: EmployeePatch) =>
        client.employee.update({ where: { id }, data: patch }),
      async countActive(organizationId, options): Promise<EmployeeActiveCounts> {
        const where: Prisma.EmployeeWhereInput = {
          organizationId,
          isActive: true,
          ...(options?.branchIds != null
            ? { branchId: { in: [...options.branchIds] } }
            : {}),
        };
        const [total, byBranch, byType] = await Promise.all([
          client.employee.count({ where }),
          client.employee.groupBy({
            by: ["branchId"],
            where,
            _count: { _all: true },
          }),
          client.employee.groupBy({
            by: ["employmentTypeId"],
            where,
            _count: { _all: true },
          }),
        ]);
        return {
          total,
          byBranchId: Object.fromEntries(
            byBranch.map((row) => [row.branchId, row._count._all]),
          ),
          byEmploymentTypeId: Object.fromEntries(
            byType.map((row) => [row.employmentTypeId, row._count._all]),
          ),
        };
      },
    },

    compensations: {
      async listByEmployee(employeeId) {
        const rows = await client.employeeCompensation.findMany({
          where: { employeeId },
          orderBy: { effectiveFrom: "desc" },
        });
        return rows.map(toCompensation);
      },
      async findCurrent(employeeId) {
        const row = await client.employeeCompensation.findFirst({
          where: { employeeId, isCurrent: true },
          orderBy: { effectiveFrom: "desc" },
        });
        return row ? toCompensation(row) : null;
      },
      async create(input: CompensationCreateInput) {
        const row = await client.employeeCompensation.create({ data: input });
        return toCompensation(row);
      },
      async update(id, patch: CompensationPatch) {
        const row = await client.employeeCompensation.update({
          where: { id },
          data: patch,
        });
        return toCompensation(row);
      },
    },

    overtimeRules: {
      async list(input) {
        const where: Prisma.OvertimeRuleWhereInput = {
          organizationId: input.organizationId,
          ...(input.rateTypeId == null ? {} : { rateTypeId: input.rateTypeId }),
          ...(input.isActive == null ? {} : { isActive: input.isActive }),
          ...(input.search
            ? {
                OR: [
                  { code: containsInsensitive(input.search) },
                  { name: containsInsensitive(input.search) },
                ],
              }
            : {}),
        };
        const [rows, total] = await Promise.all([
          client.overtimeRule.findMany({
            where,
            orderBy: { code: "asc" },
            skip: input.skip,
            take: input.take,
          }),
          client.overtimeRule.count({ where }),
        ]);
        return { rows: rows.map(toOvertimeRule), total };
      },
      async findById(organizationId, id) {
        const row = await client.overtimeRule.findFirst({
          where: { id, organizationId },
        });
        return row ? toOvertimeRule(row) : null;
      },
      async findByCode(organizationId, code) {
        const row = await client.overtimeRule.findUnique({
          where: { organizationId_code: { organizationId, code } },
        });
        return row ? toOvertimeRule(row) : null;
      },
      async create(input: OvertimeRuleCreateInput) {
        const row = await client.overtimeRule.create({ data: input });
        return toOvertimeRule(row);
      },
      async update(id, patch: OvertimeRulePatch) {
        const row = await client.overtimeRule.update({
          where: { id },
          data: patch,
        });
        return toOvertimeRule(row);
      },
    },

    shifts: {
      async list(input) {
        const where: Prisma.ShiftWhereInput = {
          organizationId: input.organizationId,
          ...(input.branchIds == null
            ? {}
            : { OR: [{ branchId: null }, { branchId: { in: [...input.branchIds] } }] }),
          ...(input.isActive == null ? {} : { isActive: input.isActive }),
          ...(input.search
            ? {
                AND: [
                  {
                    OR: [
                      { code: containsInsensitive(input.search) },
                      { name: containsInsensitive(input.search) },
                    ],
                  },
                ],
              }
            : {}),
        };
        const [rows, total] = await Promise.all([
          client.shift.findMany({
            where,
            orderBy: { code: "asc" },
            skip: input.skip,
            take: input.take,
          }),
          client.shift.count({ where }),
        ]);
        return { rows: rows.map(toShift), total };
      },
      async findById(organizationId, id) {
        const row = await client.shift.findFirst({
          where: { id, organizationId },
        });
        return row ? toShift(row) : null;
      },
      async findByCode(organizationId, code) {
        const row = await client.shift.findUnique({
          where: { organizationId_code: { organizationId, code } },
        });
        return row ? toShift(row) : null;
      },
      async create(input: ShiftCreateInput) {
        const { startMinutes, endMinutes, ...rest } = input;
        const row = await client.shift.create({
          data: {
            ...rest,
            startTime: timeMinutesToDate(startMinutes),
            endTime: timeMinutesToDate(endMinutes),
          },
        });
        return toShift(row);
      },
      async update(id, patch: ShiftPatch) {
        const { startMinutes, endMinutes, ...rest } = patch;
        const row = await client.shift.update({
          where: { id },
          data: {
            ...rest,
            ...(startMinutes === undefined
              ? {}
              : { startTime: timeMinutesToDate(startMinutes) }),
            ...(endMinutes === undefined
              ? {}
              : { endTime: timeMinutesToDate(endMinutes) }),
          },
        });
        return toShift(row);
      },
      countActive: async (organizationId) =>
        client.shift.count({ where: { organizationId, isActive: true } }),
    },

    payrollSchedules: {
      async list(input) {
        const where: Prisma.PayrollScheduleWhereInput = {
          organizationId: input.organizationId,
          ...(input.isActive == null ? {} : { isActive: input.isActive }),
        };
        const [rows, total] = await Promise.all([
          client.payrollSchedule.findMany({
            where,
            orderBy: { code: "asc" },
            skip: input.skip,
            take: input.take,
          }),
          client.payrollSchedule.count({ where }),
        ]);
        return { rows, total };
      },
      findById: async (organizationId, id) =>
        client.payrollSchedule.findFirst({ where: { id, organizationId } }),
      findByCode: async (organizationId, code) =>
        client.payrollSchedule.findUnique({
          where: { organizationId_code: { organizationId, code } },
        }),
      create: async (input: PayrollScheduleCreateInput) =>
        client.payrollSchedule.create({ data: input }),
      update: async (id, patch: PayrollSchedulePatch) =>
        client.payrollSchedule.update({ where: { id }, data: patch }),
    },

    payrollPeriods: {
      async list(filter: PayrollPeriodListFilter) {
        const where: Prisma.PayrollPeriodWhereInput = {
          organizationId: filter.organizationId,
          ...(filter.payrollScheduleId == null
            ? {}
            : { payrollScheduleId: filter.payrollScheduleId }),
          ...(filter.statusIds == null
            ? {}
            : { statusId: { in: [...filter.statusIds] } }),
        };
        const [rows, total] = await Promise.all([
          client.payrollPeriod.findMany({
            where,
            orderBy: { periodStart: "asc" },
            skip: filter.skip,
            take: filter.take,
          }),
          client.payrollPeriod.count({ where }),
        ]);
        return { rows, total };
      },
      findById: async (organizationId, id) =>
        client.payrollPeriod.findFirst({ where: { id, organizationId } }),
      findByRange: async (input) =>
        client.payrollPeriod.findFirst({
          where: {
            organizationId: input.organizationId,
            payrollScheduleId: input.payrollScheduleId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
          },
        }),
      create: async (input: PayrollPeriodCreateInput) =>
        client.payrollPeriod.create({ data: input }),
      update: async (id, patch: PayrollPeriodPatch) =>
        client.payrollPeriod.update({ where: { id }, data: patch }),
    },

    audit: {
      async create(input: AuditLogCreateInput): Promise<AuditLogRecord> {
        const row = await client.auditLog.create({
          data: {
            organizationId: input.organizationId,
            branchId: input.branchId,
            actorAuthUserId: input.actorAuthUserId,
            actionTypeId: input.actionTypeId,
            entityType: input.entityType,
            entityId: input.entityId,
            beforeJson: (input.beforeJson ?? null) as Prisma.InputJsonValue,
            afterJson: (input.afterJson ?? null) as Prisma.InputJsonValue,
            ip: input.ip,
            userAgent: input.userAgent,
          },
        });
        return { ...row, actionCode: input.actionCode };
      },
      async listByEntity(organizationId, entityType, entityId) {
        const rows = await client.auditLog.findMany({
          where: { organizationId, entityType, entityId },
          orderBy: { createdAt: "desc" },
          include: { actionType: { select: { code: true } } },
        });
        return rows.map((row) => ({
          ...row,
          actionCode: row.actionType.code,
        }));
      },
    },
  };
}
