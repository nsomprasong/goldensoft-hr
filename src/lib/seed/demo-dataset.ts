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
  workCalendars: number;
  schedulePeriods: number;
  shiftAssignments: number;
  attendanceDays: number;
  attendanceEvents: number;
  leaveRequests: number;
  overtimeRequests: number;
  recurringPayItems: number;
  payrollRuns: number;
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
  const db = prisma as any;
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

  const workLocation = await prisma.workLocation.upsert({
    where: {
      organizationId_code: { organizationId, code: `${DEMO_PREFIX}HQ` },
    },
    update: {
      branchId,
      latitude: 13.7563,
      longitude: 100.5018,
      geofenceRadiusMeters: 50,
      timezone: "Asia/Bangkok",
    },
    create: {
      organizationId,
      branchId,
      code: `${DEMO_PREFIX}HQ`,
      name: "สำนักงานใหญ่ (เดโม)",
      latitude: 13.7563,
      longitude: 100.5018,
      geofenceRadiusMeters: 50,
      timezone: "Asia/Bangkok",
    },
  });

  const dayShift = await prisma.shift.upsert({
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
  const nightShiftTypeId = await requireMasterId(prisma, "shiftType", "NIGHT");
  const nightShift = await prisma.shift.upsert({
    where: { organizationId_code: { organizationId, code: `${DEMO_PREFIX}NIGHT` } },
    update: {},
    create: {
      organizationId, branchId, code: `${DEMO_PREFIX}NIGHT`, name: "กะกลางคืน (เดโม)",
      shiftTypeId: nightShiftTypeId, startTime: new Date("1970-01-01T20:00:00Z"),
      endTime: new Date("1970-01-01T05:00:00Z"), breakMinutes: 60,
      graceLateMinutes: 10, graceEarlyLeaveMinutes: 10, standardWorkMinutes: 480,
      crossesMidnight: true,
    },
  });
  const overnightShift = await prisma.shift.upsert({
    where: { organizationId_code: { organizationId, code: `${DEMO_PREFIX}OVERNIGHT` } },
    update: {},
    create: {
      organizationId, branchId, code: `${DEMO_PREFIX}OVERNIGHT`, name: "กะข้ามคืน (เดโม)",
      shiftTypeId: nightShiftTypeId, startTime: new Date("1970-01-01T22:00:00Z"),
      endTime: new Date("1970-01-01T07:00:00Z"), breakMinutes: 60,
      graceLateMinutes: 10, graceEarlyLeaveMinutes: 10, standardWorkMinutes: 480,
      crossesMidnight: true,
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
      wageType: "MONTHLY",
      amount: DEMO_MONTHLY_SALARY,
      shift: dayShift,
    },
    {
      code: `${DEMO_EMPLOYEE_PREFIX}0002`,
      firstNameTh: "สมหญิง",
      lastNameTh: "รักงาน",
      displayName: "สมหญิง รักงาน (เดโม)",
      phone: "0800000002",
      wageType: "DAILY",
      amount: 850,
      shift: nightShift,
    },
    {
      code: `${DEMO_EMPLOYEE_PREFIX}0003`,
      firstNameTh: "วิชัย",
      lastNameTh: "ขยันงาน",
      displayName: "วิชัย ขยันงาน (เดโม)",
      phone: "0800000003",
      wageType: "HOURLY",
      amount: 125,
      shift: overnightShift,
    },
  ];

  let compensations = 0;
  const employees: Array<{ id: string; seed: (typeof employeeSeeds)[number] }> = [];

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

    employees.push({ id: employee.id, seed });
    const employeeWageTypeId = await requireMasterId(prisma, "wageType", seed.wageType);
    // Compensation has no natural key, so re-seeding must not stack records.
    const existing = await prisma.employeeCompensation.findFirst({
      where: { employeeId: employee.id, isCurrent: true },
      select: { id: true },
    });
    if (!existing) {
      await prisma.employeeCompensation.create({
        data: {
          employeeId: employee.id,
          wageTypeId: employeeWageTypeId,
          amount: seed.amount,
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

  const demoStart = new Date("2026-06-01T00:00:00Z");
  const demoEnd = new Date("2026-06-16T00:00:00Z");
  const masterByCode = async (model: string, code: string) => {
    const row = await db[model].findUnique({ where: { code }, select: { id: true } });
    if (!row) throw new Error(`Master row ${model}.${code} is missing — run npm run seed:hr first`);
    return row.id as string;
  };
  const [draftScheduleStatusId, publicHolidayId, dayUnitId, approvedLeaveId,
    approvedOvertimeId, openingTxId, usedTxId, baseSalaryId, presentId, lateId,
    earlyLeaveId, absentId, missingClockOutId, clockInId, clockOutId] = await Promise.all([
    masterByCode("schedulePeriodStatus", "DRAFT"),
    masterByCode("holidayType", "PUBLIC"),
    masterByCode("leaveUnit", "DAY"),
    masterByCode("leaveRequestStatus", "APPROVED"),
    masterByCode("overtimeRequestStatus", "APPROVED"),
    masterByCode("leaveBalanceTxType", "OPENING"),
    masterByCode("leaveBalanceTxType", "USED"),
    masterByCode("earningType", "BASE_SALARY"),
    masterByCode("attendanceStatus", "PRESENT"),
    masterByCode("attendanceStatus", "LATE"),
    masterByCode("attendanceStatus", "EARLY_LEAVE"),
    masterByCode("attendanceStatus", "ABSENT"),
    masterByCode("attendanceStatus", "MISSING_CLOCK_OUT"),
    masterByCode("attendanceEventType", "CLOCK_IN"),
    masterByCode("attendanceEventType", "CLOCK_OUT"),
  ]);

  const calendar = await db.workCalendar.upsert({
    where: { organizationId_code: { organizationId, code: `${DEMO_PREFIX}STANDARD` } },
    update: { branchId, workDays: [1, 2, 3, 4, 5] },
    create: { organizationId, branchId, code: `${DEMO_PREFIX}STANDARD`, name: "ปฏิทินทำงานมาตรฐาน (เดโม)", timezone: "Asia/Bangkok", workDays: [1, 2, 3, 4, 5] },
  });
  await db.holiday.upsert({
    where: { workCalendarId_holidayDate_name: { workCalendarId: calendar.id, holidayDate: new Date("2026-06-03T00:00:00Z"), name: "วันหยุดตัวอย่าง (เดโม)" } },
    update: { holidayTypeId: publicHolidayId, isPaid: true, branchId },
    create: { organizationId, branchId, workCalendarId: calendar.id, holidayTypeId: publicHolidayId, holidayDate: new Date("2026-06-03T00:00:00Z"), name: "วันหยุดตัวอย่าง (เดโม)", isPaid: true },
  });
  const schedulePeriod = await db.schedulePeriod.upsert({
    where: { organizationId_code: { organizationId, code: `${DEMO_PREFIX}20260601_16` } },
    update: { branchId, periodStart: demoStart, periodEnd: demoEnd, statusId: draftScheduleStatusId },
    create: { organizationId, branchId, code: `${DEMO_PREFIX}20260601_16`, name: "ตารางงาน 1–16 มิถุนายน 2569 (เดโม)", periodStart: demoStart, periodEnd: demoEnd, statusId: draftScheduleStatusId, timezone: "Asia/Bangkok" },
  });

  let shiftAssignments = 0;
  for (const { id: employeeId, seed } of employees) {
    await db.employeeWorkCalendar.upsert({
      where: { employeeId_workCalendarId_effectiveFrom: { employeeId, workCalendarId: calendar.id, effectiveFrom: demoStart } },
      update: { effectiveTo: null },
      create: { employeeId, workCalendarId: calendar.id, effectiveFrom: demoStart },
    });
    await db.employeeWorkLocation.upsert({
      where: { employeeId_workLocationId_effectiveFrom: { employeeId, workLocationId: workLocation.id, effectiveFrom: demoStart } },
      update: { isPrimary: true, effectiveTo: null },
      create: { employeeId, workLocationId: workLocation.id, effectiveFrom: demoStart, isPrimary: true },
    });
    for (let day = 1; day <= 16; day += 1) {
      const workDate = new Date(`2026-06-${String(day).padStart(2, "0")}T00:00:00Z`);
      await db.shiftAssignment.upsert({
        where: { employeeId_workDate_sequenceNo: { employeeId, workDate, sequenceNo: 1 } },
        update: { schedulePeriodId: schedulePeriod.id, shiftId: seed.shift.id, workLocationId: workLocation.id },
        create: { schedulePeriodId: schedulePeriod.id, employeeId, shiftId: seed.shift.id, workDate, sequenceNo: 1, workLocationId: workLocation.id, createdByAuthUserId: actorId },
      });
      shiftAssignments += 1;
    }
  }

  const attendanceFixtures = [
    { employee: employees[0], day: 1, statusId: presentId, inAt: "2026-06-01T08:00:00Z", outAt: "2026-06-01T17:00:00Z", late: 0, early: 0, note: "มาตรงเวลา (เดโม)" },
    { employee: employees[1], day: 2, statusId: lateId, inAt: "2026-06-02T20:20:00Z", outAt: "2026-06-03T05:00:00Z", late: 20, early: 0, note: "มาสาย (เดโม)" },
    { employee: employees[2], day: 4, statusId: earlyLeaveId, inAt: "2026-06-04T22:00:00Z", outAt: "2026-06-05T05:30:00Z", late: 0, early: 30, note: "กลับก่อนเวลา (เดโม)" },
    { employee: employees[0], day: 5, statusId: absentId, inAt: null, outAt: null, late: 0, early: 0, note: "ขาดงาน (เดโม)" },
    { employee: employees[1], day: 6, statusId: missingClockOutId, inAt: "2026-06-06T20:00:00Z", outAt: null, late: 0, early: 0, note: "ไม่มีเวลาออกงาน (เดโม)" },
  ];
  for (const fixture of attendanceFixtures) {
    const workDate = new Date(`2026-06-${String(fixture.day).padStart(2, "0")}T00:00:00Z`);
    const assignment = await db.shiftAssignment.findUnique({ where: { employeeId_workDate_sequenceNo: { employeeId: fixture.employee.id, workDate, sequenceNo: 1 } } });
    await db.attendanceDay.upsert({
      where: { employeeId_workDate: { employeeId: fixture.employee.id, workDate } },
      update: { statusId: fixture.statusId, schedulePeriodId: schedulePeriod.id, shiftAssignmentId: assignment?.id ?? null, clockInAt: fixture.inAt ? new Date(fixture.inAt) : null, clockOutAt: fixture.outAt ? new Date(fixture.outAt) : null, scheduledMinutes: 480, workedMinutes: fixture.inAt && fixture.outAt ? 480 - fixture.late - fixture.early : 0, lateMinutes: fixture.late, earlyLeaveMinutes: fixture.early, notes: fixture.note },
      create: { organizationId, branchId, employeeId: fixture.employee.id, workDate, statusId: fixture.statusId, schedulePeriodId: schedulePeriod.id, shiftAssignmentId: assignment?.id ?? null, clockInAt: fixture.inAt ? new Date(fixture.inAt) : null, clockOutAt: fixture.outAt ? new Date(fixture.outAt) : null, scheduledMinutes: 480, workedMinutes: fixture.inAt && fixture.outAt ? 480 - fixture.late - fixture.early : 0, lateMinutes: fixture.late, earlyLeaveMinutes: fixture.early, notes: fixture.note },
    });
    if (fixture.inAt) await db.attendanceEvent.upsert({ where: { employeeId_idempotencyKey: { employeeId: fixture.employee.id, idempotencyKey: `${DEMO_PREFIX}IN_${fixture.day}` } }, update: {}, create: { organizationId, branchId, employeeId: fixture.employee.id, eventTypeId: clockInId, occurredAt: new Date(fixture.inAt), workLocationId: workLocation.id, latitude: 13.7563, longitude: 100.5018, geofenceDistanceMeters: 0, idempotencyKey: `${DEMO_PREFIX}IN_${fixture.day}`, source: "DEMO" } });
    if (fixture.outAt) await db.attendanceEvent.upsert({ where: { employeeId_idempotencyKey: { employeeId: fixture.employee.id, idempotencyKey: `${DEMO_PREFIX}OUT_${fixture.day}` } }, update: {}, create: { organizationId, branchId, employeeId: fixture.employee.id, eventTypeId: clockOutId, occurredAt: new Date(fixture.outAt), workLocationId: workLocation.id, latitude: 13.7563, longitude: 100.5018, geofenceDistanceMeters: 0, idempotencyKey: `${DEMO_PREFIX}OUT_${fixture.day}`, source: "DEMO" } });
  }

  const leaveType = await db.leaveType.upsert({ where: { organizationId_code: { organizationId, code: `${DEMO_PREFIX}ANNUAL` } }, update: { name: "ลาพักผ่อนประจำปี (เดโม)", unitId: dayUnitId }, create: { organizationId, code: `${DEMO_PREFIX}ANNUAL`, name: "ลาพักผ่อนประจำปี (เดโม)", unitId: dayUnitId, isPaid: true } });
  const balance = await db.employeeLeaveBalance.upsert({ where: { employeeId_leaveTypeId_balanceYear: { employeeId: employees[0].id, leaveTypeId: leaveType.id, balanceYear: 2026 } }, update: { openingBalance: 10, usedBalance: 1, availableBalance: 9 }, create: { employeeId: employees[0].id, leaveTypeId: leaveType.id, balanceYear: 2026, openingBalance: 10, usedBalance: 1, availableBalance: 9 } });
  let leaveRequest = await db.leaveRequest.findFirst({ where: { employeeId: employees[0].id, leaveTypeId: leaveType.id, startDate: new Date("2026-06-10T00:00:00Z"), endDate: new Date("2026-06-10T00:00:00Z") } });
  if (!leaveRequest) leaveRequest = await db.leaveRequest.create({ data: { organizationId, employeeId: employees[0].id, leaveTypeId: leaveType.id, statusId: approvedLeaveId, startDate: new Date("2026-06-10T00:00:00Z"), endDate: new Date("2026-06-10T00:00:00Z"), startUnitId: dayUnitId, endUnitId: dayUnitId, requestedAmount: 1, reason: "ลาตัวอย่าง", submittedAt: demoStart, reviewedAt: demoStart, reviewedByAuthUserId: actorId } });
  for (const transaction of [{ type: openingTxId, amount: 10, after: 10, reference: `${DEMO_PREFIX}OPENING_2026` }, { type: usedTxId, amount: -1, after: 9, reference: `${DEMO_PREFIX}LEAVE_20260610` }]) {
    const exists = await db.leaveBalanceTransaction.findFirst({ where: { employeeLeaveBalanceId: balance.id, reference: transaction.reference } });
    if (!exists) await db.leaveBalanceTransaction.create({ data: { employeeLeaveBalanceId: balance.id, transactionTypeId: transaction.type, leaveRequestId: transaction.amount < 0 ? leaveRequest.id : null, occurredOn: demoStart, amount: transaction.amount, balanceAfter: transaction.after, reference: transaction.reference, createdByAuthUserId: actorId } });
  }
  const overtimeDay = await db.attendanceDay.findUnique({ where: { employeeId_workDate: { employeeId: employees[0].id, workDate: new Date("2026-06-01T00:00:00Z") } } });
  const existingOvertime = await db.overtimeRequest.findFirst({ where: { employeeId: employees[0].id, workDate: new Date("2026-06-01T00:00:00Z"), reason: "ทำงานล่วงเวลาตัวอย่าง" } });
  if (!existingOvertime) await db.overtimeRequest.create({ data: { organizationId, branchId, employeeId: employees[0].id, attendanceDayId: overtimeDay?.id ?? null, overtimeRuleId: (await prisma.overtimeRule.findUnique({ where: { organizationId_code: { organizationId, code: `${DEMO_PREFIX}OT_NORMAL` } } }))?.id ?? null, statusId: approvedOvertimeId, workDate: new Date("2026-06-01T00:00:00Z"), startAt: new Date("2026-06-01T17:00:00Z"), endAt: new Date("2026-06-01T19:00:00Z"), requestedMinutes: 120, approvedMinutes: 120, reason: "ทำงานล่วงเวลาตัวอย่าง", submittedAt: demoStart, reviewedAt: demoStart, reviewedByAuthUserId: actorId } });
  const recurring = await db.employeeRecurringPayItem.findFirst({ where: { employeeId: employees[0].id, earningTypeId: baseSalaryId, effectiveFrom: demoStart } });
  if (!recurring) await db.employeeRecurringPayItem.create({ data: { employeeId: employees[0].id, earningTypeId: baseSalaryId, amount: 1_500, effectiveFrom: demoStart, createdByAuthUserId: actorId } });
  const demoPayrollPeriod = await db.payrollPeriod.findFirst({ where: { organizationId, payrollScheduleId: payrollSchedule.id }, orderBy: { periodStart: "asc" } });
  if (demoPayrollPeriod) {
    const run = await db.payrollRun.upsert({ where: { payrollPeriodId_runNumber: { payrollPeriodId: demoPayrollPeriod.id, runNumber: 1 } }, update: {}, create: { organizationId, payrollPeriodId: demoPayrollPeriod.id, runNumber: 1, statusId: draftStatusId, createdByAuthUserId: actorId } });
    for (const { id: employeeId, seed } of employees) {
      const runEmployee = await db.payrollRunEmployee.upsert({ where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId } }, update: {}, create: { payrollRunId: run.id, employeeId, grossEarnings: seed.amount, totalDeductions: 0, netPay: seed.amount, statusId: draftStatusId, calculatedAt: demoStart } });
      const line = await db.payrollRunItem.findFirst({ where: { payrollRunEmployeeId: runEmployee.id, sourceType: "DEMO_CALCULATED" } });
      if (!line) await db.payrollRunItem.create({ data: { payrollRunEmployeeId: runEmployee.id, earningTypeId: baseSalaryId, sourceType: "DEMO_CALCULATED", description: "ค่าจ้างคำนวณตัวอย่าง", quantity: 1, rate: seed.amount, amount: seed.amount } });
    }
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
    workCalendars: 1,
    schedulePeriods: 1,
    shiftAssignments,
    attendanceDays: attendanceFixtures.length,
    attendanceEvents: attendanceFixtures.reduce((count, fixture) => count + (fixture.inAt ? 1 : 0) + (fixture.outAt ? 1 : 0), 0),
    leaveRequests: 1,
    overtimeRequests: 1,
    recurringPayItems: 1,
    payrollRuns: demoPayrollPeriod ? 1 : 0,
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
  const db = prisma as any;
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
    workCalendars: 0,
    schedulePeriods: 0,
    shiftAssignments: 0,
    attendanceDays: 0,
    attendanceEvents: 0,
    leaveRequests: 0,
    overtimeRequests: 0,
    recurringPayItems: 0,
    payrollRuns: 0,
  };

  if (options.dryRun) {
    return counts;
  }

  const demoCalendar = { organizationId, code: { startsWith: DEMO_PREFIX } };
  const demoSchedule = { organizationId, code: { startsWith: DEMO_PREFIX } };
  const demoLeaveType = { organizationId, code: { startsWith: DEMO_PREFIX } };
  const demoPayrollPeriods = {
    organizationId,
    payrollSchedule: { code: { startsWith: DEMO_PREFIX } },
  };
  const demoRuns = {
    payrollRun: { payrollPeriod: { payrollSchedule: { code: { startsWith: DEMO_PREFIX } } } },
  };
  await db.payslip.deleteMany({ where: demoRuns });
  await db.payrollRun.deleteMany({ where: { payrollPeriod: demoPayrollPeriods } });
  await db.leaveBalanceTransaction.deleteMany({
    where: { employeeLeaveBalance: { employee: employeeFilter } },
  });
  await db.employeeLeaveBalance.deleteMany({ where: { employee: employeeFilter } });
  await db.leaveRequest.deleteMany({ where: { employee: employeeFilter } });
  await db.overtimeRequest.deleteMany({ where: { employee: employeeFilter } });
  await db.attendanceEvent.deleteMany({ where: { employee: employeeFilter } });
  await db.attendanceDay.deleteMany({ where: { employee: employeeFilter } });
  await db.shiftAssignment.deleteMany({
    where: { schedulePeriod: demoSchedule },
  });
  await db.schedulePeriod.deleteMany({ where: demoSchedule });
  await db.employeeRecurringPayItem.deleteMany({ where: { employee: employeeFilter } });
  await prisma.employee.deleteMany({ where: employeeFilter });
  await db.leavePolicy.deleteMany({ where: { leaveType: demoLeaveType } });
  await db.leaveType.deleteMany({ where: demoLeaveType });
  await db.holiday.deleteMany({ where: { workCalendar: demoCalendar } });
  await db.workCalendar.deleteMany({ where: demoCalendar });
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
