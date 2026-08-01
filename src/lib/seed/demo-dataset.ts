/**
 * Development demo dataset for the HR schema.
 *
 * Every row created here uses the DEMO_PREFIX so cleanup can be exact, and a
 * demo_seed_markers row records that the organization was seeded. Real tenant
 * data never carries the prefix, so cleanup cannot touch it.
 *
 * See docs/HR_DEMO_DATASET.md for the 10-employee roster and relationships.
 */
import type { PrismaClient } from "@prisma/client";

import { saveDemoAvatarSvg } from "@/lib/hr/employee-photos";
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
  notifications: number;
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

  const employmentMonthlyId = await requireMasterId(
    prisma,
    "employmentType",
    "MONTHLY",
  );
  const employmentDailyId = await requireMasterId(
    prisma,
    "employmentType",
    "DAILY",
  );
  const employmentContractId = await requireMasterId(
    prisma,
    "employmentType",
    "CONTRACT",
  );
  const statusActiveId = await requireMasterId(
    prisma,
    "employeeStatus",
    "ACTIVE",
  );
  const statusResignedId = await requireMasterId(
    prisma,
    "employeeStatus",
    "RESIGNED",
  );
  const statusSuspendedId = await requireMasterId(
    prisma,
    "employeeStatus",
    "SUSPENDED",
  );
  const shiftTypeId = await requireMasterId(prisma, "shiftType", "REGULAR");
  const nightShiftTypeId = await requireMasterId(prisma, "shiftType", "NIGHT");
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

  const deptOps = await prisma.department.upsert({
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
  const deptHr = await prisma.department.upsert({
    where: {
      organizationId_code: { organizationId, code: `${DEMO_PREFIX}HR` },
    },
    update: {},
    create: {
      organizationId,
      code: `${DEMO_PREFIX}HR`,
      nameTh: "ฝ่ายบุคคล (เดโม)",
      nameEn: "HR (demo)",
    },
  });
  const deptSales = await prisma.department.upsert({
    where: {
      organizationId_code: { organizationId, code: `${DEMO_PREFIX}SALES` },
    },
    update: {},
    create: {
      organizationId,
      code: `${DEMO_PREFIX}SALES`,
      nameTh: "ฝ่ายขาย (เดโม)",
      nameEn: "Sales (demo)",
    },
  });

  const posSupervisor = await prisma.position.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: `${DEMO_PREFIX}SUPERVISOR`,
      },
    },
    update: {},
    create: {
      organizationId,
      departmentId: deptOps.id,
      code: `${DEMO_PREFIX}SUPERVISOR`,
      nameTh: "หัวหน้างาน (เดโม)",
      nameEn: "Supervisor (demo)",
    },
  });
  const posStaff = await prisma.position.upsert({
    where: {
      organizationId_code: { organizationId, code: `${DEMO_PREFIX}STAFF` },
    },
    update: {},
    create: {
      organizationId,
      departmentId: deptOps.id,
      code: `${DEMO_PREFIX}STAFF`,
      nameTh: "พนักงาน (เดโม)",
      nameEn: "Staff (demo)",
    },
  });
  const posHrOfficer = await prisma.position.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: `${DEMO_PREFIX}HR_OFFICER`,
      },
    },
    update: {},
    create: {
      organizationId,
      departmentId: deptHr.id,
      code: `${DEMO_PREFIX}HR_OFFICER`,
      nameTh: "เจ้าหน้าที่บุคคล (เดโม)",
      nameEn: "HR Officer (demo)",
    },
  });
  const posSales = await prisma.position.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: `${DEMO_PREFIX}SALES_REP`,
      },
    },
    update: {},
    create: {
      organizationId,
      departmentId: deptSales.id,
      code: `${DEMO_PREFIX}SALES_REP`,
      nameTh: "พนักงานขาย (เดโม)",
      nameEn: "Sales Rep (demo)",
    },
  });

  const workLocationHq = await prisma.workLocation.upsert({
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
  const workLocationBranch = await prisma.workLocation.upsert({
    where: {
      organizationId_code: { organizationId, code: `${DEMO_PREFIX}BRANCH` },
    },
    update: {
      branchId,
      latitude: 13.746,
      longitude: 100.534,
      geofenceRadiusMeters: 100,
      timezone: "Asia/Bangkok",
    },
    create: {
      organizationId,
      branchId,
      code: `${DEMO_PREFIX}BRANCH`,
      name: "จุดบริการสาขา (เดโม)",
      latitude: 13.746,
      longitude: 100.534,
      geofenceRadiusMeters: 100,
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
  const nightShift = await prisma.shift.upsert({
    where: {
      organizationId_code: { organizationId, code: `${DEMO_PREFIX}NIGHT` },
    },
    update: {},
    create: {
      organizationId,
      branchId,
      code: `${DEMO_PREFIX}NIGHT`,
      name: "กะกลางคืน (เดโม)",
      shiftTypeId: nightShiftTypeId,
      startTime: new Date("1970-01-01T20:00:00Z"),
      endTime: new Date("1970-01-01T05:00:00Z"),
      breakMinutes: 60,
      graceLateMinutes: 10,
      graceEarlyLeaveMinutes: 10,
      standardWorkMinutes: 480,
      crossesMidnight: true,
    },
  });
  const overnightShift = await prisma.shift.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: `${DEMO_PREFIX}OVERNIGHT`,
      },
    },
    update: {},
    create: {
      organizationId,
      branchId,
      code: `${DEMO_PREFIX}OVERNIGHT`,
      name: "กะข้ามคืน (เดโม)",
      shiftTypeId: nightShiftTypeId,
      startTime: new Date("1970-01-01T22:00:00Z"),
      endTime: new Date("1970-01-01T07:00:00Z"),
      breakMinutes: 60,
      graceLateMinutes: 10,
      graceEarlyLeaveMinutes: 10,
      standardWorkMinutes: 480,
      crossesMidnight: true,
    },
  });

  await prisma.overtimeRule.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: `${DEMO_PREFIX}OT_NORMAL`,
      },
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

  type DemoLocationRef = {
    id: string;
    latitude: number;
    longitude: number;
  };

  function toLocationRef(row: {
    id: string;
    latitude: { toString(): string } | number | null;
    longitude: { toString(): string } | number | null;
  }): DemoLocationRef {
    return {
      id: row.id,
      latitude: Number(row.latitude ?? 0),
      longitude: Number(row.longitude ?? 0),
    };
  }

  const hqLoc = toLocationRef(workLocationHq);
  const branchLoc = toLocationRef(workLocationBranch);

  type EmployeeSeed = {
    code: string;
    firstNameTh: string;
    lastNameTh: string;
    displayName: string;
    phone: string;
    email: string;
    wageType: "MONTHLY" | "DAILY" | "HOURLY";
    amount: number;
    shift: { id: string };
    location: DemoLocationRef;
    departmentId: string;
    positionId: string;
    employmentTypeId: string;
    employeeStatusId: string;
    hireDate: string;
    probationEndDate?: string;
    hue: number;
    assignSchedule: boolean;
    notes: string;
  };

  const employeeSeeds: EmployeeSeed[] = [
    {
      code: `${DEMO_EMPLOYEE_PREFIX}0001`,
      firstNameTh: "สมชาย",
      lastNameTh: "ใจดี",
      displayName: "สมชาย ใจดี (เดโม)",
      phone: "0800000001",
      email: "somchai.demo@example.com",
      wageType: "MONTHLY",
      amount: DEMO_MONTHLY_SALARY,
      shift: dayShift,
      location: hqLoc,
      departmentId: deptOps.id,
      positionId: posSupervisor.id,
      employmentTypeId: employmentMonthlyId,
      employeeStatusId: statusActiveId,
      hireDate: "2025-01-01",
      hue: 210,
      assignSchedule: true,
      notes: "หัวหน้างาน — leave/OT อนุมัติแล้ว + payslip",
    },
    {
      code: `${DEMO_EMPLOYEE_PREFIX}0002`,
      firstNameTh: "สมหญิง",
      lastNameTh: "รักงาน",
      displayName: "สมหญิง รักงาน (เดโม)",
      phone: "0800000002",
      email: "somying.demo@example.com",
      wageType: "DAILY",
      amount: 850,
      shift: nightShift,
      location: hqLoc,
      departmentId: deptOps.id,
      positionId: posStaff.id,
      employmentTypeId: employmentDailyId,
      employeeStatusId: statusActiveId,
      hireDate: "2025-03-01",
      hue: 330,
      assignSchedule: true,
      notes: "กะกลางคืน — LATE + MISSING_CLOCK_OUT",
    },
    {
      code: `${DEMO_EMPLOYEE_PREFIX}0003`,
      firstNameTh: "วิชัย",
      lastNameTh: "ขยันงาน",
      displayName: "วิชัย ขยันงาน (เดโม)",
      phone: "0800000003",
      email: "wichai.demo@example.com",
      wageType: "HOURLY",
      amount: 125,
      shift: overnightShift,
      location: hqLoc,
      departmentId: deptOps.id,
      positionId: posStaff.id,
      employmentTypeId: employmentDailyId,
      employeeStatusId: statusActiveId,
      hireDate: "2025-06-01",
      hue: 160,
      assignSchedule: true,
      notes: "กะข้ามคืน — EARLY_LEAVE",
    },
    {
      code: `${DEMO_EMPLOYEE_PREFIX}0004`,
      firstNameTh: "นภา",
      lastNameTh: "สุขใจ",
      displayName: "นภา สุขใจ (เดโม)",
      phone: "0800000004",
      email: "napha.demo@example.com",
      wageType: "MONTHLY",
      amount: 22_000,
      shift: dayShift,
      location: hqLoc,
      departmentId: deptHr.id,
      positionId: posHrOfficer.id,
      employmentTypeId: employmentMonthlyId,
      employeeStatusId: statusActiveId,
      hireDate: "2025-02-15",
      hue: 280,
      assignSchedule: true,
      notes: "HR — leave SUBMITTED (inbox)",
    },
    {
      code: `${DEMO_EMPLOYEE_PREFIX}0005`,
      firstNameTh: "ประยุทธ์",
      lastNameTh: "มั่นคง",
      displayName: "ประยุทธ์ มั่นคง (เดโม)",
      phone: "0800000005",
      email: "prayut.demo@example.com",
      wageType: "MONTHLY",
      amount: 28_000,
      shift: dayShift,
      location: hqLoc,
      departmentId: deptOps.id,
      positionId: posStaff.id,
      employmentTypeId: employmentMonthlyId,
      employeeStatusId: statusActiveId,
      hireDate: "2024-08-01",
      hue: 30,
      assignSchedule: true,
      notes: "หัก TAX + SSO ใน payroll run",
    },
    {
      code: `${DEMO_EMPLOYEE_PREFIX}0006`,
      firstNameTh: "ศิริพร",
      lastNameTh: "ยิ้มแย้ม",
      displayName: "ศิริพร ยิ้มแย้ม (เดโม)",
      phone: "0800000006",
      email: "siriporn.demo@example.com",
      wageType: "MONTHLY",
      amount: 20_000,
      shift: dayShift,
      location: branchLoc,
      departmentId: deptSales.id,
      positionId: posSales.id,
      employmentTypeId: employmentMonthlyId,
      employeeStatusId: statusActiveId,
      hireDate: "2025-09-01",
      hue: 45,
      assignSchedule: true,
      notes: "จุดบริการสาขา radius 100m",
    },
    {
      code: `${DEMO_EMPLOYEE_PREFIX}0007`,
      firstNameTh: "อนุชา",
      lastNameTh: "ตรงเวลา",
      displayName: "อนุชา ตรงเวลา (เดโม)",
      phone: "0800000007",
      email: "anucha.demo@example.com",
      wageType: "MONTHLY",
      amount: 18_000,
      shift: dayShift,
      location: hqLoc,
      departmentId: deptOps.id,
      positionId: posStaff.id,
      employmentTypeId: employmentMonthlyId,
      employeeStatusId: statusActiveId,
      hireDate: "2025-04-01",
      hue: 190,
      assignSchedule: true,
      notes: "ABSENT fixture",
    },
    {
      code: `${DEMO_EMPLOYEE_PREFIX}0008`,
      firstNameTh: "จิราภรณ์",
      lastNameTh: "ใหม่งาน",
      displayName: "จิราภรณ์ ใหม่งาน (เดโม)",
      phone: "0800000008",
      email: "jiraporn.demo@example.com",
      wageType: "MONTHLY",
      amount: 16_000,
      shift: dayShift,
      location: hqLoc,
      departmentId: deptOps.id,
      positionId: posStaff.id,
      employmentTypeId: employmentContractId,
      employeeStatusId: statusActiveId,
      hireDate: "2026-05-01",
      probationEndDate: "2026-08-01",
      hue: 120,
      assignSchedule: true,
      notes: "ทดลองงาน / สัญญาจ้าง",
    },
    {
      code: `${DEMO_EMPLOYEE_PREFIX}0009`,
      firstNameTh: "ธนา",
      lastNameTh: "ลาออกแล้ว",
      displayName: "ธนา ลาออกแล้ว (เดโม)",
      phone: "0800000009",
      email: "thana.demo@example.com",
      wageType: "MONTHLY",
      amount: 19_000,
      shift: dayShift,
      location: hqLoc,
      departmentId: deptOps.id,
      positionId: posStaff.id,
      employmentTypeId: employmentMonthlyId,
      employeeStatusId: statusResignedId,
      hireDate: "2024-01-01",
      hue: 0,
      assignSchedule: false,
      notes: "RESIGNED — ไม่ลงตารางงานงวดเดโม",
    },
    {
      code: `${DEMO_EMPLOYEE_PREFIX}0010`,
      firstNameTh: "วราภรณ์",
      lastNameTh: "พักงาน",
      displayName: "วราภรณ์ พักงาน (เดโม)",
      phone: "0800000010",
      email: "waraporn.demo@example.com",
      wageType: "MONTHLY",
      amount: 17_000,
      shift: dayShift,
      location: hqLoc,
      departmentId: deptSales.id,
      positionId: posSales.id,
      employmentTypeId: employmentMonthlyId,
      employeeStatusId: statusSuspendedId,
      hireDate: "2025-01-15",
      hue: 350,
      assignSchedule: true,
      notes: "SUSPENDED — OT SUBMITTED (inbox)",
    },
  ];

  let compensations = 0;
  const employees: Array<{ id: string; seed: EmployeeSeed }> = [];

  for (const seed of employeeSeeds) {
    const employee = await prisma.employee.upsert({
      where: {
        organizationId_employeeCode: {
          organizationId,
          employeeCode: seed.code,
        },
      },
      update: {
        branchId,
        departmentId: seed.departmentId,
        positionId: seed.positionId,
        employmentTypeId: seed.employmentTypeId,
        employeeStatusId: seed.employeeStatusId,
        firstNameTh: seed.firstNameTh,
        lastNameTh: seed.lastNameTh,
        displayName: seed.displayName,
        phone: seed.phone,
        email: seed.email,
        notes: seed.notes,
        hireDate: new Date(`${seed.hireDate}T00:00:00Z`),
        probationEndDate: seed.probationEndDate
          ? new Date(`${seed.probationEndDate}T00:00:00Z`)
          : null,
        isActive: seed.employeeStatusId !== statusResignedId,
        updatedBy: actorId,
      },
      create: {
        organizationId,
        employeeCode: seed.code,
        branchId,
        departmentId: seed.departmentId,
        positionId: seed.positionId,
        employmentTypeId: seed.employmentTypeId,
        employeeStatusId: seed.employeeStatusId,
        firstNameTh: seed.firstNameTh,
        lastNameTh: seed.lastNameTh,
        displayName: seed.displayName,
        phone: seed.phone,
        email: seed.email,
        notes: seed.notes,
        hireDate: new Date(`${seed.hireDate}T00:00:00Z`),
        probationEndDate: seed.probationEndDate
          ? new Date(`${seed.probationEndDate}T00:00:00Z`)
          : null,
        isActive: seed.employeeStatusId !== statusResignedId,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });

    const photoUrl = await saveDemoAvatarSvg({
      organizationId,
      employeeId: employee.id,
      label: `${seed.firstNameTh.slice(0, 1)}${seed.lastNameTh.slice(0, 1)}`,
      hue: seed.hue,
    });
    await prisma.employee.update({
      where: { id: employee.id },
      data: { photoUrl: `${photoUrl}?demo=1` },
    });

    employees.push({ id: employee.id, seed });
    const employeeWageTypeId = await requireMasterId(
      prisma,
      "wageType",
      seed.wageType,
    );
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
          overtimeEligible: seed.employeeStatusId === statusActiveId,
          isCurrent: true,
          createdBy: actorId,
        },
      });
    }
    compensations += 1;
  }

  const byCode = (code: string) => {
    const row = employees.find((e) => e.seed.code === code);
    if (!row) throw new Error(`Demo employee ${code} missing`);
    return row;
  };

  const demoStart = new Date("2026-06-01T00:00:00Z");
  const demoEnd = new Date("2026-06-16T00:00:00Z");
  const masterByCode = async (model: string, code: string) => {
    const row = await db[model].findUnique({
      where: { code },
      select: { id: true },
    });
    if (!row) {
      throw new Error(
        `Master row ${model}.${code} is missing — run npm run seed:hr first`,
      );
    }
    return row.id as string;
  };
  const [
    draftScheduleStatusId,
    publicHolidayId,
    dayUnitId,
    approvedLeaveId,
    submittedLeaveId,
    rejectedLeaveId,
    approvedOvertimeId,
    submittedOvertimeId,
    openingTxId,
    usedTxId,
    baseSalaryId,
    presentId,
    lateId,
    earlyLeaveId,
    absentId,
    missingClockOutId,
    clockInId,
    clockOutId,
    taxDeductionId,
    ssoDeductionId,
    leaveSubmittedNotifId,
    otSubmittedNotifId,
    pendingNotifStatusId,
  ] = await Promise.all([
    masterByCode("schedulePeriodStatus", "DRAFT"),
    masterByCode("holidayType", "PUBLIC"),
    masterByCode("leaveUnit", "DAY"),
    masterByCode("leaveRequestStatus", "APPROVED"),
    masterByCode("leaveRequestStatus", "SUBMITTED"),
    masterByCode("leaveRequestStatus", "REJECTED"),
    masterByCode("overtimeRequestStatus", "APPROVED"),
    masterByCode("overtimeRequestStatus", "SUBMITTED"),
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
    masterByCode("deductionType", "TAX"),
    masterByCode("deductionType", "SOCIAL_SECURITY"),
    masterByCode("notificationType", "LEAVE_SUBMITTED"),
    masterByCode("notificationType", "OT_SUBMITTED"),
    masterByCode("notificationStatus", "PENDING"),
  ]);

  const calendar = await db.workCalendar.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: `${DEMO_PREFIX}STANDARD`,
      },
    },
    update: { branchId, workDays: [1, 2, 3, 4, 5] },
    create: {
      organizationId,
      branchId,
      code: `${DEMO_PREFIX}STANDARD`,
      name: "ปฏิทินทำงานมาตรฐาน (เดโม)",
      timezone: "Asia/Bangkok",
      workDays: [1, 2, 3, 4, 5],
    },
  });
  await db.holiday.upsert({
    where: {
      workCalendarId_holidayDate_name: {
        workCalendarId: calendar.id,
        holidayDate: new Date("2026-06-03T00:00:00Z"),
        name: "วันหยุดตัวอย่าง (เดโม)",
      },
    },
    update: { holidayTypeId: publicHolidayId, isPaid: true, branchId },
    create: {
      organizationId,
      branchId,
      workCalendarId: calendar.id,
      holidayTypeId: publicHolidayId,
      holidayDate: new Date("2026-06-03T00:00:00Z"),
      name: "วันหยุดตัวอย่าง (เดโม)",
      isPaid: true,
    },
  });
  const schedulePeriod = await db.schedulePeriod.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: `${DEMO_PREFIX}20260601_16`,
      },
    },
    update: {
      branchId,
      periodStart: demoStart,
      periodEnd: demoEnd,
      statusId: draftScheduleStatusId,
    },
    create: {
      organizationId,
      branchId,
      code: `${DEMO_PREFIX}20260601_16`,
      name: "ตารางงาน 1–16 มิถุนายน 2569 (เดโม)",
      periodStart: demoStart,
      periodEnd: demoEnd,
      statusId: draftScheduleStatusId,
      timezone: "Asia/Bangkok",
    },
  });

  let shiftAssignments = 0;
  for (const { id: employeeId, seed } of employees) {
    if (!seed.assignSchedule) continue;
    await db.employeeWorkCalendar.upsert({
      where: {
        employeeId_workCalendarId_effectiveFrom: {
          employeeId,
          workCalendarId: calendar.id,
          effectiveFrom: demoStart,
        },
      },
      update: { effectiveTo: null },
      create: {
        employeeId,
        workCalendarId: calendar.id,
        effectiveFrom: demoStart,
      },
    });
    await db.employeeWorkLocation.upsert({
      where: {
        employeeId_workLocationId_effectiveFrom: {
          employeeId,
          workLocationId: seed.location.id,
          effectiveFrom: demoStart,
        },
      },
      update: { isPrimary: true, effectiveTo: null },
      create: {
        employeeId,
        workLocationId: seed.location.id,
        effectiveFrom: demoStart,
        isPrimary: true,
      },
    });
    for (let day = 1; day <= 16; day += 1) {
      const workDate = new Date(
        `2026-06-${String(day).padStart(2, "0")}T00:00:00Z`,
      );
      await db.shiftAssignment.upsert({
        where: {
          employeeId_workDate_sequenceNo: {
            employeeId,
            workDate,
            sequenceNo: 1,
          },
        },
        update: {
          schedulePeriodId: schedulePeriod.id,
          shiftId: seed.shift.id,
          workLocationId: seed.location.id,
        },
        create: {
          schedulePeriodId: schedulePeriod.id,
          employeeId,
          shiftId: seed.shift.id,
          workDate,
          sequenceNo: 1,
          workLocationId: seed.location.id,
          createdByAuthUserId: actorId,
        },
      });
      shiftAssignments += 1;
    }
  }

  const attendanceFixtures = [
    {
      employee: byCode(`${DEMO_EMPLOYEE_PREFIX}0001`),
      day: 1,
      statusId: presentId,
      inAt: "2026-06-01T08:00:00Z",
      outAt: "2026-06-01T17:00:00Z",
      late: 0,
      early: 0,
      note: "มาตรงเวลา (เดโม)",
    },
    {
      employee: byCode(`${DEMO_EMPLOYEE_PREFIX}0002`),
      day: 2,
      statusId: lateId,
      inAt: "2026-06-02T20:20:00Z",
      outAt: "2026-06-03T05:00:00Z",
      late: 20,
      early: 0,
      note: "มาสาย (เดโม)",
    },
    {
      employee: byCode(`${DEMO_EMPLOYEE_PREFIX}0003`),
      day: 4,
      statusId: earlyLeaveId,
      inAt: "2026-06-04T22:00:00Z",
      outAt: "2026-06-05T05:30:00Z",
      late: 0,
      early: 30,
      note: "กลับก่อนเวลา (เดโม)",
    },
    {
      employee: byCode(`${DEMO_EMPLOYEE_PREFIX}0007`),
      day: 5,
      statusId: absentId,
      inAt: null,
      outAt: null,
      late: 0,
      early: 0,
      note: "ขาดงาน (เดโม)",
    },
    {
      employee: byCode(`${DEMO_EMPLOYEE_PREFIX}0002`),
      day: 6,
      statusId: missingClockOutId,
      inAt: "2026-06-06T20:00:00Z",
      outAt: null,
      late: 0,
      early: 0,
      note: "ไม่มีเวลาออกงาน (เดโม)",
    },
    {
      employee: byCode(`${DEMO_EMPLOYEE_PREFIX}0006`),
      day: 1,
      statusId: presentId,
      inAt: "2026-06-01T08:05:00Z",
      outAt: "2026-06-01T17:00:00Z",
      late: 0,
      early: 0,
      note: "ลงเวลาที่สาขา (เดโม)",
    },
    {
      employee: byCode(`${DEMO_EMPLOYEE_PREFIX}0004`),
      day: 2,
      statusId: presentId,
      inAt: "2026-06-02T08:00:00Z",
      outAt: "2026-06-02T17:00:00Z",
      late: 0,
      early: 0,
      note: "HR มาตรงเวลา (เดโม)",
    },
    {
      employee: byCode(`${DEMO_EMPLOYEE_PREFIX}0005`),
      day: 1,
      statusId: presentId,
      inAt: "2026-06-01T08:00:00Z",
      outAt: "2026-06-01T17:00:00Z",
      late: 0,
      early: 0,
      note: "Finance-ish มาตรงเวลา (เดโม)",
    },
  ];

  for (const fixture of attendanceFixtures) {
    const workDate = new Date(
      `2026-06-${String(fixture.day).padStart(2, "0")}T00:00:00Z`,
    );
    const assignment = await db.shiftAssignment.findUnique({
      where: {
        employeeId_workDate_sequenceNo: {
          employeeId: fixture.employee.id,
          workDate,
          sequenceNo: 1,
        },
      },
    });
    const loc = fixture.employee.seed.location;
    await db.attendanceDay.upsert({
      where: {
        employeeId_workDate: {
          employeeId: fixture.employee.id,
          workDate,
        },
      },
      update: {
        statusId: fixture.statusId,
        schedulePeriodId: schedulePeriod.id,
        shiftAssignmentId: assignment?.id ?? null,
        clockInAt: fixture.inAt ? new Date(fixture.inAt) : null,
        clockOutAt: fixture.outAt ? new Date(fixture.outAt) : null,
        scheduledMinutes: 480,
        workedMinutes:
          fixture.inAt && fixture.outAt
            ? 480 - fixture.late - fixture.early
            : 0,
        lateMinutes: fixture.late,
        earlyLeaveMinutes: fixture.early,
        notes: fixture.note,
      },
      create: {
        organizationId,
        branchId,
        employeeId: fixture.employee.id,
        workDate,
        statusId: fixture.statusId,
        schedulePeriodId: schedulePeriod.id,
        shiftAssignmentId: assignment?.id ?? null,
        clockInAt: fixture.inAt ? new Date(fixture.inAt) : null,
        clockOutAt: fixture.outAt ? new Date(fixture.outAt) : null,
        scheduledMinutes: 480,
        workedMinutes:
          fixture.inAt && fixture.outAt
            ? 480 - fixture.late - fixture.early
            : 0,
        lateMinutes: fixture.late,
        earlyLeaveMinutes: fixture.early,
        notes: fixture.note,
      },
    });
    if (fixture.inAt) {
      await db.attendanceEvent.upsert({
        where: {
          employeeId_idempotencyKey: {
            employeeId: fixture.employee.id,
            idempotencyKey: `${DEMO_PREFIX}IN_${fixture.employee.seed.code}_${fixture.day}`,
          },
        },
        update: {},
        create: {
          organizationId,
          branchId,
          employeeId: fixture.employee.id,
          eventTypeId: clockInId,
          occurredAt: new Date(fixture.inAt),
          workLocationId: loc.id,
          latitude: Number(loc.latitude),
          longitude: Number(loc.longitude),
          geofenceDistanceMeters: 0,
          idempotencyKey: `${DEMO_PREFIX}IN_${fixture.employee.seed.code}_${fixture.day}`,
          source: "DEMO",
        },
      });
    }
    if (fixture.outAt) {
      await db.attendanceEvent.upsert({
        where: {
          employeeId_idempotencyKey: {
            employeeId: fixture.employee.id,
            idempotencyKey: `${DEMO_PREFIX}OUT_${fixture.employee.seed.code}_${fixture.day}`,
          },
        },
        update: {},
        create: {
          organizationId,
          branchId,
          employeeId: fixture.employee.id,
          eventTypeId: clockOutId,
          occurredAt: new Date(fixture.outAt),
          workLocationId: loc.id,
          latitude: Number(loc.latitude),
          longitude: Number(loc.longitude),
          geofenceDistanceMeters: 0,
          idempotencyKey: `${DEMO_PREFIX}OUT_${fixture.employee.seed.code}_${fixture.day}`,
          source: "DEMO",
        },
      });
    }
  }

  const leaveAnnual = await db.leaveType.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: `${DEMO_PREFIX}ANNUAL`,
      },
    },
    update: { name: "ลาพักผ่อนประจำปี (เดโม)", unitId: dayUnitId },
    create: {
      organizationId,
      code: `${DEMO_PREFIX}ANNUAL`,
      name: "ลาพักผ่อนประจำปี (เดโม)",
      unitId: dayUnitId,
      isPaid: true,
    },
  });
  const leaveSick = await db.leaveType.upsert({
    where: {
      organizationId_code: { organizationId, code: `${DEMO_PREFIX}SICK` },
    },
    update: { name: "ลาป่วย (เดโม)", unitId: dayUnitId },
    create: {
      organizationId,
      code: `${DEMO_PREFIX}SICK`,
      name: "ลาป่วย (เดโม)",
      unitId: dayUnitId,
      isPaid: true,
    },
  });

  const emp1 = byCode(`${DEMO_EMPLOYEE_PREFIX}0001`);
  const emp4 = byCode(`${DEMO_EMPLOYEE_PREFIX}0004`);
  const emp8 = byCode(`${DEMO_EMPLOYEE_PREFIX}0008`);
  const emp10 = byCode(`${DEMO_EMPLOYEE_PREFIX}0010`);

  const balance = await db.employeeLeaveBalance.upsert({
    where: {
      employeeId_leaveTypeId_balanceYear: {
        employeeId: emp1.id,
        leaveTypeId: leaveAnnual.id,
        balanceYear: 2026,
      },
    },
    update: { openingBalance: 10, usedBalance: 1, availableBalance: 9 },
    create: {
      employeeId: emp1.id,
      leaveTypeId: leaveAnnual.id,
      balanceYear: 2026,
      openingBalance: 10,
      usedBalance: 1,
      availableBalance: 9,
    },
  });

  let leaveApproved = await db.leaveRequest.findFirst({
    where: {
      employeeId: emp1.id,
      leaveTypeId: leaveAnnual.id,
      startDate: new Date("2026-06-10T00:00:00Z"),
      endDate: new Date("2026-06-10T00:00:00Z"),
    },
  });
  if (!leaveApproved) {
    leaveApproved = await db.leaveRequest.create({
      data: {
        organizationId,
        employeeId: emp1.id,
        leaveTypeId: leaveAnnual.id,
        statusId: approvedLeaveId,
        startDate: new Date("2026-06-10T00:00:00Z"),
        endDate: new Date("2026-06-10T00:00:00Z"),
        startUnitId: dayUnitId,
        endUnitId: dayUnitId,
        requestedAmount: 1,
        reason: "ลาพักผ่อนตัวอย่าง (อนุมัติแล้ว)",
        submittedAt: demoStart,
        reviewedAt: demoStart,
        reviewedByAuthUserId: actorId,
      },
    });
  }

  let leaveSubmitted = await db.leaveRequest.findFirst({
    where: {
      employeeId: emp4.id,
      leaveTypeId: leaveSick.id,
      startDate: new Date("2026-06-12T00:00:00Z"),
      reason: "ลาป่วยรออนุมัติ (เดโม)",
    },
  });
  if (!leaveSubmitted) {
    leaveSubmitted = await db.leaveRequest.create({
      data: {
        organizationId,
        employeeId: emp4.id,
        leaveTypeId: leaveSick.id,
        statusId: submittedLeaveId,
        startDate: new Date("2026-06-12T00:00:00Z"),
        endDate: new Date("2026-06-12T00:00:00Z"),
        startUnitId: dayUnitId,
        endUnitId: dayUnitId,
        requestedAmount: 1,
        reason: "ลาป่วยรออนุมัติ (เดโม)",
        submittedAt: demoStart,
      },
    });
  }

  const leaveRejectedExists = await db.leaveRequest.findFirst({
    where: {
      employeeId: emp8.id,
      leaveTypeId: leaveAnnual.id,
      startDate: new Date("2026-06-15T00:00:00Z"),
      reason: "ลาถูกปฏิเสธ (เดโม)",
    },
    select: { id: true },
  });
  if (!leaveRejectedExists) {
    await db.leaveRequest.create({
      data: {
        organizationId,
        employeeId: emp8.id,
        leaveTypeId: leaveAnnual.id,
        statusId: rejectedLeaveId,
        startDate: new Date("2026-06-15T00:00:00Z"),
        endDate: new Date("2026-06-15T00:00:00Z"),
        startUnitId: dayUnitId,
        endUnitId: dayUnitId,
        requestedAmount: 1,
        reason: "ลาถูกปฏิเสธ (เดโม)",
        submittedAt: demoStart,
        reviewedAt: demoStart,
        reviewedByAuthUserId: actorId,
      },
    });
  }

  for (const transaction of [
    {
      type: openingTxId,
      amount: 10,
      after: 10,
      reference: `${DEMO_PREFIX}OPENING_2026`,
    },
    {
      type: usedTxId,
      amount: -1,
      after: 9,
      reference: `${DEMO_PREFIX}LEAVE_20260610`,
    },
  ]) {
    const exists = await db.leaveBalanceTransaction.findFirst({
      where: {
        employeeLeaveBalanceId: balance.id,
        reference: transaction.reference,
      },
    });
    if (!exists) {
      await db.leaveBalanceTransaction.create({
        data: {
          employeeLeaveBalanceId: balance.id,
          transactionTypeId: transaction.type,
          leaveRequestId:
            transaction.amount < 0 ? leaveApproved.id : null,
          occurredOn: demoStart,
          amount: transaction.amount,
          balanceAfter: transaction.after,
          reference: transaction.reference,
          createdByAuthUserId: actorId,
        },
      });
    }
  }

  const otRule = await prisma.overtimeRule.findUnique({
    where: {
      organizationId_code: {
        organizationId,
        code: `${DEMO_PREFIX}OT_NORMAL`,
      },
    },
  });
  const overtimeDay = await db.attendanceDay.findUnique({
    where: {
      employeeId_workDate: {
        employeeId: emp1.id,
        workDate: new Date("2026-06-01T00:00:00Z"),
      },
    },
  });
  const existingOvertime = await db.overtimeRequest.findFirst({
    where: {
      employeeId: emp1.id,
      workDate: new Date("2026-06-01T00:00:00Z"),
      reason: "ทำงานล่วงเวลาตัวอย่าง",
    },
  });
  if (!existingOvertime) {
    await db.overtimeRequest.create({
      data: {
        organizationId,
        branchId,
        employeeId: emp1.id,
        attendanceDayId: overtimeDay?.id ?? null,
        overtimeRuleId: otRule?.id ?? null,
        statusId: approvedOvertimeId,
        workDate: new Date("2026-06-01T00:00:00Z"),
        startAt: new Date("2026-06-01T17:00:00Z"),
        endAt: new Date("2026-06-01T19:00:00Z"),
        requestedMinutes: 120,
        approvedMinutes: 120,
        reason: "ทำงานล่วงเวลาตัวอย่าง",
        submittedAt: demoStart,
        reviewedAt: demoStart,
        reviewedByAuthUserId: actorId,
      },
    });
  }

  const pendingOt = await db.overtimeRequest.findFirst({
    where: {
      employeeId: emp10.id,
      workDate: new Date("2026-06-08T00:00:00Z"),
      reason: "OT รออนุมัติ (เดโม)",
    },
  });
  if (!pendingOt) {
    await db.overtimeRequest.create({
      data: {
        organizationId,
        branchId,
        employeeId: emp10.id,
        overtimeRuleId: otRule?.id ?? null,
        statusId: submittedOvertimeId,
        workDate: new Date("2026-06-08T00:00:00Z"),
        startAt: new Date("2026-06-08T17:00:00Z"),
        endAt: new Date("2026-06-08T20:00:00Z"),
        requestedMinutes: 180,
        reason: "OT รออนุมัติ (เดโม)",
        submittedAt: demoStart,
      },
    });
  }

  const recurring = await db.employeeRecurringPayItem.findFirst({
    where: {
      employeeId: emp1.id,
      earningTypeId: baseSalaryId,
      effectiveFrom: demoStart,
    },
  });
  if (!recurring) {
    await db.employeeRecurringPayItem.create({
      data: {
        employeeId: emp1.id,
        earningTypeId: baseSalaryId,
        amount: 1_500,
        effectiveFrom: demoStart,
        createdByAuthUserId: actorId,
      },
    });
  }
  const ssoRecurring = await db.employeeRecurringPayItem.findFirst({
    where: {
      employeeId: byCode(`${DEMO_EMPLOYEE_PREFIX}0005`).id,
      deductionTypeId: ssoDeductionId,
      effectiveFrom: demoStart,
    },
  });
  if (!ssoRecurring) {
    await db.employeeRecurringPayItem.create({
      data: {
        employeeId: byCode(`${DEMO_EMPLOYEE_PREFIX}0005`).id,
        deductionTypeId: ssoDeductionId,
        amount: 750,
        effectiveFrom: demoStart,
        createdByAuthUserId: actorId,
      },
    });
  }

  let notifications = 0;
  const notifLeave = await db.notification.findFirst({
    where: {
      organizationId,
      entityType: "LEAVE_REQUEST",
      entityId: leaveSubmitted.id,
    },
  });
  if (!notifLeave) {
    await db.notification.create({
      data: {
        organizationId,
        branchId,
        recipientAuthUserId: actorId,
        recipientEmployeeId: emp4.id,
        typeId: leaveSubmittedNotifId,
        statusId: pendingNotifStatusId,
        title: "คำขอลาป่วยรออนุมัติ (เดโม)",
        body: "นภา สุขใจ ส่งคำขอลาป่วย 1 วัน",
        entityType: "LEAVE_REQUEST",
        entityId: leaveSubmitted.id,
      },
    });
    notifications += 1;
  }
  const pendingOtRow = await db.overtimeRequest.findFirst({
    where: {
      employeeId: emp10.id,
      reason: "OT รออนุมัติ (เดโม)",
    },
  });
  if (pendingOtRow) {
    const notifOt = await db.notification.findFirst({
      where: {
        organizationId,
        entityType: "OVERTIME_REQUEST",
        entityId: pendingOtRow.id,
      },
    });
    if (!notifOt) {
      await db.notification.create({
        data: {
          organizationId,
          branchId,
          recipientAuthUserId: actorId,
          recipientEmployeeId: emp10.id,
          typeId: otSubmittedNotifId,
          statusId: pendingNotifStatusId,
          title: "คำขอ OT รออนุมัติ (เดโม)",
          body: "วราภรณ์ พักงาน ส่งคำขอ OT 3 ชั่วโมง",
          entityType: "OVERTIME_REQUEST",
          entityId: pendingOtRow.id,
        },
      });
      notifications += 1;
    }
  }

  const demoPayrollPeriod = await db.payrollPeriod.findFirst({
    where: { organizationId, payrollScheduleId: payrollSchedule.id },
    orderBy: { periodStart: "asc" },
  });
  if (demoPayrollPeriod) {
    const run = await db.payrollRun.upsert({
      where: {
        payrollPeriodId_runNumber: {
          payrollPeriodId: demoPayrollPeriod.id,
          runNumber: 1,
        },
      },
      update: {},
      create: {
        organizationId,
        payrollPeriodId: demoPayrollPeriod.id,
        runNumber: 1,
        statusId: draftStatusId,
        createdByAuthUserId: actorId,
      },
    });
    for (const { id: employeeId, seed } of employees) {
      if (seed.employeeStatusId === statusResignedId) continue;
      const tax = seed.code === `${DEMO_EMPLOYEE_PREFIX}0005` ? 1_200 : 0;
      const sso = seed.code === `${DEMO_EMPLOYEE_PREFIX}0005` ? 750 : 0;
      const deductions = tax + sso;
      const gross = seed.amount;
      const net = gross - deductions;
      const runEmployee = await db.payrollRunEmployee.upsert({
        where: {
          payrollRunId_employeeId: { payrollRunId: run.id, employeeId },
        },
        update: {
          grossEarnings: gross,
          totalDeductions: deductions,
          netPay: net,
        },
        create: {
          payrollRunId: run.id,
          employeeId,
          grossEarnings: gross,
          totalDeductions: deductions,
          netPay: net,
          statusId: draftStatusId,
          calculatedAt: demoStart,
        },
      });
      const earnLine = await db.payrollRunItem.findFirst({
        where: {
          payrollRunEmployeeId: runEmployee.id,
          sourceType: "DEMO_CALCULATED",
          earningTypeId: baseSalaryId,
        },
      });
      if (!earnLine) {
        await db.payrollRunItem.create({
          data: {
            payrollRunEmployeeId: runEmployee.id,
            earningTypeId: baseSalaryId,
            sourceType: "DEMO_CALCULATED",
            description: "ค่าจ้างคำนวณตัวอย่าง",
            quantity: 1,
            rate: gross,
            amount: gross,
          },
        });
      }
      if (tax > 0) {
        const taxLine = await db.payrollRunItem.findFirst({
          where: {
            payrollRunEmployeeId: runEmployee.id,
            sourceType: "DEMO_TAX",
          },
        });
        if (!taxLine) {
          await db.payrollRunItem.create({
            data: {
              payrollRunEmployeeId: runEmployee.id,
              deductionTypeId: taxDeductionId,
              sourceType: "DEMO_TAX",
              description: "หักภาษีตัวอย่าง (เดโม)",
              quantity: 1,
              rate: tax,
              amount: tax,
            },
          });
        }
      }
      if (sso > 0) {
        const ssoLine = await db.payrollRunItem.findFirst({
          where: {
            payrollRunEmployeeId: runEmployee.id,
            sourceType: "DEMO_SSO",
          },
        });
        if (!ssoLine) {
          await db.payrollRunItem.create({
            data: {
              payrollRunEmployeeId: runEmployee.id,
              deductionTypeId: ssoDeductionId,
              sourceType: "DEMO_SSO",
              description: "หักประกันสังคมตัวอย่าง (เดโม)",
              quantity: 1,
              rate: sso,
              amount: sso,
            },
          });
        }
      }
    }

    const slipEmp = await db.payrollRunEmployee.findUnique({
      where: {
        payrollRunId_employeeId: {
          payrollRunId: run.id,
          employeeId: emp1.id,
        },
      },
    });
    if (slipEmp) {
      await db.payslip.upsert({
        where: { payrollRunEmployeeId: slipEmp.id },
        update: {
          issuedAt: demoStart,
          issuedByAuthUserId: actorId,
          snapshot: {
            demo: true,
            employeeCode: emp1.seed.code,
            displayName: emp1.seed.displayName,
          },
          grossEarnings: emp1.seed.amount,
          totalDeductions: 0,
          netPay: emp1.seed.amount,
        },
        create: {
          payrollRunEmployeeId: slipEmp.id,
          employeeId: emp1.id,
          issuedAt: demoStart,
          issuedByAuthUserId: actorId,
          snapshot: {
            demo: true,
            employeeCode: emp1.seed.code,
            displayName: emp1.seed.displayName,
          },
          grossEarnings: emp1.seed.amount,
          totalDeductions: 0,
          netPay: emp1.seed.amount,
        },
      });
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
    departments: 3,
    positions: 4,
    workLocations: 2,
    shifts: 3,
    overtimeRules: 1,
    payrollSchedules: 1,
    payrollPeriods: periods.length,
    employees: employeeSeeds.length,
    compensations,
    workCalendars: 1,
    schedulePeriods: 1,
    shiftAssignments,
    attendanceDays: attendanceFixtures.length,
    attendanceEvents: attendanceFixtures.reduce(
      (count, fixture) =>
        count + (fixture.inAt ? 1 : 0) + (fixture.outAt ? 1 : 0),
      0,
    ),
    leaveRequests: 3,
    overtimeRequests: 2,
    recurringPayItems: 2,
    payrollRuns: demoPayrollPeriod ? 1 : 0,
    notifications,
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
      where: {
        organizationId,
        payrollSchedule: { code: { startsWith: DEMO_PREFIX } },
      },
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
    notifications: await db.notification.count({
      where: { organizationId, recipientEmployee: employeeFilter },
    }),
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
    payrollRun: {
      payrollPeriod: {
        payrollSchedule: { code: { startsWith: DEMO_PREFIX } },
      },
    },
  };

  await db.notificationOutbox.deleteMany({
    where: {
      notification: {
        organizationId,
        recipientEmployee: employeeFilter,
      },
    },
  });
  await db.notification.deleteMany({
    where: { organizationId, recipientEmployee: employeeFilter },
  });
  await db.payslip.deleteMany({ where: demoRuns });
  await db.payrollRun.deleteMany({
    where: { payrollPeriod: demoPayrollPeriods },
  });
  await db.leaveBalanceTransaction.deleteMany({
    where: { employeeLeaveBalance: { employee: employeeFilter } },
  });
  await db.employeeLeaveBalance.deleteMany({
    where: { employee: employeeFilter },
  });
  await db.leaveRequest.deleteMany({ where: { employee: employeeFilter } });
  await db.overtimeRequest.deleteMany({ where: { employee: employeeFilter } });
  await db.attendanceAdjustment.deleteMany({
    where: { employee: employeeFilter },
  });
  if (db.shiftMismatchRequest?.deleteMany) {
    await db.shiftMismatchRequest.deleteMany({
      where: { employee: employeeFilter },
    });
  }
  await db.attendanceEvent.deleteMany({ where: { employee: employeeFilter } });
  await db.attendanceDay.deleteMany({ where: { employee: employeeFilter } });
  await db.shiftAssignment.deleteMany({
    where: { schedulePeriod: demoSchedule },
  });
  await db.schedulePeriod.deleteMany({ where: demoSchedule });
  await db.employeeRecurringPayItem.deleteMany({
    where: { employee: employeeFilter },
  });
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
