import { prisma } from "@/lib/prisma";
import { assertHrPermission } from "@/lib/hr/authorize";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import {
  employeeBranchWhere,
  type HrServiceContext,
} from "@/lib/hr/services/shared";
import { formatThaiDate, formatThaiDateRange } from "@/lib/hr/thai-date";

export {
  assertPayrollMutable,
  createPayrollRun,
  issuePayslips,
  payrollAction,
} from "@/lib/hr/services/operations";

function money(value: { toString(): string } | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

async function branchNamesById(
  organizationId: string,
): Promise<Map<string, string>> {
  const rows = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id::text AS id, name
    FROM platform.branches
    WHERE organization_id = ${organizationId}::uuid
      AND deleted_at IS NULL
  `;
  return new Map(rows.map((b) => [b.id, b.name]));
}

export type PayrollRunListItem = {
  id: string;
  runNumber: number;
  statusCode: string;
  statusNameTh: string;
  periodLabel: string;
  scheduleName: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  employeeCount: number;
  totalNet: number;
  createdAt: string;
  approvedAt: string | null;
};

export type PayrollRunEmployeeRow = {
  id: string;
  employeeId: string;
  displayName: string;
  photoUrl: string | null;
  branchName: string | null;
  /** รายรับรวม */
  earnings: number;
  tax: number;
  socialSecurity: number;
  advance: number;
  otherDeductions: number;
  grossEarnings: number;
  totalDeductions: number;
  /** คงเหลือ / สุทธิ */
  netPay: number;
  statusCode: string;
  statusNameTh: string;
  hasPayslip: boolean;
  items: Array<{
    id: string;
    code: string | null;
    description: string | null;
    amount: number;
    kind: "EARNING" | "DEDUCTION";
  }>;
};

export type PayrollRunDetail = PayrollRunListItem & {
  payrollPeriodId: string;
  /** สาขาที่กำลังดู (จาก header) — null = ทุกสาขา */
  branchLabel: string | null;
  employees: PayrollRunEmployeeRow[];
};

function summarizeItems(
  items: Array<{
    amount: number;
    kind: "EARNING" | "DEDUCTION";
    code: string | null;
  }>,
) {
  let earnings = 0;
  let tax = 0;
  let socialSecurity = 0;
  let advance = 0;
  let otherDeductions = 0;
  for (const item of items) {
    if (item.kind === "EARNING") {
      earnings += item.amount;
      continue;
    }
    const code = (item.code ?? "").toUpperCase();
    if (code === "TAX") tax += item.amount;
    else if (code === "SOCIAL_SECURITY") socialSecurity += item.amount;
    else if (code === "ADVANCE" || code === "LOAN") advance += item.amount;
    else otherDeductions += item.amount;
  }
  return { earnings, tax, socialSecurity, advance, otherDeductions };
}

export type PayslipListItem = {
  id: string;
  employeeId: string;
  displayName: string;
  photoUrl: string | null;
  branchName: string | null;
  payrollPeriodId: string;
  periodLabel: string;
  scheduleName: string;
  issuedAt: string | null;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  runNumber: number;
};

export type PayslipPeriodOption = {
  id: string;
  label: string;
  scheduleName: string;
  periodStart: string;
  periodEnd: string;
  /** Period containing today, or current open working period. */
  isCurrent: boolean;
};

export type PayslipDetail = PayslipListItem & {
  snapshot: unknown;
  items: Array<{
    description: string;
    amount: number;
    kind: "EARNING" | "DEDUCTION";
  }>;
};

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function listPayrollRuns(
  ctx: HrServiceContext,
): Promise<PayrollRunListItem[]> {
  assertHrPermission(ctx, HR_PERMISSIONS.payrollRead);
  const branchEmp = employeeBranchWhere(ctx);
  const rows = await prisma.payrollRun.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      status: true,
      payrollPeriod: { include: { payrollSchedule: true } },
      employees: {
        where: branchEmp.employee ? { employee: branchEmp.employee } : undefined,
        select: { netPay: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    runNumber: row.runNumber,
    statusCode: row.status.code,
    statusNameTh: row.status.nameTh,
    periodLabel: formatThaiDateRange(
      isoDate(row.payrollPeriod.periodStart),
      isoDate(row.payrollPeriod.periodEnd),
    ),
    scheduleName: row.payrollPeriod.payrollSchedule.name,
    periodStart: isoDate(row.payrollPeriod.periodStart),
    periodEnd: isoDate(row.payrollPeriod.periodEnd),
    paymentDate: isoDate(row.payrollPeriod.paymentDate),
    employeeCount: row.employees.length,
    totalNet: row.employees.reduce((sum, e) => sum + money(e.netPay), 0),
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
  }));
}

export async function getPayrollRun(
  ctx: HrServiceContext,
  id: string,
): Promise<PayrollRunDetail> {
  assertHrPermission(ctx, HR_PERMISSIONS.payrollRead);
  const branchEmp = employeeBranchWhere(ctx);
  const row = await prisma.payrollRun.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      status: true,
      payrollPeriod: { include: { payrollSchedule: true } },
      employees: {
        where: branchEmp.employee ? { employee: branchEmp.employee } : undefined,
        include: {
          status: true,
          payslip: { select: { id: true } },
          items: {
            include: { earningType: true, deductionType: true },
            orderBy: { createdAt: "asc" },
          },
          employee: {
            select: {
              id: true,
              displayName: true,
              photoUrl: true,
              branchId: true,
            },
          },
        },
        orderBy: { employee: { displayName: "asc" } },
      },
    },
  });
  if (!row) throw new HrError("NOT_FOUND", { message: "ไม่พบรายการประมวลผล" });

  const branchNameById = await branchNamesById(ctx.organizationId);
  const branchLabel = ctx.branchId
    ? (branchNameById.get(ctx.branchId) ?? "สาขาที่เลือก")
    : null;

  const employees = row.employees.map((emp) => {
    const items = emp.items.map((item) => {
      const kind = item.deductionTypeId
        ? ("DEDUCTION" as const)
        : ("EARNING" as const);
      const code =
        item.deductionType?.code ?? item.earningType?.code ?? null;
      return {
        id: item.id,
        code,
        description:
          item.description ??
          item.earningType?.name ??
          item.deductionType?.name ??
          null,
        amount: money(item.amount),
        kind,
      };
    });
    const breakdown = summarizeItems(items);
    return {
      id: emp.id,
      employeeId: emp.employeeId,
      displayName: emp.employee.displayName,
      photoUrl: emp.employee.photoUrl,
      branchName: emp.employee.branchId
        ? (branchNameById.get(emp.employee.branchId) ?? null)
        : null,
      earnings: breakdown.earnings || money(emp.grossEarnings),
      tax: breakdown.tax,
      socialSecurity: breakdown.socialSecurity,
      advance: breakdown.advance,
      otherDeductions: breakdown.otherDeductions,
      grossEarnings: money(emp.grossEarnings),
      totalDeductions: money(emp.totalDeductions),
      netPay: money(emp.netPay),
      statusCode: emp.status.code,
      statusNameTh: emp.status.nameTh,
      hasPayslip: emp.payslip != null,
      items,
    };
  });

  return {
    id: row.id,
    runNumber: row.runNumber,
    statusCode: row.status.code,
    statusNameTh: row.status.nameTh,
    payrollPeriodId: row.payrollPeriodId,
    branchLabel,
    periodLabel: formatThaiDateRange(
      isoDate(row.payrollPeriod.periodStart),
      isoDate(row.payrollPeriod.periodEnd),
    ),
    scheduleName: row.payrollPeriod.payrollSchedule.name,
    periodStart: isoDate(row.payrollPeriod.periodStart),
    periodEnd: isoDate(row.payrollPeriod.periodEnd),
    paymentDate: isoDate(row.payrollPeriod.paymentDate),
    employeeCount: employees.length,
    totalNet: employees.reduce((sum, e) => sum + e.netPay, 0),
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    employees,
  };
}

export async function listOrgPayslips(
  ctx: HrServiceContext,
): Promise<PayslipListItem[]> {
  assertHrPermission(ctx, HR_PERMISSIONS.payslipRead);
  const rows = await prisma.payslip.findMany({
    where: {
      payrollRunEmployee: {
        payrollRun: { organizationId: ctx.organizationId },
      },
      ...employeeBranchWhere(ctx),
    },
    include: {
      employee: {
        select: { id: true, displayName: true, photoUrl: true, branchId: true },
      },
      payrollRunEmployee: {
        include: {
          payrollRun: {
            include: {
              payrollPeriod: { include: { payrollSchedule: true } },
            },
          },
        },
      },
    },
    orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
  });

  const branchNameById = await branchNamesById(ctx.organizationId);

  return rows.map((row) => {
    const period = row.payrollRunEmployee.payrollRun.payrollPeriod;
    return {
      id: row.id,
      employeeId: row.employeeId,
      displayName: row.employee.displayName,
      photoUrl: row.employee.photoUrl,
      branchName: row.employee.branchId
        ? (branchNameById.get(row.employee.branchId) ?? null)
        : null,
      payrollPeriodId: period.id,
      periodLabel: formatThaiDateRange(
        isoDate(period.periodStart),
        isoDate(period.periodEnd),
      ),
      scheduleName: period.payrollSchedule.name,
      issuedAt: row.issuedAt?.toISOString() ?? null,
      grossEarnings: money(row.grossEarnings),
      totalDeductions: money(row.totalDeductions),
      netPay: money(row.netPay),
      runNumber: row.payrollRunEmployee.payrollRun.runNumber,
    };
  });
}

function bangkokTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Periods available in the payslip filter (newest first). */
export async function listPayslipPeriodOptions(
  ctx: HrServiceContext,
  options: { employeeId?: string | null } = {},
): Promise<PayslipPeriodOption[]> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.payslipRead,
    HR_PERMISSIONS.payslipSelf,
  ]);

  const today = bangkokTodayIso();
  const employeeId = String(options.employeeId ?? "").trim() || null;

  if (employeeId) {
    const rows = await prisma.payslip.findMany({
      where: {
        employeeId,
        payrollRunEmployee: {
          payrollRun: { organizationId: ctx.organizationId },
        },
      },
      select: {
        payrollRunEmployee: {
          select: {
            payrollRun: {
              select: {
                payrollPeriod: {
                  select: {
                    id: true,
                    periodStart: true,
                    periodEnd: true,
                    payrollSchedule: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const byId = new Map<
      string,
      Omit<PayslipPeriodOption, "isCurrent"> & { containsToday: boolean }
    >();
    for (const row of rows) {
      const period = row.payrollRunEmployee.payrollRun.payrollPeriod;
      if (byId.has(period.id)) continue;
      const periodStart = isoDate(period.periodStart);
      const periodEnd = isoDate(period.periodEnd);
      byId.set(period.id, {
        id: period.id,
        label: formatThaiDateRange(periodStart, periodEnd),
        scheduleName: period.payrollSchedule.name,
        periodStart,
        periodEnd,
        containsToday: periodStart <= today && today <= periodEnd,
      });
    }
    const sorted = [...byId.values()].sort((a, b) =>
      b.periodStart.localeCompare(a.periodStart),
    );
    const currentId =
      sorted.find((row) => row.containsToday)?.id ?? sorted[0]?.id ?? null;
    return sorted.map((row) => ({
      id: row.id,
      label: row.label,
      scheduleName: row.scheduleName,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      isCurrent: row.id === currentId,
    }));
  }

  const periods = await prisma.payrollPeriod.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      payrollSchedule: { select: { name: true } },
      status: { select: { code: true } },
    },
    orderBy: [{ periodStart: "desc" }],
    take: 60,
  });

  const openCodes = new Set(["OPEN", "CALCULATING", "REVIEW"]);
  const mapped = periods.map((period) => {
    const periodStart = isoDate(period.periodStart);
    const periodEnd = isoDate(period.periodEnd);
    return {
      id: period.id,
      label: formatThaiDateRange(periodStart, periodEnd),
      scheduleName: period.payrollSchedule.name,
      periodStart,
      periodEnd,
      containsToday: periodStart <= today && today <= periodEnd,
      isOpenWorking: openCodes.has(period.status.code),
    };
  });
  const currentId =
    mapped.find((row) => row.containsToday)?.id ??
    mapped.find((row) => row.isOpenWorking)?.id ??
    mapped[0]?.id ??
    null;
  return mapped.map((row) => ({
    id: row.id,
    label: row.label,
    scheduleName: row.scheduleName,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    isCurrent: row.id === currentId,
  }));
}

export function resolveDefaultPayslipPeriodId(
  periods: readonly PayslipPeriodOption[],
): string | null {
  return (
    periods.find((row) => row.isCurrent)?.id ?? periods[0]?.id ?? null
  );
}

export async function listSelfPayslips(
  ctx: HrServiceContext,
): Promise<PayslipListItem[]> {
  assertHrPermission(ctx, HR_PERMISSIONS.payslipSelf);
  const employee = await prisma.employee.findFirst({
    where: {
      organizationId: ctx.organizationId,
      OR: [{ authUserId: ctx.actorAuthUserId }],
    },
  });
  if (!employee) return [];

  const rows = await prisma.payslip.findMany({
    where: { employeeId: employee.id },
    include: {
      employee: {
        select: { id: true, displayName: true, photoUrl: true, branchId: true },
      },
      payrollRunEmployee: {
        include: {
          payrollRun: {
            include: {
              payrollPeriod: { include: { payrollSchedule: true } },
            },
          },
        },
      },
    },
    orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((row) => {
    const period = row.payrollRunEmployee.payrollRun.payrollPeriod;
    return {
      id: row.id,
      employeeId: row.employeeId,
      displayName: row.employee.displayName,
      photoUrl: row.employee.photoUrl,
      branchName: null,
      payrollPeriodId: period.id,
      periodLabel: formatThaiDateRange(
        isoDate(period.periodStart),
        isoDate(period.periodEnd),
      ),
      scheduleName: period.payrollSchedule.name,
      issuedAt: row.issuedAt?.toISOString() ?? null,
      grossEarnings: money(row.grossEarnings),
      totalDeductions: money(row.totalDeductions),
      netPay: money(row.netPay),
      runNumber: row.payrollRunEmployee.payrollRun.runNumber,
    };
  });
}

export async function getPayslip(
  ctx: HrServiceContext,
  id: string,
): Promise<PayslipDetail> {
  const row = await prisma.payslip.findFirst({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          displayName: true,
          photoUrl: true,
          branchId: true,
          organizationId: true,
          authUserId: true,
        },
      },
      payrollRunEmployee: {
        include: {
          items: {
            include: { earningType: true, deductionType: true },
            orderBy: { createdAt: "asc" },
          },
          payrollRun: {
            include: {
              payrollPeriod: { include: { payrollSchedule: true } },
            },
          },
        },
      },
    },
  });
  if (!row || row.employee.organizationId !== ctx.organizationId) {
    throw new HrError("NOT_FOUND", { message: "ไม่พบสลิปเงินเดือน" });
  }

  const isSelf = row.employee.authUserId === ctx.actorAuthUserId;
  if (isSelf) {
    assertHrPermission(ctx, HR_PERMISSIONS.payslipSelf);
  } else {
    assertHrPermission(ctx, HR_PERMISSIONS.payslipRead);
  }

  const period = row.payrollRunEmployee.payrollRun.payrollPeriod;
  return {
    id: row.id,
    employeeId: row.employeeId,
    displayName: row.employee.displayName,
    photoUrl: row.employee.photoUrl,
    branchName: null,
    payrollPeriodId: period.id,
    periodLabel: formatThaiDateRange(
      isoDate(period.periodStart),
      isoDate(period.periodEnd),
    ),
    scheduleName: period.payrollSchedule.name,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    grossEarnings: money(row.grossEarnings),
    totalDeductions: money(row.totalDeductions),
    netPay: money(row.netPay),
    runNumber: row.payrollRunEmployee.payrollRun.runNumber,
    snapshot: row.snapshot,
    items: row.payrollRunEmployee.items.map((item) => ({
      description:
        item.description ??
        item.earningType?.name ??
        item.deductionType?.name ??
        "รายการ",
      amount: money(item.amount),
      kind: item.deductionTypeId ? ("DEDUCTION" as const) : ("EARNING" as const),
    })),
  };
}

export { formatThaiDate };
