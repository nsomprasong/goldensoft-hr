/**
 * Development demo dataset for the HR schema.
 *
 * Every row created here uses the DEMO_PREFIX so cleanup can be exact, and a
 * demo_seed_markers row records that the organization was seeded. Real tenant
 * data never carries the prefix, so cleanup cannot touch it.
 */
import type { PrismaClient } from "@prisma/client";

import { generateSemimonthlyPeriods } from "@/lib/hr/payroll-rules";

export const DEMO_PREFIX = "DEMO_";
export const DEMO_EMPLOYEE_PREFIX = "DEMO-EMP-";
export const DEMO_MARKER_KEY = "phase8b-hr-demo";

/** Payment lands five days after the period closes. */
const DEMO_PAYMENT_DAY_RULE = "DAYS_AFTER_END:5";
const DEMO_MONTHLY_SALARY = 25_000;

export type DemoSeedTarget = {
  organizationId: string;
  branchId: string;
  /** auth.users.id recorded as created_by / updated_by (soft reference). */
  actorId: string;
};

export type DemoSeedCounts = {
  departments: number;
  positions: number;
  workLocations: number;
  shifts: number;
  overtimeRules: number;
  payrollSchedules: number;
  payrollPeriods: number;
  employees: number;
  compensations: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`${label} must be a UUID`);
  }
  return value.toLowerCase();
}

async function requireMasterId(
  prisma: PrismaClient,
  model:
    | "employmentType"
    | "employeeStatus"
    | "shiftType"
    | "payFrequency"
    | "wageType"
    | "overtimeRateType"
    | "payrollPeriodStatus",
  code: string,
): Promise<string> {
  const delegate = prisma[model] as unknown as {
    findUnique(args: {
      where: { code: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  const row = await delegate.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!row) {
    throw new Error(
      `Master row ${model}.${code} is missing — run npm run seed:hr first`,
    );
  }
  return row.id;
}

export async function seedDevelopmentDemo(
  prisma: PrismaClient,
  target: DemoSeedTarget,
): Promise<DemoSeedCounts> {
  const organizationId = assertUuid(target.organizationId, "organizationId");
  const branchId = assertUuid(target.branchId, "branchId");
  const actorId = assertUuid(target.actorId, "actorId");

  const employmentTypeId = await requireMasterId(
    prisma,
    "employmentType",
    "MONTHLY",
  );
  const employeeStatusId = await requireMasterId(
    prisma,
    "employeeStatus",
    "ACTIVE",
  );
  const shiftTypeId = await requireMasterId(prisma, "shiftType", "REGULAR");
  const payFrequencyId = await requireMasterId(
    prisma,
    "payFrequency",
    "SEMIMONTHLY",
  );
  const wageTypeId = await requireMasterId(prisma, "wageType", "MONTHLY");
  const overtimeRateTypeId = await requireMasterId(
    prisma,
    "overtimeRateType",
    "NORMAL_DAY",
  );
  const draftStatusId = await requireMasterId(
    prisma,
    "payrollPeriodStatus",
    "DRAFT",
  );

  const department = await prisma.department.upsert({
    where: {
      organizationId_code: { organizationId, code: `${DEMO_PREFIX}OPS` },
    },
    update: {},
    create: {
      organizationId,
      code: `${DEMO_PREFIX}OPS`,
      nameTh: "ฝ่ายปฏิบัติการ (เดโม)",
      nameEn: "Operations (demo)",
    },
  });

  const position = await prisma.position.upsert({
    where: {
      organizationId_code: { organizationId, code: `${DEMO_PREFIX}SUPERVISOR` },
    },
    update: {},
    create: {
      organizationId,
      departmentId: department.id,
      code: `${DEMO_PREFIX}SUPERVISOR`,
      nameTh: "หัวหน้างาน (เดโม)",
      nameEn: "Supervisor (demo)",
    },
  });

  await prisma.workLocation.upsert({
    where: {
      organizationId_code: { organizationId, code: `${DEMO_PREFIX}HQ` },
    },
    update: {},
    create: {
      organizationId,
      branchId,
      code: `${DEMO_PREFIX}HQ`,
      name: "สำนักงานใหญ่ (เดโม)",
      geofenceRadiusMeters: 100,
    },
  });

  await prisma.shift.upsert({
    where: {
      organizationId_code: { organizationId, code: `${DEMO_PREFIX}DAY` },
    },
    update: {},
    create: {
      organizationId,
      branchId,
      code: `${DEMO_PREFIX}DAY`,
      name: "กะกลางวัน (เดโม)",
      shiftTypeId,
      startTime: new Date("1970-01-01T08:00:00Z"),
      endTime: new Date("1970-01-01T17:00:00Z"),
      breakMinutes: 60,
      graceLateMinutes: 10,
      graceEarlyLeaveMinutes: 10,
      standardWorkMinutes: 480,
    },
  });

  await prisma.overtimeRule.upsert({
    where: {
      organizationId_code: { organizationId, code: `${DEMO_PREFIX}OT_NORMAL` },
    },
    update: {},
    create: {
      organizationId,
      code: `${DEMO_PREFIX}OT_NORMAL`,
      name: "ค่าล่วงเวลาวันทำงานปกติ (เดโม)",
      rateTypeId: overtimeRateTypeId,
      multiplier: 1.5,
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    },
  });

  // Refreshed rather than left alone on re-seed, so a demo organization always
  // ends up with a paymentDayRule the period generator can parse.
  const scheduleRules = {
    periodStartRule: "DAY_1,DAY_17",
    periodEndRule: "DAY_16,LAST_DAY",
    paymentDayRule: DEMO_PAYMENT_DAY_RULE,
  };
  const payrollSchedule = await prisma.payrollSchedule.upsert({
    where: {
      organizationId_code: { organizationId, code: `${DEMO_PREFIX}SEMI` },
    },
    update: scheduleRules,
    create: {
      organizationId,
      code: `${DEMO_PREFIX}SEMI`,
      name: "งวดครึ่งเดือน (เดโม)",
      payFrequencyId,
      ...scheduleRules,
    },
  });

  const today = new Date();
  const periods = generateSemimonthlyPeriods(
    today.getUTCFullYear(),
    today.getUTCMonth() + 1,
    { kind: "DAYS_AFTER_END", days: 5 },
  );

  for (const period of periods) {
    await prisma.payrollPeriod.upsert({
      where: {
        organizationId_payrollScheduleId_periodStart_periodEnd: {
          organizationId,
          payrollScheduleId: payrollSchedule.id,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
        },
      },
      update: {},
      create: {
        organizationId,
        payrollScheduleId: payrollSchedule.id,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        paymentDate: period.paymentDate,
        statusId: draftStatusId,
      },
    });
  }

  const employeeSeeds = [
    {
      code: `${DEMO_EMPLOYEE_PREFIX}0001`,
      firstNameTh: "สมชาย",
      lastNameTh: "ใจดี",
      displayName: "สมชาย ใจดี (เดโม)",
      phone: "0800000001",
    },
    {
      code: `${DEMO_EMPLOYEE_PREFIX}0002`,
      firstNameTh: "สมหญิง",
      lastNameTh: "รักงาน",
      displayName: "สมหญิง รักงาน (เดโม)",
      phone: "0800000002",
    },
  ];

  let compensations = 0;

  for (const seed of employeeSeeds) {
    const employee = await prisma.employee.upsert({
      where: {
        organizationId_employeeCode: {
          organizationId,
          employeeCode: seed.code,
        },
      },
      update: {},
      create: {
        organizationId,
        employeeCode: seed.code,
        branchId,
        departmentId: department.id,
        positionId: position.id,
        employmentTypeId,
        employeeStatusId,
        firstNameTh: seed.firstNameTh,
        lastNameTh: seed.lastNameTh,
        displayName: seed.displayName,
        phone: seed.phone,
        hireDate: new Date("2026-01-01T00:00:00Z"),
        createdBy: actorId,
        updatedBy: actorId,
      },
    });

    // Compensation has no natural key, so re-seeding must not stack records.
    const existing = await prisma.employeeCompensation.findFirst({
      where: { employeeId: employee.id, isCurrent: true },
      select: { id: true },
    });
    if (!existing) {
      await prisma.employeeCompensation.create({
        data: {
          employeeId: employee.id,
          wageTypeId,
          amount: DEMO_MONTHLY_SALARY,
          currency: "THB",
          effectiveFrom: new Date("2026-01-01T00:00:00Z"),
          standardHoursPerDay: 8,
          standardDaysPerMonth: 30,
          overtimeEligible: true,
          isCurrent: true,
          createdBy: actorId,
        },
      });
    }
    compensations += 1;
  }

  await prisma.demoSeedMarker.upsert({
    where: {
      organizationId_markerKey: {
        organizationId,
        markerKey: DEMO_MARKER_KEY,
      },
    },
    update: {},
    create: { organizationId, markerKey: DEMO_MARKER_KEY },
  });

  return {
    departments: 1,
    positions: 1,
    workLocations: 1,
    shifts: 1,
    overtimeRules: 1,
    payrollSchedules: 1,
    payrollPeriods: periods.length,
    employees: employeeSeeds.length,
    compensations,
  };
}

/**
 * Delete only rows carrying the demo prefix for one organization.
 *
 * Children cascade in the database: compensations follow their employee and
 * payroll periods follow their schedule, so neither needs its own delete.
 */
export async function cleanupDevelopmentDemo(
  prisma: PrismaClient,
  organizationIdInput: string,
  options: { dryRun?: boolean } = {},
): Promise<DemoSeedCounts> {
  const organizationId = assertUuid(organizationIdInput, "organizationId");
  const prefixed = { organizationId, code: { startsWith: DEMO_PREFIX } };
  const employeeFilter = {
    organizationId,
    employeeCode: { startsWith: DEMO_EMPLOYEE_PREFIX },
  };

  const counts: DemoSeedCounts = {
    departments: await prisma.department.count({ where: prefixed }),
    positions: await prisma.position.count({ where: prefixed }),
    workLocations: await prisma.workLocation.count({ where: prefixed }),
    shifts: await prisma.shift.count({ where: prefixed }),
    overtimeRules: await prisma.overtimeRule.count({ where: prefixed }),
    payrollSchedules: await prisma.payrollSchedule.count({ where: prefixed }),
    payrollPeriods: await prisma.payrollPeriod.count({
      where: { organizationId, payrollSchedule: { code: { startsWith: DEMO_PREFIX } } },
    }),
    employees: await prisma.employee.count({ where: employeeFilter }),
    compensations: await prisma.employeeCompensation.count({
      where: { employee: employeeFilter },
    }),
  };

  if (options.dryRun) {
    return counts;
  }

  await prisma.employee.deleteMany({ where: employeeFilter });
  await prisma.payrollSchedule.deleteMany({ where: prefixed });
  await prisma.overtimeRule.deleteMany({ where: prefixed });
  await prisma.shift.deleteMany({ where: prefixed });
  await prisma.workLocation.deleteMany({ where: prefixed });
  await prisma.position.deleteMany({ where: prefixed });
  await prisma.department.deleteMany({ where: prefixed });
  await prisma.demoSeedMarker.deleteMany({
    where: { organizationId, markerKey: DEMO_MARKER_KEY },
  });

  return counts;
}
