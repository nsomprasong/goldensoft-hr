/**
 * HR side of the login-test tenant (แพลูกแพรว).
 *
 * Requires Platform `npm run seed:login-test` first (org + Auth users).
 * Creates employees linked to those users (password 12345678) plus ops fixtures.
 *
 * See docs/HR_LOGIN_TEST_DATASET.md
 */
import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { saveDemoAvatarSvg } from "@/lib/hr/employee-photos";
import { calculatePayroll } from "@/lib/hr/payroll-calc";
import { generateSemimonthlyPeriods } from "@/lib/hr/payroll-rules";

export const LOGIN_TEST_ORG_CODE = "TEST-PLUKPRAEW";
export const LOGIN_TEST_PREFIX = "TEST_";
export const LOGIN_TEST_EMPLOYEE_PREFIX = "EMP-";
export const LOGIN_TEST_MARKER_KEY = "login-test-hr";
export const LOGIN_TEST_PASSWORD = "12345678";

/** Must match goldensoft-platform/src/lib/seed/login-test-dataset.ts roster. */
export const LOGIN_TEST_ROSTER = [
  {
    key: "owner",
    employeeCode: "EMP-0001",
    email: "plukpraew.owner@example.com",
    phone: "0800000001",
    firstNameTh: "สมชาย",
    lastNameTh: "ใจดี",
    displayName: "สมชาย ใจดี",
    branchCode: "HQ",
    wageType: "MONTHLY" as const,
    amount: 35_000,
    shift: "DAY" as const,
    status: "ACTIVE" as const,
    employmentType: "MONTHLY" as const,
    hue: 210,
    assignSchedule: true,
    scenario: "OWNER — แอดมิน HR",
  },
  {
    key: "admin",
    employeeCode: "EMP-0002",
    email: "plukpraew.admin@example.com",
    phone: "0800000002",
    firstNameTh: "สมหญิง",
    lastNameTh: "รักงาน",
    displayName: "สมหญิง รักงาน",
    branchCode: "HQ",
    wageType: "MONTHLY" as const,
    amount: 30_000,
    shift: "DAY" as const,
    status: "ACTIVE" as const,
    employmentType: "MONTHLY" as const,
    hue: 330,
    assignSchedule: true,
    scenario: "ADMIN — จัดการ HR",
  },
  {
    key: "hq-supervisor",
    employeeCode: "EMP-0003",
    email: "plukpraew.hq.supervisor@example.com",
    phone: "0800000003",
    firstNameTh: "วิชัย",
    lastNameTh: "ขยันงาน",
    displayName: "วิชัย ขยันงาน",
    branchCode: "HQ",
    wageType: "MONTHLY" as const,
    amount: 25_000,
    shift: "DAY" as const,
    status: "ACTIVE" as const,
    employmentType: "MONTHLY" as const,
    hue: 160,
    assignSchedule: true,
    scenario: "พนักงาน HQ self-service",
  },
  {
    key: "hq-staff-1",
    employeeCode: "EMP-0004",
    email: "plukpraew.hq.staff1@example.com",
    phone: "0800000004",
    firstNameTh: "นภา",
    lastNameTh: "สุขใจ",
    displayName: "นภา สุขใจ",
    branchCode: "HQ",
    wageType: "MONTHLY" as const,
    amount: 22_000,
    shift: "DAY" as const,
    status: "ACTIVE" as const,
    employmentType: "MONTHLY" as const,
    hue: 280,
    assignSchedule: true,
    scenario: "leave SUBMITTED",
  },
  {
    key: "hq-staff-2",
    employeeCode: "EMP-0005",
    email: "plukpraew.hq.staff2@example.com",
    phone: "0800000005",
    firstNameTh: "ประยุทธ์",
    lastNameTh: "มั่นคง",
    displayName: "ประยุทธ์ มั่นคง",
    branchCode: "HQ",
    wageType: "MONTHLY" as const,
    amount: 28_000,
    shift: "DAY" as const,
    status: "ACTIVE" as const,
    employmentType: "MONTHLY" as const,
    hue: 30,
    assignSchedule: true,
    scenario: "TAX + SSO",
  },
  {
    key: "b1-manager",
    employeeCode: "EMP-0006",
    email: "plukpraew.b1.manager@example.com",
    phone: "0800000006",
    firstNameTh: "ศิริพร",
    lastNameTh: "ยิ้มแย้ม",
    displayName: "ศิริพร ยิ้มแย้ม",
    branchCode: "BRANCH01",
    wageType: "MONTHLY" as const,
    amount: 20_000,
    shift: "DAY" as const,
    status: "ACTIVE" as const,
    employmentType: "MONTHLY" as const,
    hue: 45,
    assignSchedule: true,
    scenario: "สาขา BRANCH01",
  },
  {
    key: "b1-staff-1",
    employeeCode: "EMP-0007",
    email: "plukpraew.b1.staff1@example.com",
    phone: "0800000007",
    firstNameTh: "อนุชา",
    lastNameTh: "ตรงเวลา",
    displayName: "อนุชา ตรงเวลา",
    branchCode: "BRANCH01",
    wageType: "DAILY" as const,
    amount: 850,
    shift: "NIGHT" as const,
    status: "ACTIVE" as const,
    employmentType: "DAILY" as const,
    hue: 190,
    assignSchedule: true,
    scenario: "ABSENT + LATE",
  },
  {
    key: "hq-newhire",
    employeeCode: "EMP-0008",
    email: "plukpraew.hq.newhire@example.com",
    phone: "0800000008",
    firstNameTh: "จิราภรณ์",
    lastNameTh: "ใหม่งาน",
    displayName: "จิราภรณ์ ใหม่งาน",
    branchCode: "HQ",
    wageType: "MONTHLY" as const,
    amount: 16_000,
    shift: "DAY" as const,
    status: "ACTIVE" as const,
    employmentType: "CONTRACT" as const,
    hue: 120,
    assignSchedule: true,
    probationEndDate: "2026-08-01",
    scenario: "ทดลองงาน",
  },
  {
    key: "hq-resigned",
    employeeCode: "EMP-0009",
    email: "plukpraew.hq.resigned@example.com",
    phone: "0800000009",
    firstNameTh: "ธนา",
    lastNameTh: "ลาออกแล้ว",
    displayName: "ธนา ลาออกแล้ว",
    branchCode: "HQ",
    wageType: "MONTHLY" as const,
    amount: 19_000,
    shift: "DAY" as const,
    status: "RESIGNED" as const,
    employmentType: "MONTHLY" as const,
    hue: 0,
    assignSchedule: false,
    scenario: "RESIGNED",
  },
  {
    key: "b1-suspended",
    employeeCode: "EMP-0010",
    email: "plukpraew.b1.suspended@example.com",
    phone: "0800000010",
    firstNameTh: "วราภรณ์",
    lastNameTh: "พักงาน",
    displayName: "วราภรณ์ พักงาน",
    branchCode: "BRANCH01",
    wageType: "MONTHLY" as const,
    amount: 17_000,
    shift: "DAY" as const,
    status: "SUSPENDED" as const,
    employmentType: "MONTHLY" as const,
    hue: 350,
    assignSchedule: true,
    scenario: "OT SUBMITTED",
  },
] as const;

type PlatformContext = {
  organizationId: string;
  branches: Record<string, string>;
  users: Record<
    string,
    { platformUserId: string; authUserId: string; email: string }
  >;
};

async function requireMasterId(
  prisma: PrismaClient,
  model: string,
  code: string,
): Promise<string> {
  const db = prisma as any;
  const row = await db[model].findUnique({
    where: { code },
    select: { id: true },
  });
  if (!row) {
    throw new Error(`Master ${model}.${code} missing — run npm run seed:hr`);
  }
  return row.id as string;
}

export async function resolveLoginTestPlatformContext(
  prisma: PrismaClient,
): Promise<PlatformContext> {
  const orgs = await prisma.$queryRaw<
    Array<{ id: string; customer_code: string }>
  >`
    SELECT id::text AS id, customer_code
    FROM platform.organizations
    WHERE customer_code = ${LOGIN_TEST_ORG_CODE}
      AND deleted_at IS NULL
    LIMIT 1
  `;
  const org = orgs[0];
  if (!org) {
    throw new Error(
      `ไม่พบองค์กร ${LOGIN_TEST_ORG_CODE} — รันที่ goldensoft-platform: npm run seed:login-test ก่อน`,
    );
  }

  const branchRows = await prisma.$queryRaw<
    Array<{ id: string; code: string }>
  >`
    SELECT id::text AS id, code
    FROM platform.branches
    WHERE organization_id = ${org.id}::uuid
      AND deleted_at IS NULL
  `;
  const branches: Record<string, string> = {};
  for (const b of branchRows) branches[b.code] = b.id;
  if (!branches.HQ || !branches.BRANCH01) {
    throw new Error(
      "องค์กรทดสอบต้องมีสาขา HQ และ BRANCH01 — รัน seed:login-test ใหม่",
    );
  }

  const emailSet = new Set(
    LOGIN_TEST_ROSTER.map((r) => r.email.toLowerCase()),
  );
  const userRows = await prisma.$queryRaw<
    Array<{
      email: string;
      platform_user_id: string;
      auth_user_id: string;
    }>
  >`
    SELECT
      lower(up.email) AS email,
      up.id::text AS platform_user_id,
      up.auth_user_id::text AS auth_user_id
    FROM platform.user_profiles up
    INNER JOIN platform.organization_memberships om
      ON om.user_profile_id = up.id
    WHERE om.organization_id = ${org.id}::uuid
      AND up.deleted_at IS NULL
  `;

  const users: PlatformContext["users"] = {};
  for (const row of userRows) {
    if (!emailSet.has(row.email)) continue;
    users[row.email] = {
      platformUserId: row.platform_user_id,
      authUserId: row.auth_user_id,
      email: row.email,
    };
  }
  for (const person of LOGIN_TEST_ROSTER) {
    if (!users[person.email.toLowerCase()]) {
      throw new Error(
        `ไม่พบบัญชี ${person.email} ในองค์กร — รัน seed:login-test ที่ Platform ใหม่`,
      );
    }
  }

  return { organizationId: org.id, branches, users };
}

export async function seedLoginTestHr(
  prisma: PrismaClient,
): Promise<{
  organizationId: string;
  employees: number;
  password: string;
  roster: Array<{
    employeeCode: string;
    email: string;
    displayName: string;
    branchCode: string;
    scenario: string;
  }>;
}> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("login-test HR seed forbidden in production");
  }

  const ctx = await resolveLoginTestPlatformContext(prisma);
  const { organizationId, branches } = ctx;
  const db = prisma as any;
  const actorId = ctx.users[LOGIN_TEST_ROSTER[0].email.toLowerCase()].authUserId;
  const hqBranchId = branches.HQ;
  const prefix = LOGIN_TEST_PREFIX;

  const employmentMonthlyId = await requireMasterId(prisma, "employmentType", "MONTHLY");
  const employmentDailyId = await requireMasterId(prisma, "employmentType", "DAILY");
  const employmentContractId = await requireMasterId(prisma, "employmentType", "CONTRACT");
  const statusActiveId = await requireMasterId(prisma, "employeeStatus", "ACTIVE");
  const statusResignedId = await requireMasterId(prisma, "employeeStatus", "RESIGNED");
  const statusSuspendedId = await requireMasterId(prisma, "employeeStatus", "SUSPENDED");
  const shiftTypeId = await requireMasterId(prisma, "shiftType", "REGULAR");
  const nightShiftTypeId = await requireMasterId(prisma, "shiftType", "NIGHT");
  const payFrequencyId = await requireMasterId(prisma, "payFrequency", "SEMIMONTHLY");
  const overtimeRateTypeId = await requireMasterId(prisma, "overtimeRateType", "NORMAL_DAY");
  const draftStatusId = await requireMasterId(prisma, "payrollPeriodStatus", "DRAFT");
  const approvedStatusId = await requireMasterId(
    prisma,
    "payrollPeriodStatus",
    "APPROVED",
  );
  const reviewStatusId = await requireMasterId(
    prisma,
    "payrollPeriodStatus",
    "REVIEW",
  );

  const deptOps = await prisma.department.upsert({
    where: { organizationId_code: { organizationId, code: `${prefix}OPS` } },
    update: {},
    create: {
      organizationId,
      code: `${prefix}OPS`,
      nameTh: "ฝ่ายปฏิบัติการ",
      nameEn: "Operations",
    },
  });
  const deptHr = await prisma.department.upsert({
    where: { organizationId_code: { organizationId, code: `${prefix}HR` } },
    update: {},
    create: {
      organizationId,
      code: `${prefix}HR`,
      nameTh: "ฝ่ายบุคคล",
      nameEn: "HR",
    },
  });
  const posSupervisor = await prisma.position.upsert({
    where: {
      organizationId_code: { organizationId, code: `${prefix}SUPERVISOR` },
    },
    update: {},
    create: {
      organizationId,
      departmentId: deptOps.id,
      code: `${prefix}SUPERVISOR`,
      nameTh: "หัวหน้างาน",
      nameEn: "Supervisor",
    },
  });
  const posStaff = await prisma.position.upsert({
    where: { organizationId_code: { organizationId, code: `${prefix}STAFF` } },
    update: {},
    create: {
      organizationId,
      departmentId: deptOps.id,
      code: `${prefix}STAFF`,
      nameTh: "พนักงาน",
      nameEn: "Staff",
    },
  });
  const posHr = await prisma.position.upsert({
    where: {
      organizationId_code: { organizationId, code: `${prefix}HR_OFFICER` },
    },
    update: {},
    create: {
      organizationId,
      departmentId: deptHr.id,
      code: `${prefix}HR_OFFICER`,
      nameTh: "เจ้าหน้าที่บุคคล",
      nameEn: "HR Officer",
    },
  });

  const locHq = await prisma.workLocation.upsert({
    where: { organizationId_code: { organizationId, code: `${prefix}HQ` } },
    update: {
      branchId: hqBranchId,
      latitude: 13.7563,
      longitude: 100.5018,
      geofenceRadiusMeters: 50,
    },
    create: {
      organizationId,
      branchId: hqBranchId,
      code: `${prefix}HQ`,
      name: "สำนักงานใหญ่",
      latitude: 13.7563,
      longitude: 100.5018,
      geofenceRadiusMeters: 50,
      timezone: "Asia/Bangkok",
    },
  });
  const locBranch = await prisma.workLocation.upsert({
    where: {
      organizationId_code: { organizationId, code: `${prefix}BRANCH01` },
    },
    update: {
      branchId: branches.BRANCH01,
      latitude: 13.746,
      longitude: 100.534,
      geofenceRadiusMeters: 100,
    },
    create: {
      organizationId,
      branchId: branches.BRANCH01,
      code: `${prefix}BRANCH01`,
      name: "สาขาพระราม 9",
      latitude: 13.746,
      longitude: 100.534,
      geofenceRadiusMeters: 100,
      timezone: "Asia/Bangkok",
    },
  });

  const dayShift = await prisma.shift.upsert({
    where: { organizationId_code: { organizationId, code: `${prefix}DAY` } },
    update: {},
    create: {
      organizationId,
      branchId: hqBranchId,
      code: `${prefix}DAY`,
      name: "กะกลางวัน",
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
    where: { organizationId_code: { organizationId, code: `${prefix}NIGHT` } },
    update: {},
    create: {
      organizationId,
      branchId: branches.BRANCH01,
      code: `${prefix}NIGHT`,
      name: "กะกลางคืน",
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

  await prisma.overtimeRule.upsert({
    where: {
      organizationId_code: { organizationId, code: `${prefix}OT_NORMAL` },
    },
    update: {},
    create: {
      organizationId,
      code: `${prefix}OT_NORMAL`,
      name: "ค่าล่วงเวลาวันทำงานปกติ",
      rateTypeId: overtimeRateTypeId,
      multiplier: 1.5,
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    },
  });

  const scheduleRules = {
    periodStartRule: "DAY_1,DAY_17",
    periodEndRule: "DAY_16,LAST_DAY",
    paymentDayRule: "DAYS_AFTER_END:5",
  };
  const payrollSchedule = await prisma.payrollSchedule.upsert({
    where: { organizationId_code: { organizationId, code: `${prefix}SEMI` } },
    update: scheduleRules,
    create: {
      organizationId,
      code: `${prefix}SEMI`,
      name: "งวดครึ่งเดือน",
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

  const statusIdFor = (code: string) => {
    if (code === "RESIGNED") return statusResignedId;
    if (code === "SUSPENDED") return statusSuspendedId;
    return statusActiveId;
  };
  const employmentIdFor = (code: string) => {
    if (code === "DAILY") return employmentDailyId;
    if (code === "CONTRACT") return employmentContractId;
    return employmentMonthlyId;
  };

  const employees: Array<{
    id: string;
    code: string;
    key: string;
    branchId: string;
    authUserId: string;
  }> = [];

  for (const person of LOGIN_TEST_ROSTER) {
    const link = ctx.users[person.email.toLowerCase()];
    const branchId = branches[person.branchCode];
    const positionId =
      person.key === "owner" || person.key === "hq-supervisor"
        ? posSupervisor.id
        : person.key === "admin" || person.key === "hq-staff-1"
          ? posHr.id
          : posStaff.id;
    const departmentId =
      person.key === "admin" || person.key === "hq-staff-1"
        ? deptHr.id
        : deptOps.id;

    const employee = await prisma.employee.upsert({
      where: {
        organizationId_employeeCode: {
          organizationId,
          employeeCode: person.employeeCode,
        },
      },
      update: {
        branchId,
        departmentId,
        positionId,
        employmentTypeId: employmentIdFor(person.employmentType),
        employeeStatusId: statusIdFor(person.status),
        firstNameTh: person.firstNameTh,
        lastNameTh: person.lastNameTh,
        displayName: person.displayName,
        phone: person.phone,
        email: person.email,
        platformUserId: link.platformUserId,
        authUserId: link.authUserId,
        isActive: person.status !== "RESIGNED",
        probationEndDate:
          "probationEndDate" in person && person.probationEndDate
            ? new Date(`${person.probationEndDate}T00:00:00Z`)
            : null,
        notes: person.scenario,
        updatedBy: actorId,
      },
      create: {
        organizationId,
        employeeCode: person.employeeCode,
        branchId,
        departmentId,
        positionId,
        employmentTypeId: employmentIdFor(person.employmentType),
        employeeStatusId: statusIdFor(person.status),
        firstNameTh: person.firstNameTh,
        lastNameTh: person.lastNameTh,
        displayName: person.displayName,
        phone: person.phone,
        email: person.email,
        platformUserId: link.platformUserId,
        authUserId: link.authUserId,
        hireDate: new Date("2025-01-01T00:00:00Z"),
        probationEndDate:
          "probationEndDate" in person && person.probationEndDate
            ? new Date(`${person.probationEndDate}T00:00:00Z`)
            : null,
        isActive: person.status !== "RESIGNED",
        notes: person.scenario,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });

    const photoUrl = await saveDemoAvatarSvg({
      organizationId,
      employeeId: employee.id,
      label: `${person.firstNameTh.slice(0, 1)}${person.lastNameTh.slice(0, 1)}`,
      hue: person.hue,
    });
    await prisma.employee.update({
      where: { id: employee.id },
      data: { photoUrl: `${photoUrl}?v=login-test` },
    });

    const wageTypeId = await requireMasterId(prisma, "wageType", person.wageType);
    const existingComp = await prisma.employeeCompensation.findFirst({
      where: { employeeId: employee.id, isCurrent: true },
    });
    if (!existingComp) {
      await prisma.employeeCompensation.create({
        data: {
          employeeId: employee.id,
          wageTypeId,
          amount: person.amount,
          currency: "THB",
          effectiveFrom: new Date("2026-01-01T00:00:00Z"),
          standardHoursPerDay: 8,
          standardDaysPerMonth: 30,
          overtimeEligible: person.status === "ACTIVE",
          isCurrent: true,
          createdBy: actorId,
        },
      });
    }

    employees.push({
      id: employee.id,
      code: person.employeeCode,
      key: person.key,
      branchId,
      authUserId: link.authUserId,
    });
  }

  const byKey = (key: string) => {
    const row = employees.find((e) => e.key === key);
    if (!row) throw new Error(`employee ${key} missing`);
    return row;
  };

  // Align attendance / OT with the first generated payroll period so calculate
  // picks up OT / สาย / ขาดงาน in the same window as the sample payroll run.
  const seededPayPeriods = await db.payrollPeriod.findMany({
    where: { organizationId, payrollScheduleId: payrollSchedule.id },
    orderBy: { periodStart: "asc" },
  });
  const demoStart =
    seededPayPeriods[0]?.periodStart ?? new Date("2026-06-01T00:00:00Z");
  const demoEnd =
    seededPayPeriods[0]?.periodEnd ?? new Date("2026-06-16T00:00:00Z");
  const demoDay = (day: number) => {
    const d = new Date(demoStart);
    d.setUTCDate(d.getUTCDate() + (day - 1));
    return d;
  };
  const demoDayIso = (day: number, hm = "00:00:00") => {
    const d = demoDay(day);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dd}T${hm}Z`;
  };
  const [
    draftScheduleStatusId,
    publicHolidayId,
    dayUnitId,
    approvedLeaveId,
    submittedLeaveId,
    approvedOtId,
    submittedOtId,
    presentId,
    lateId,
    absentId,
    clockInId,
    clockOutId,
    baseSalaryId,
    overtimeEarnId,
    taxId,
    ssoId,
    lateDedId,
    absenceDedId,
    leaveNotifId,
    otNotifId,
    advanceNotifId,
    deliveredNotifId,
    pendingNotifId,
  ] = await Promise.all([
    requireMasterId(prisma, "schedulePeriodStatus", "DRAFT"),
    requireMasterId(prisma, "holidayType", "PUBLIC"),
    requireMasterId(prisma, "leaveUnit", "DAY"),
    requireMasterId(prisma, "leaveRequestStatus", "APPROVED"),
    requireMasterId(prisma, "leaveRequestStatus", "SUBMITTED"),
    requireMasterId(prisma, "overtimeRequestStatus", "APPROVED"),
    requireMasterId(prisma, "overtimeRequestStatus", "SUBMITTED"),
    requireMasterId(prisma, "attendanceStatus", "PRESENT"),
    requireMasterId(prisma, "attendanceStatus", "LATE"),
    requireMasterId(prisma, "attendanceStatus", "ABSENT"),
    requireMasterId(prisma, "attendanceEventType", "CLOCK_IN"),
    requireMasterId(prisma, "attendanceEventType", "CLOCK_OUT"),
    requireMasterId(prisma, "earningType", "BASE_SALARY"),
    requireMasterId(prisma, "earningType", "OVERTIME"),
    requireMasterId(prisma, "deductionType", "TAX"),
    requireMasterId(prisma, "deductionType", "SOCIAL_SECURITY"),
    requireMasterId(prisma, "deductionType", "LATE"),
    requireMasterId(prisma, "deductionType", "ABSENCE"),
    requireMasterId(prisma, "notificationType", "LEAVE_SUBMITTED"),
    requireMasterId(prisma, "notificationType", "OT_SUBMITTED"),
    requireMasterId(prisma, "notificationType", "ADVANCE_SUBMITTED"),
    requireMasterId(prisma, "notificationStatus", "DELIVERED"),
    requireMasterId(prisma, "notificationStatus", "PENDING"),
  ]);
  void pendingNotifId;

  const calendar = await db.workCalendar.upsert({
    where: {
      organizationId_code: { organizationId, code: `${prefix}STANDARD` },
    },
    update: { branchId: hqBranchId, workDays: [1, 2, 3, 4, 5] },
    create: {
      organizationId,
      branchId: hqBranchId,
      code: `${prefix}STANDARD`,
      name: "ปฏิทินทำงานมาตรฐาน",
      timezone: "Asia/Bangkok",
      workDays: [1, 2, 3, 4, 5],
    },
  });
  await db.holiday.upsert({
    where: {
      workCalendarId_holidayDate_name: {
        workCalendarId: calendar.id,
        holidayDate: demoDay(3),
        name: "วันหยุดตัวอย่าง",
      },
    },
    update: {},
    create: {
      organizationId,
      branchId: hqBranchId,
      workCalendarId: calendar.id,
      holidayTypeId: publicHolidayId,
      holidayDate: demoDay(3),
      name: "วันหยุดตัวอย่าง",
      isPaid: true,
    },
  });
  const schedulePeriodCode = `${prefix}${demoStart.toISOString().slice(0, 10).replace(/-/g, "")}_${String(demoEnd.getUTCDate()).padStart(2, "0")}`;
  const schedulePeriod = await db.schedulePeriod.upsert({
    where: {
      organizationId_code: { organizationId, code: schedulePeriodCode },
    },
    update: {
      branchId: hqBranchId,
      periodStart: demoStart,
      periodEnd: demoEnd,
      statusId: draftScheduleStatusId,
    },
    create: {
      organizationId,
      branchId: hqBranchId,
      code: schedulePeriodCode,
      name: "ตารางงาน 1–16 มิถุนายน 2569",
      periodStart: demoStart,
      periodEnd: demoEnd,
      statusId: draftScheduleStatusId,
      timezone: "Asia/Bangkok",
    },
  });
  const branchSchedulePeriod = await db.schedulePeriod.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: `${schedulePeriodCode}_B1`,
      },
    },
    update: {
      branchId: branches.BRANCH01,
      periodStart: demoStart,
      periodEnd: demoEnd,
      statusId: draftScheduleStatusId,
    },
    create: {
      organizationId,
      branchId: branches.BRANCH01,
      code: `${schedulePeriodCode}_B1`,
      name: "ตารางงานสาขา 1–16 มิถุนายน 2569",
      periodStart: demoStart,
      periodEnd: demoEnd,
      statusId: draftScheduleStatusId,
      timezone: "Asia/Bangkok",
    },
  });

  for (const person of LOGIN_TEST_ROSTER) {
    if (!person.assignSchedule) continue;
    const emp = byKey(person.key);
    const location = person.branchCode === "BRANCH01" ? locBranch : locHq;
    const shift = person.shift === "NIGHT" ? nightShift : dayShift;
    const personPeriod =
      person.branchCode === "BRANCH01" ? branchSchedulePeriod : schedulePeriod;
    await db.employeeWorkCalendar.upsert({
      where: {
        employeeId_workCalendarId_effectiveFrom: {
          employeeId: emp.id,
          workCalendarId: calendar.id,
          effectiveFrom: demoStart,
        },
      },
      update: {},
      create: {
        employeeId: emp.id,
        workCalendarId: calendar.id,
        effectiveFrom: demoStart,
      },
    });
    // One primary current location per employee (partial unique on employee_id).
    // Prefer update-in-place when demoStart / location drift across re-seeds.
    const existingPrimaryLoc = await db.employeeWorkLocation.findFirst({
      where: {
        employeeId: emp.id,
        isPrimary: true,
        effectiveTo: null,
      },
    });
    if (existingPrimaryLoc) {
      await db.employeeWorkLocation.update({
        where: { id: existingPrimaryLoc.id },
        data: {
          workLocationId: location.id,
          effectiveFrom: demoStart,
          isPrimary: true,
        },
      });
    } else {
      await db.employeeWorkLocation.create({
        data: {
          employeeId: emp.id,
          workLocationId: location.id,
          effectiveFrom: demoStart,
          isPrimary: true,
        },
      });
    }
    for (let day = 1; day <= 10; day += 1) {
      const workDate = demoDay(day);
      await db.shiftAssignment.upsert({
        where: {
          employeeId_workDate_sequenceNo: {
            employeeId: emp.id,
            workDate,
            sequenceNo: 1,
          },
        },
        update: {
          schedulePeriodId: personPeriod.id,
          shiftId: shift.id,
          workLocationId: location.id,
        },
        create: {
          schedulePeriodId: personPeriod.id,
          employeeId: emp.id,
          shiftId: shift.id,
          workDate,
          sequenceNo: 1,
          workLocationId: location.id,
          createdByAuthUserId: actorId,
        },
      });
    }
  }

  async function upsertAttendance(input: {
    key: string;
    day: number;
    statusId: string;
    inAt: string | null;
    outAt: string | null;
    late?: number;
    note: string;
  }) {
    const emp = byKey(input.key);
    const person = LOGIN_TEST_ROSTER.find((p) => p.key === input.key)!;
    const location = person.branchCode === "BRANCH01" ? locBranch : locHq;
    const workDate = demoDay(input.day);
    const assignment = await db.shiftAssignment.findUnique({
      where: {
        employeeId_workDate_sequenceNo: {
          employeeId: emp.id,
          workDate,
          sequenceNo: 1,
        },
      },
    });
    await db.attendanceDay.upsert({
      where: { employeeId_workDate: { employeeId: emp.id, workDate } },
      update: {
        statusId: input.statusId,
        clockInAt: input.inAt ? new Date(input.inAt) : null,
        clockOutAt: input.outAt ? new Date(input.outAt) : null,
        lateMinutes: input.late ?? 0,
        notes: input.note,
      },
      create: {
        organizationId,
        branchId: emp.branchId,
        employeeId: emp.id,
        workDate,
        statusId: input.statusId,
        schedulePeriodId: assignment?.schedulePeriodId ?? schedulePeriod.id,
        shiftAssignmentId: assignment?.id ?? null,
        clockInAt: input.inAt ? new Date(input.inAt) : null,
        clockOutAt: input.outAt ? new Date(input.outAt) : null,
        scheduledMinutes: 480,
        workedMinutes: input.inAt && input.outAt ? 480 - (input.late ?? 0) : 0,
        lateMinutes: input.late ?? 0,
        notes: input.note,
      },
    });
    if (input.inAt) {
      await db.attendanceEvent.upsert({
        where: {
          employeeId_idempotencyKey: {
            employeeId: emp.id,
            idempotencyKey: `${prefix}IN_${input.key}_${input.day}`,
          },
        },
        update: {},
        create: {
          organizationId,
          branchId: emp.branchId,
          employeeId: emp.id,
          eventTypeId: clockInId,
          occurredAt: new Date(input.inAt),
          workLocationId: location.id,
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          geofenceDistanceMeters: 0,
          idempotencyKey: `${prefix}IN_${input.key}_${input.day}`,
          source: "LOGIN_TEST",
        },
      });
    }
    if (input.outAt) {
      await db.attendanceEvent.upsert({
        where: {
          employeeId_idempotencyKey: {
            employeeId: emp.id,
            idempotencyKey: `${prefix}OUT_${input.key}_${input.day}`,
          },
        },
        update: {},
        create: {
          organizationId,
          branchId: emp.branchId,
          employeeId: emp.id,
          eventTypeId: clockOutId,
          occurredAt: new Date(input.outAt),
          workLocationId: location.id,
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          geofenceDistanceMeters: 0,
          idempotencyKey: `${prefix}OUT_${input.key}_${input.day}`,
          source: "LOGIN_TEST",
        },
      });
    }
  }

  await upsertAttendance({
    key: "owner",
    day: 1,
    statusId: presentId,
    inAt: demoDayIso(1, "08:00:00"),
    outAt: demoDayIso(1, "17:00:00"),
    note: "มาตรงเวลา",
  });
  // HQ late/absence so payroll run filtered to สำนักงานใหญ่ shows สาย/ขาดงาน
  await upsertAttendance({
    key: "hq-staff-1",
    day: 2,
    statusId: lateId,
    inAt: demoDayIso(2, "08:45:00"),
    outAt: demoDayIso(2, "17:00:00"),
    late: 45,
    note: "มาสาย",
  });
  await upsertAttendance({
    key: "hq-staff-2",
    day: 5,
    statusId: absentId,
    inAt: null,
    outAt: null,
    note: "ขาดงาน",
  });
  await upsertAttendance({
    key: "b1-staff-1",
    day: 2,
    statusId: lateId,
    inAt: demoDayIso(2, "20:20:00"),
    outAt: demoDayIso(3, "05:00:00"),
    late: 20,
    note: "มาสาย",
  });
  await upsertAttendance({
    key: "b1-staff-1",
    day: 5,
    statusId: absentId,
    inAt: null,
    outAt: null,
    note: "ขาดงาน",
  });
  await upsertAttendance({
    key: "b1-manager",
    day: 1,
    statusId: presentId,
    inAt: demoDayIso(1, "08:05:00"),
    outAt: demoDayIso(1, "17:00:00"),
    note: "ลงเวลาสาขา",
  });

  const leaveAnnual = await db.leaveType.upsert({
    where: {
      organizationId_code: { organizationId, code: `${prefix}ANNUAL` },
    },
    update: {},
    create: {
      organizationId,
      code: `${prefix}ANNUAL`,
      name: "ลาพักผ่อนประจำปี",
      unitId: dayUnitId,
      isPaid: true,
    },
  });
  const leaveSick = await db.leaveType.upsert({
    where: { organizationId_code: { organizationId, code: `${prefix}SICK` } },
    update: {},
    create: {
      organizationId,
      code: `${prefix}SICK`,
      name: "ลาป่วย",
      unitId: dayUnitId,
      isPaid: true,
    },
  });
  const leavePersonal = await db.leaveType.upsert({
    where: {
      organizationId_code: { organizationId, code: `${prefix}PERSONAL` },
    },
    update: {},
    create: {
      organizationId,
      code: `${prefix}PERSONAL`,
      name: "ลากิจ",
      unitId: dayUnitId,
      isPaid: true,
    },
  });

  const policyEffectiveFrom = new Date("2026-01-01T00:00:00Z");
  for (const [type, days, codeSuffix, label] of [
    [leaveAnnual, 10, "ANNUAL", "ลาพักผ่อนประจำปี"] as const,
    [leaveSick, 30, "SICK", "ลาป่วย"] as const,
    [leavePersonal, 3, "PERSONAL", "ลากิจ"] as const,
  ]) {
    await db.leavePolicy.upsert({
      where: {
        organizationId_code: {
          organizationId,
          code: `ENT_${prefix}${codeSuffix}`.slice(0, 40),
        },
      },
      update: {
        annualEntitlement: days,
        isActive: true,
        branchId: null,
        name: `${label} (องค์กร)`,
      },
      create: {
        organizationId,
        leaveTypeId: type.id,
        branchId: null,
        code: `ENT_${prefix}${codeSuffix}`.slice(0, 40),
        name: `${label} (องค์กร)`,
        annualEntitlement: days,
        effectiveFrom: policyEffectiveFrom,
        isActive: true,
      },
    });
  }

  const owner = byKey("owner");
  const staff1 = byKey("hq-staff-1");
  const suspended = byKey("b1-suspended");

  await db.employeeLeaveBalance.upsert({
    where: {
      employeeId_leaveTypeId_balanceYear: {
        employeeId: owner.id,
        leaveTypeId: leaveAnnual.id,
        balanceYear: 2026,
      },
    },
    update: { openingBalance: 10, usedBalance: 1, availableBalance: 9 },
    create: {
      employeeId: owner.id,
      leaveTypeId: leaveAnnual.id,
      balanceYear: 2026,
      openingBalance: 10,
      usedBalance: 1,
      availableBalance: 9,
    },
  });

  for (const [employee, type, days] of [
    [staff1, leaveAnnual, 10] as const,
    [staff1, leaveSick, 30] as const,
    [staff1, leavePersonal, 3] as const,
  ]) {
    await db.employeeLeaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_balanceYear: {
          employeeId: employee.id,
          leaveTypeId: type.id,
          balanceYear: 2026,
        },
      },
      update: {
        openingBalance: days,
        usedBalance: 0,
        availableBalance: days,
      },
      create: {
        employeeId: employee.id,
        leaveTypeId: type.id,
        balanceYear: 2026,
        openingBalance: days,
        usedBalance: 0,
        availableBalance: days,
      },
    });
  }

  let leaveApproved = await db.leaveRequest.findFirst({
    where: {
      employeeId: owner.id,
      reason: "ลาพักผ่อน (ทดสอบ)",
    },
  });
  if (!leaveApproved) {
    leaveApproved = await db.leaveRequest.create({
      data: {
        organizationId,
        employeeId: owner.id,
        leaveTypeId: leaveAnnual.id,
        statusId: approvedLeaveId,
        startDate: demoDay(10),
        endDate: demoDay(10),
        startUnitId: dayUnitId,
        endUnitId: dayUnitId,
        requestedAmount: 1,
        reason: "ลาพักผ่อน (ทดสอบ)",
        submittedAt: demoStart,
        reviewedAt: demoStart,
        reviewedByAuthUserId: actorId,
      },
    });
  }

  // Keep pending leave/OT on "today" so approval inbox + notification deep-links stay visible.
  const inboxToday = (() => {
    const label = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return new Date(`${label}T00:00:00.000Z`);
  })();
  let leaveSubmitted = await db.leaveRequest.findFirst({
    where: {
      employeeId: staff1.id,
      reason: "ลาป่วยรออนุมัติ (ทดสอบ)",
    },
  });
  if (!leaveSubmitted) {
    leaveSubmitted = await db.leaveRequest.create({
      data: {
        organizationId,
        employeeId: staff1.id,
        leaveTypeId: leaveSick.id,
        statusId: submittedLeaveId,
        startDate: inboxToday,
        endDate: inboxToday,
        startUnitId: dayUnitId,
        endUnitId: dayUnitId,
        requestedAmount: 1,
        reason: "ลาป่วยรออนุมัติ (ทดสอบ)",
        submittedAt: new Date(),
      },
    });
  } else {
    leaveSubmitted = await db.leaveRequest.update({
      where: { id: leaveSubmitted.id },
      data: {
        statusId: submittedLeaveId,
        startDate: inboxToday,
        endDate: inboxToday,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedByAuthUserId: null,
      },
    });
  }

  const otRule = await prisma.overtimeRule.findUnique({
    where: {
      organizationId_code: { organizationId, code: `${prefix}OT_NORMAL` },
    },
  });
  const existingOt = await db.overtimeRequest.findFirst({
    where: { employeeId: owner.id, reason: "OT อนุมัติแล้ว (ทดสอบ)" },
  });
  if (!existingOt) {
    await db.overtimeRequest.create({
      data: {
        organizationId,
        branchId: hqBranchId,
        employeeId: owner.id,
        overtimeRuleId: otRule?.id ?? null,
        statusId: approvedOtId,
        workDate: demoDay(1),
        startAt: new Date(demoDayIso(1, "17:00:00")),
        endAt: new Date(demoDayIso(1, "19:00:00")),
        requestedMinutes: 120,
        approvedMinutes: 120,
        reason: "OT อนุมัติแล้ว (ทดสอบ)",
        submittedAt: demoStart,
        reviewedAt: demoStart,
        reviewedByAuthUserId: actorId,
      },
    });
  }
  const pendingOt = await db.overtimeRequest.findFirst({
    where: { employeeId: suspended.id, reason: "OT รออนุมัติ (ทดสอบ)" },
  });
  const pendingOtStart = new Date(`${inboxToday.toISOString().slice(0, 10)}T17:00:00.000Z`);
  const pendingOtEnd = new Date(`${inboxToday.toISOString().slice(0, 10)}T20:00:00.000Z`);
  if (!pendingOt) {
    await db.overtimeRequest.create({
      data: {
        organizationId,
        branchId: branches.BRANCH01,
        employeeId: suspended.id,
        overtimeRuleId: otRule?.id ?? null,
        statusId: submittedOtId,
        workDate: inboxToday,
        startAt: pendingOtStart,
        endAt: pendingOtEnd,
        requestedMinutes: 180,
        reason: "OT รออนุมัติ (ทดสอบ)",
        submittedAt: new Date(),
      },
    });
  } else {
    await db.overtimeRequest.update({
      where: { id: pendingOt.id },
      data: {
        statusId: submittedOtId,
        workDate: inboxToday,
        startAt: pendingOtStart,
        endAt: pendingOtEnd,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedByAuthUserId: null,
        approvedMinutes: null,
      },
    });
  }

  const lateStaff = byKey("b1-staff-1");
  const lateDay = await db.attendanceDay.findUnique({
    where: {
      employeeId_workDate: {
        employeeId: lateStaff.id,
        workDate: demoDay(2),
      },
    },
  });
  const pendingAdjust = await db.attendanceAdjustment.findFirst({
    where: {
      employeeId: lateStaff.id,
      reason: "ขอปรับเวลาเข้า (ทดสอบ)",
    },
  });
  if (!pendingAdjust) {
    await db.attendanceAdjustment.create({
      data: {
        organizationId,
        employeeId: lateStaff.id,
        attendanceDayId: lateDay?.id ?? null,
        workDate: demoDay(2),
        requestedClockInAt: new Date(demoDayIso(2, "20:00:00")),
        requestedClockOutAt: new Date(demoDayIso(3, "05:00:00")),
        reason: "ขอปรับเวลาเข้า (ทดสอบ)",
        statusId: submittedLeaveId,
        requestedByAuthUserId: lateStaff.authUserId ?? actorId,
      },
    });
  }

  const { formatThaiDate: formatNotifThaiDate } = await import(
    "@/lib/hr/thai-date"
  );
  const leaveDateLabel = formatNotifThaiDate(inboxToday);
  const leaveNotifBody = `นภา สุขใจ ส่งคำขอลาป่วย 1 วัน · ${leaveDateLabel}`;
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
        branchId: hqBranchId,
        recipientAuthUserId: actorId,
        recipientEmployeeId: staff1.id,
        typeId: leaveNotifId,
        statusId: deliveredNotifId,
        title: "คำขอลาป่วยรออนุมัติ",
        body: leaveNotifBody,
        entityType: "LEAVE_REQUEST",
        entityId: leaveSubmitted.id,
        deliveredAt: new Date(),
      },
    });
  } else {
    await db.notification.update({
      where: { id: notifLeave.id },
      data: { body: leaveNotifBody, readAt: null },
    });
  }

  const pendingOtRow = await db.overtimeRequest.findFirst({
    where: { employeeId: suspended.id, reason: "OT รออนุมัติ (ทดสอบ)" },
  });
  if (pendingOtRow) {
    const notifOt = await db.notification.findFirst({
      where: {
        organizationId,
        entityType: "OVERTIME_REQUEST",
        entityId: pendingOtRow.id,
      },
    });
    const otNotifBody = `วราภรณ์ พักงาน ส่งคำขอ OT 3 ชั่วโมง · ${leaveDateLabel}`;
    if (!notifOt) {
      await db.notification.create({
        data: {
          organizationId,
          branchId: branches.BRANCH01,
          recipientAuthUserId: actorId,
          recipientEmployeeId: suspended.id,
          typeId: otNotifId,
          statusId: deliveredNotifId,
          title: "คำขอ OT รออนุมัติ",
          body: otNotifBody,
          entityType: "OVERTIME_REQUEST",
          entityId: pendingOtRow.id,
          deliveredAt: new Date(),
        },
      });
    } else {
      await db.notification.update({
        where: { id: notifOt.id },
        data: { body: otNotifBody, readAt: null },
      });
    }
  }

  // Phase 4: org tax/SSO rates (2B estimates) + approved run with issued payslips.
  const deductionRates = {
    taxEnabled: true,
    taxRatePercent: 3,
    socialSecurityEnabled: true,
    socialSecurityRatePercent: 5,
    socialSecurityMaxAmount: 750,
  };
  await prisma.$executeRaw`
    INSERT INTO hr.payroll_deduction_settings (
      id, organization_id, tax_enabled, tax_rate_percent,
      social_security_enabled, social_security_rate_percent,
      social_security_max_amount, updated_by_auth_user_id
    ) VALUES (
      gen_random_uuid(),
      ${organizationId}::uuid,
      ${deductionRates.taxEnabled},
      ${deductionRates.taxRatePercent},
      ${deductionRates.socialSecurityEnabled},
      ${deductionRates.socialSecurityRatePercent},
      ${deductionRates.socialSecurityMaxAmount},
      ${actorId}::uuid
    )
    ON CONFLICT (organization_id) DO UPDATE SET
      tax_enabled = EXCLUDED.tax_enabled,
      tax_rate_percent = EXCLUDED.tax_rate_percent,
      social_security_enabled = EXCLUDED.social_security_enabled,
      social_security_rate_percent = EXCLUDED.social_security_rate_percent,
      social_security_max_amount = EXCLUDED.social_security_max_amount,
      updated_by_auth_user_id = EXCLUDED.updated_by_auth_user_id,
      updated_at = CURRENT_TIMESTAMP
  `;

  const payPeriods = await db.payrollPeriod.findMany({
    where: { organizationId, payrollScheduleId: payrollSchedule.id },
    orderBy: { periodStart: "asc" },
  });
  const issuedPeriod = payPeriods[0];
  const draftPeriod = payPeriods[1] ?? payPeriods[0];

  if (issuedPeriod) {
    const run = await db.payrollRun.upsert({
      where: {
        payrollPeriodId_runNumber: {
          payrollPeriodId: issuedPeriod.id,
          runNumber: 1,
        },
      },
      update: {
        statusId: approvedStatusId,
        completedAt: demoStart,
        approvedAt: demoStart,
        approvedByAuthUserId: actorId,
      },
      create: {
        organizationId,
        payrollPeriodId: issuedPeriod.id,
        runNumber: 1,
        statusId: approvedStatusId,
        startedAt: demoStart,
        completedAt: demoStart,
        approvedAt: demoStart,
        approvedByAuthUserId: actorId,
        createdByAuthUserId: actorId,
      },
    });

    for (const person of LOGIN_TEST_ROSTER) {
      if (person.status === "RESIGNED") continue;
      const emp = byKey(person.key);
      const wageType = person.wageType === "DAILY" ? "DAILY" : "MONTHLY";
      // Showcase OT / late / absence on HQ sample rows (matches attendance + OT seed).
      const daily =
        wageType === "DAILY" ? person.amount : person.amount / 30;
      const extraEarnings =
        person.key === "owner"
          ? [
              {
                code: "OVERTIME",
                amount: Math.round(((daily / 8) * 2 * 1.5) * 100) / 100,
                description: "ค่าล่วงเวลา (120 นาที)",
              },
            ]
          : undefined;
      const extraDeductions =
        person.key === "hq-staff-1"
          ? [
              {
                code: "LATE",
                amount: Math.round((daily / 8 / 60) * 45 * 100) / 100,
                description: "หักสาย (45 นาที)",
              },
            ]
          : person.key === "hq-staff-2"
            ? [
                {
                  code: "ABSENCE",
                  amount: Math.round(daily * 100) / 100,
                  description: "หักขาดงาน (1 วัน)",
                },
              ]
            : undefined;
      // EMP-0005 shows higher tax showcase; others use org rates on full wage.
      const calc = calculatePayroll({
        wageType,
        wageAmount: person.amount,
        workedDays: wageType === "DAILY" ? 13 : undefined,
        earnings: extraEarnings,
        deductions: extraDeductions,
        deductionRates:
          person.key === "hq-staff-2"
            ? { ...deductionRates, taxRatePercent: 5 }
            : deductionRates,
      });
      const runEmp = await db.payrollRunEmployee.upsert({
        where: {
          payrollRunId_employeeId: { payrollRunId: run.id, employeeId: emp.id },
        },
        update: {
          grossEarnings: calc.gross,
          totalDeductions: calc.deductions,
          netPay: calc.net,
          overtimeMinutes: person.key === "owner" ? 120 : 0,
          statusId: reviewStatusId,
          calculatedAt: demoStart,
        },
        create: {
          payrollRunId: run.id,
          employeeId: emp.id,
          grossEarnings: calc.gross,
          totalDeductions: calc.deductions,
          netPay: calc.net,
          overtimeMinutes: person.key === "owner" ? 120 : 0,
          statusId: reviewStatusId,
          calculatedAt: demoStart,
        },
      });

      await db.payrollRunItem.deleteMany({
        where: { payrollRunEmployeeId: runEmp.id },
      });
      for (const line of calc.lines) {
        if (line.amount <= 0 && line.isLegalPlaceholder) continue;
        await db.payrollRunItem.create({
          data: {
            payrollRunEmployeeId: runEmp.id,
            earningTypeId:
              line.kind === "EARNING"
                ? line.code === "BASE_PAY"
                  ? baseSalaryId
                  : line.code === "OVERTIME"
                    ? overtimeEarnId
                    : null
                : null,
            deductionTypeId:
              line.code === "TAX"
                ? taxId
                : line.code === "SOCIAL_SECURITY"
                  ? ssoId
                  : line.code === "LATE"
                    ? lateDedId
                    : line.code === "ABSENCE"
                      ? absenceDedId
                      : null,
            sourceType: "LOGIN_TEST",
            description: line.description,
            amount: line.amount,
          },
        });
      }

      await db.payslip.upsert({
        where: { payrollRunEmployeeId: runEmp.id },
        update: {
          issuedAt: demoStart,
          issuedByAuthUserId: actorId,
          grossEarnings: calc.gross,
          totalDeductions: calc.deductions,
          netPay: calc.net,
          snapshot: {
            displayName: person.displayName,
            items: calc.lines,
            gross: calc.gross,
            deductions: calc.deductions,
            net: calc.net,
          },
        },
        create: {
          payrollRunEmployeeId: runEmp.id,
          employeeId: emp.id,
          issuedAt: demoStart,
          issuedByAuthUserId: actorId,
          grossEarnings: calc.gross,
          totalDeductions: calc.deductions,
          netPay: calc.net,
          snapshot: {
            displayName: person.displayName,
            items: calc.lines,
            gross: calc.gross,
            deductions: calc.deductions,
            net: calc.net,
          },
        },
      });
    }
  }

  if (draftPeriod && draftPeriod.id !== issuedPeriod?.id) {
    await db.payrollRun.upsert({
      where: {
        payrollPeriodId_runNumber: {
          payrollPeriodId: draftPeriod.id,
          runNumber: 1,
        },
      },
      update: { statusId: draftStatusId },
      create: {
        organizationId,
        payrollPeriodId: draftPeriod.id,
        runNumber: 1,
        statusId: draftStatusId,
        createdByAuthUserId: actorId,
      },
    });
  }

  // Advances: open installment plan (BRANCH01), deducted plan on issued run (HQ),
  // plus one SUBMITTED request for approval inbox.
  const advanceEmpB1 = byKey("b1-staff-1");
  const advanceEmpHq = byKey("hq-staff-1");
  const advanceEmpSubmit = byKey("hq-staff-2");
  const openPeriodId =
    issuedPeriod?.id ??
    (await db.payrollPeriod.findFirst({
      where: { organizationId },
      orderBy: { periodStart: "asc" },
      select: { id: true },
    }))?.id ??
    null;

  await prisma.$executeRaw`
    DELETE FROM hr.salary_advance_installments
    WHERE organization_id = ${organizationId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM hr.salary_advances
    WHERE organization_id = ${organizationId}::uuid
  `;

  if (openPeriodId) {
    const openAdvanceId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO hr.salary_advances (
        id, organization_id, employee_id, amount, advance_date, reason, status,
        installment_count, start_payroll_period_id, disbursement_mode,
        submitted_at, created_by_auth_user_id, approved_by_auth_user_id, approved_at
      ) VALUES (
        ${openAdvanceId}::uuid,
        ${organizationId}::uuid,
        ${advanceEmpB1.id}::uuid,
        1500,
        ${demoStart}::date,
        'เบิกฉุกเฉิน (ทดสอบ)',
        'APPROVED',
        2,
        ${openPeriodId}::uuid,
        'CASH_ALREADY',
        ${demoStart},
        ${actorId}::uuid,
        ${actorId}::uuid,
        ${demoStart}
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO hr.salary_advance_installments (
        id, organization_id, salary_advance_id, sequence, amount, payroll_period_id, status
      )
      SELECT
        gen_random_uuid(),
        ${organizationId}::uuid,
        ${openAdvanceId}::uuid,
        1,
        750,
        ${openPeriodId}::uuid,
        'PENDING'
    `;
    // Second installment: next period after start if present, else same period remainder stays on first only.
    const nextPeriod = await db.payrollPeriod.findFirst({
      where: {
        organizationId,
        periodStart: { gt: issuedPeriod?.periodStart ?? new Date(demoStart) },
      },
      orderBy: { periodStart: "asc" },
      select: { id: true },
    });
    if (nextPeriod) {
      await prisma.$executeRaw`
        INSERT INTO hr.salary_advance_installments (
          id, organization_id, salary_advance_id, sequence, amount, payroll_period_id, status
        ) VALUES (
          gen_random_uuid(),
          ${organizationId}::uuid,
          ${openAdvanceId}::uuid,
          2,
          750,
          ${nextPeriod.id}::uuid,
          'PENDING'
        )
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE hr.salary_advances
        SET installment_count = 1, amount = 1500
        WHERE id = ${openAdvanceId}::uuid
      `;
      await prisma.$executeRaw`
        UPDATE hr.salary_advance_installments
        SET amount = 1500
        WHERE salary_advance_id = ${openAdvanceId}::uuid AND sequence = 1
      `;
    }

    const submittedId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO hr.salary_advances (
        id, organization_id, employee_id, amount, advance_date, reason, status,
        installment_count, start_payroll_period_id, disbursement_mode,
        submitted_at, created_by_auth_user_id
      ) VALUES (
        ${submittedId}::uuid,
        ${organizationId}::uuid,
        ${advanceEmpSubmit.id}::uuid,
        3000,
        ${demoStart}::date,
        'ขอเบิกเพื่ออนุมัติ (ทดสอบ)',
        'SUBMITTED',
        3,
        ${openPeriodId}::uuid,
        'WITH_SALARY',
        ${demoStart},
        ${actorId}::uuid
      )
    `;
    const notifAdvance = await db.notification.findFirst({
      where: {
        organizationId,
        entityType: "SALARY_ADVANCE",
        entityId: submittedId,
      },
    });
    if (!notifAdvance) {
      await db.notification.create({
        data: {
          organizationId,
          branchId: advanceEmpSubmit.branchId,
          recipientAuthUserId: actorId,
          recipientEmployeeId: advanceEmpSubmit.id,
          typeId: advanceNotifId,
          statusId: deliveredNotifId,
          title: "คำขอเบิกล่วงหน้ารออนุมัติ",
          body: `จิราภรณ์ ใหม่งาน ขอเบิก 3,000 บาท · ${demoStart.toISOString().slice(0, 10)}`,
          entityType: "SALARY_ADVANCE",
          entityId: submittedId,
          deliveredAt: new Date(),
        },
      });
    }
  }

  if (issuedPeriod) {
    const issuedRun = await db.payrollRun.findFirst({
      where: { payrollPeriodId: issuedPeriod.id, runNumber: 1 },
    });
    if (issuedRun) {
      const deductedAdvanceId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO hr.salary_advances (
          id, organization_id, employee_id, amount, advance_date, reason, status,
          installment_count, start_payroll_period_id, disbursement_mode,
          deducted_payroll_run_id, deducted_at, submitted_at,
          created_by_auth_user_id, approved_by_auth_user_id, approved_at
        ) VALUES (
          ${deductedAdvanceId}::uuid,
          ${organizationId}::uuid,
          ${advanceEmpHq.id}::uuid,
          2000,
          ${demoStart}::date,
          'เบิกค่าใช้จ่าย (ทดสอบ)',
          'DEDUCTED',
          1,
          ${issuedPeriod.id}::uuid,
          'CASH_ALREADY',
          ${issuedRun.id}::uuid,
          ${demoStart},
          ${demoStart},
          ${actorId}::uuid,
          ${actorId}::uuid,
          ${demoStart}
        )
      `;
      await prisma.$executeRaw`
        INSERT INTO hr.salary_advance_installments (
          id, organization_id, salary_advance_id, sequence, amount,
          payroll_period_id, status, deducted_payroll_run_id, deducted_at
        ) VALUES (
          gen_random_uuid(),
          ${organizationId}::uuid,
          ${deductedAdvanceId}::uuid,
          1,
          2000,
          ${issuedPeriod.id}::uuid,
          'DEDUCTED',
          ${issuedRun.id}::uuid,
          ${demoStart}
        )
      `;
      // Reflect deducted advance on นภา's issued run line if missing.
      const napaRunEmp = await db.payrollRunEmployee.findFirst({
        where: { payrollRunId: issuedRun.id, employeeId: advanceEmpHq.id },
      });
      if (napaRunEmp) {
        const existingAdv = await db.payrollRunItem.findFirst({
          where: {
            payrollRunEmployeeId: napaRunEmp.id,
            sourceType: "LOGIN_TEST_ADVANCE",
          },
        });
        if (!existingAdv) {
          const advanceTypeId = await requireMasterId(
            prisma,
            "deductionType",
            "ADVANCE",
          ).catch(() =>
            requireMasterId(prisma, "deductionType", "LOAN"),
          );
          await db.payrollRunItem.create({
            data: {
              payrollRunEmployeeId: napaRunEmp.id,
              deductionTypeId: advanceTypeId,
              sourceType: "LOGIN_TEST_ADVANCE",
              description: "หักเบิกล่วงหน้า",
              amount: 2000,
            },
          });
          const newDed = Number(napaRunEmp.totalDeductions) + 2000;
          const newNet = Number(napaRunEmp.grossEarnings) - newDed;
          await db.payrollRunEmployee.update({
            where: { id: napaRunEmp.id },
            data: { totalDeductions: newDed, netPay: newNet },
          });
          await db.payslip.updateMany({
            where: { payrollRunEmployeeId: napaRunEmp.id },
            data: { totalDeductions: newDed, netPay: newNet },
          });
        }
      }
    }
  }

  await prisma.demoSeedMarker.upsert({
    where: {
      organizationId_markerKey: {
        organizationId,
        markerKey: LOGIN_TEST_MARKER_KEY,
      },
    },
    update: {},
    create: { organizationId, markerKey: LOGIN_TEST_MARKER_KEY },
  });

  return {
    organizationId,
    employees: employees.length,
    password: LOGIN_TEST_PASSWORD,
    roster: LOGIN_TEST_ROSTER.map((p) => ({
      employeeCode: p.employeeCode,
      email: p.email,
      displayName: p.displayName,
      branchCode: p.branchCode,
      scenario: p.scenario,
    })),
  };
}

export async function cleanupLoginTestHr(
  prisma: PrismaClient,
  options: { dryRun?: boolean } = {},
): Promise<{ dryRun: boolean; deleted: boolean; employees: number }> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("login-test HR cleanup forbidden in production");
  }

  const ctx = await resolveLoginTestPlatformContext(prisma).catch(() => null);
  if (!ctx) {
    return { dryRun: Boolean(options.dryRun), deleted: false, employees: 0 };
  }

  const organizationId = ctx.organizationId;
  const employeeFilter = {
    organizationId,
    employeeCode: { startsWith: LOGIN_TEST_EMPLOYEE_PREFIX },
  };
  const prefixed = {
    organizationId,
    code: { startsWith: LOGIN_TEST_PREFIX },
  };
  const employees = await prisma.employee.count({ where: employeeFilter });

  if (options.dryRun) {
    return { dryRun: true, deleted: false, employees };
  }

  const db = prisma as any;
  await db.notification.deleteMany({
    where: { organizationId, recipientEmployee: employeeFilter },
  });
  await db.payslip.deleteMany({
    where: {
      payrollRunEmployee: {
        payrollRun: {
          payrollPeriod: {
            payrollSchedule: { code: { startsWith: LOGIN_TEST_PREFIX } },
          },
        },
      },
    },
  });
  await db.payrollRun.deleteMany({
    where: {
      payrollPeriod: {
        organizationId,
        payrollSchedule: { code: { startsWith: LOGIN_TEST_PREFIX } },
      },
    },
  });
  await prisma.$executeRaw`
    DELETE FROM hr.salary_advance_installments
    WHERE organization_id = ${organizationId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM hr.salary_advances
    WHERE organization_id = ${organizationId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM hr.payroll_deduction_settings
    WHERE organization_id = ${organizationId}::uuid
  `;
  await db.leaveBalanceTransaction.deleteMany({
    where: { employeeLeaveBalance: { employee: employeeFilter } },
  });
  await db.employeeLeaveBalance.deleteMany({
    where: { employee: employeeFilter },
  });
  await db.leaveRequest.deleteMany({ where: { employee: employeeFilter } });
  await db.overtimeRequest.deleteMany({ where: { employee: employeeFilter } });
  if (db.shiftMismatchRequest?.deleteMany) {
    await db.shiftMismatchRequest.deleteMany({
      where: { employee: employeeFilter },
    });
  }
  await db.attendanceAdjustment.deleteMany({
    where: { employee: employeeFilter },
  });
  await db.attendanceEvent.deleteMany({ where: { employee: employeeFilter } });
  await db.attendanceDay.deleteMany({ where: { employee: employeeFilter } });
  await db.shiftAssignment.deleteMany({
    where: { schedulePeriod: prefixed },
  });
  await db.schedulePeriod.deleteMany({ where: prefixed });
  await db.employeeRecurringPayItem.deleteMany({
    where: { employee: employeeFilter },
  });
  await prisma.employee.deleteMany({ where: employeeFilter });
  await db.leavePolicy.deleteMany({ where: prefixed });
  await db.leaveType.deleteMany({ where: prefixed });
  await db.holiday.deleteMany({
    where: { workCalendar: prefixed },
  });
  await db.workCalendar.deleteMany({ where: prefixed });
  await prisma.payrollSchedule.deleteMany({ where: prefixed });
  await prisma.overtimeRule.deleteMany({ where: prefixed });
  await prisma.shift.deleteMany({ where: prefixed });
  await prisma.workLocation.deleteMany({ where: prefixed });
  await prisma.position.deleteMany({ where: prefixed });
  await prisma.department.deleteMany({ where: prefixed });
  await prisma.demoSeedMarker.deleteMany({
    where: { organizationId, markerKey: LOGIN_TEST_MARKER_KEY },
  });

  return { dryRun: false, deleted: true, employees };
}
