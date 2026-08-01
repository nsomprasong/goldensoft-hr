/**
 * Aggregate OT / late / absence for a payroll period into calc earnings & deductions.
 */
import { prisma } from "@/lib/prisma";
import type { AttendancePaySettingsInput } from "@/lib/hr/services/payroll-deduction-settings";

export type PayrollPayLine = {
  code: string;
  amount: number;
  description: string;
};

export type EmployeeAttendancePayEffects = {
  overtimeEarnings: PayrollPayLine[];
  lateDeductions: PayrollPayLine[];
  absenceDeductions: PayrollPayLine[];
  overtimeMinutes: number;
  lateMinutes: number;
  absenceDays: number;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function dailyWage(
  wageType: "DAILY" | "MONTHLY" | "HOURLY",
  wageAmount: number,
): number {
  const rate = Math.max(0, wageAmount);
  if (wageType === "DAILY") return rate;
  if (wageType === "HOURLY") return rate * 8;
  return rate / 30;
}

function emptyEffects(): EmployeeAttendancePayEffects {
  return {
    overtimeEarnings: [],
    lateDeductions: [],
    absenceDeductions: [],
    overtimeMinutes: 0,
    lateMinutes: 0,
    absenceDays: 0,
  };
}

/**
 * Load OT (approved), late minutes, and absent days for all employees in a period.
 */
export async function loadAttendancePayEffectsForPeriod(input: {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  employeeIds: string[];
  settings: AttendancePaySettingsInput;
  wageByEmployee: Map<
    string,
    { wageType: "DAILY" | "MONTHLY" | "HOURLY"; wageAmount: number }
  >;
}): Promise<Map<string, EmployeeAttendancePayEffects>> {
  const result = new Map<string, EmployeeAttendancePayEffects>();
  for (const id of input.employeeIds) {
    result.set(id, emptyEffects());
  }
  if (input.employeeIds.length === 0) return result;

  const [approvedStatus, absentStatus, otRows, attendanceRows] =
    await Promise.all([
      prisma.overtimeRequestStatus.findFirst({
        where: { code: "APPROVED", isActive: true },
        select: { id: true },
      }),
      prisma.attendanceStatus.findFirst({
        where: { code: "ABSENT", isActive: true },
        select: { id: true },
      }),
      prisma.overtimeRequest.findMany({
        where: {
          organizationId: input.organizationId,
          employeeId: { in: input.employeeIds },
          workDate: {
            gte: input.periodStart,
            lte: input.periodEnd,
          },
        },
        select: {
          employeeId: true,
          approvedMinutes: true,
          requestedMinutes: true,
          statusId: true,
          overtimeRule: { select: { multiplier: true, fixedAmount: true } },
        },
      }),
      prisma.attendanceDay.findMany({
        where: {
          organizationId: input.organizationId,
          employeeId: { in: input.employeeIds },
          workDate: {
            gte: input.periodStart,
            lte: input.periodEnd,
          },
        },
        select: {
          employeeId: true,
          lateMinutes: true,
          statusId: true,
        },
      }),
    ]);

  const approvedStatusId = approvedStatus?.id ?? null;
  const absentStatusId = absentStatus?.id ?? null;

  for (const row of otRows) {
    if (!approvedStatusId || row.statusId !== approvedStatusId) continue;
    const minutes = row.approvedMinutes ?? row.requestedMinutes ?? 0;
    if (minutes <= 0) continue;
    const wage = input.wageByEmployee.get(row.employeeId);
    if (!wage) continue;
    const effects = result.get(row.employeeId) ?? emptyEffects();
    const hours = minutes / 60;
    const hourly =
      wage.wageType === "HOURLY" ? wage.wageAmount : dailyWage(wage.wageType, wage.wageAmount) / 8;
    const multiplier = Number(row.overtimeRule?.multiplier ?? 1.5);
    const fixed = row.overtimeRule?.fixedAmount;
    const amount =
      fixed != null && Number(fixed) > 0
        ? Number(fixed) * hours
        : hourly * hours * multiplier;
    effects.overtimeMinutes += minutes;
    if (amount > 0) {
      effects.overtimeEarnings.push({
        code: "OVERTIME",
        amount: roundMoney(amount),
        description: `ค่าล่วงเวลา (${Math.round(minutes)} นาที × ${multiplier})`,
      });
    }
    result.set(row.employeeId, effects);
  }

  // Merge OT lines per employee into one line for cleaner payslips.
  for (const [employeeId, effects] of result) {
    if (effects.overtimeEarnings.length <= 1) continue;
    const total = effects.overtimeEarnings.reduce((s, r) => s + r.amount, 0);
    effects.overtimeEarnings = [
      {
        code: "OVERTIME",
        amount: roundMoney(total),
        description: `ค่าล่วงเวลา (${effects.overtimeMinutes} นาที)`,
      },
    ];
    result.set(employeeId, effects);
  }

  for (const row of attendanceRows) {
    const effects = result.get(row.employeeId) ?? emptyEffects();
    const wage = input.wageByEmployee.get(row.employeeId);
    if (!wage) continue;

    if (input.settings.lateDeductionEnabled && row.lateMinutes > 0) {
      effects.lateMinutes += row.lateMinutes;
    }
    if (
      input.settings.absenceDeductionEnabled &&
      absentStatusId &&
      row.statusId === absentStatusId
    ) {
      effects.absenceDays += 1;
    }
    result.set(row.employeeId, effects);
  }

  for (const [employeeId, effects] of result) {
    const wage = input.wageByEmployee.get(employeeId);
    if (!wage) continue;
    const dayRate = dailyWage(wage.wageType, wage.wageAmount);

    if (effects.lateMinutes > 0) {
      const perMinute =
        input.settings.lateBahtPerMinute > 0
          ? input.settings.lateBahtPerMinute
          : dayRate / 8 / 60;
      const amount = roundMoney(perMinute * effects.lateMinutes);
      if (amount > 0) {
        effects.lateDeductions = [
          {
            code: "LATE",
            amount,
            description: `หักสาย (${effects.lateMinutes} นาที)`,
          },
        ];
      }
    }

    if (effects.absenceDays > 0) {
      const perDay =
        input.settings.absenceBahtPerDay > 0
          ? input.settings.absenceBahtPerDay
          : dayRate;
      const amount = roundMoney(perDay * effects.absenceDays);
      if (amount > 0) {
        effects.absenceDeductions = [
          {
            code: "ABSENCE",
            amount,
            description: `หักขาดงาน (${effects.absenceDays} วัน)`,
          },
        ];
      }
    }

    result.set(employeeId, effects);
  }

  return result;
}
