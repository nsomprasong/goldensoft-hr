/**
 * HR side of the login-test tenant (แพลูกแพรว).
 *
 * Requires Platform `npm run seed:login-test` first (org + Auth users).
 * Creates employees linked to those users (password 12345678) plus ops fixtures.
 *
 * See docs/HR_LOGIN_TEST_DATASET.md
 */
import type { PrismaClient } from "@prisma/client";

import { saveDemoAvatarSvg } from "@/lib/hr/employee-photos";
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
    });
  }

  const byKey = (key: string) => {
    const row = employees.find((e) => e.key === key);
    if (!row) throw new Error(`employee ${key} missing`);
    return row;
  };

  const demoStart = new Date("2026-06-01T00:00:00Z");
  const demoEnd = new Date("2026-06-16T00:00:00Z");
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
    taxId,
    ssoId,
    leaveNotifId,
    otNotifId,
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
    requireMasterId(prisma, "deductionType", "TAX"),
    requireMasterId(prisma, "deductionType", "SOCIAL_SECURITY"),
    requireMasterId(prisma, "notificationType", "LEAVE_SUBMITTED"),
    requireMasterId(prisma, "notificationType", "OT_SUBMITTED"),
    requireMasterId(prisma, "notificationStatus", "PENDING"),
  ]);

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
        holidayDate: new Date("2026-06-03T00:00:00Z"),
        name: "วันหยุดตัวอย่าง",
      },
    },
    update: {},
    create: {
      organizationId,
      branchId: hqBranchId,
      workCalendarId: calendar.id,
      holidayTypeId: publicHolidayId,
      holidayDate: new Date("2026-06-03T00:00:00Z"),
      name: "วันหยุดตัวอย่าง",
      isPaid: true,
    },
  });
  const schedulePeriod = await db.schedulePeriod.upsert({
    where: {
      organizationId_code: { organizationId, code: `${prefix}20260601_16` },
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
      code: `${prefix}20260601_16`,
      name: "ตารางงาน 1–16 มิถุนายน 2569",
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
    await db.employeeWorkLocation.upsert({
      where: {
        employeeId_workLocationId_effectiveFrom: {
          employeeId: emp.id,
          workLocationId: location.id,
          effectiveFrom: demoStart,
        },
      },
      update: { isPrimary: true },
      create: {
        employeeId: emp.id,
        workLocationId: location.id,
        effectiveFrom: demoStart,
        isPrimary: true,
      },
    });
    for (let day = 1; day <= 10; day += 1) {
      const workDate = new Date(
        `2026-06-${String(day).padStart(2, "0")}T00:00:00Z`,
      );
      await db.shiftAssignment.upsert({
        where: {
          employeeId_workDate_sequenceNo: {
            employeeId: emp.id,
            workDate,
            sequenceNo: 1,
          },
        },
        update: {
          schedulePeriodId: schedulePeriod.id,
          shiftId: shift.id,
          workLocationId: location.id,
        },
        create: {
          schedulePeriodId: schedulePeriod.id,
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
    const workDate = new Date(
      `2026-06-${String(input.day).padStart(2, "0")}T00:00:00Z`,
    );
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
        schedulePeriodId: schedulePeriod.id,
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
    inAt: "2026-06-01T08:00:00Z",
    outAt: "2026-06-01T17:00:00Z",
    note: "มาตรงเวลา",
  });
  await upsertAttendance({
    key: "b1-staff-1",
    day: 2,
    statusId: lateId,
    inAt: "2026-06-02T20:20:00Z",
    outAt: "2026-06-03T05:00:00Z",
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
    inAt: "2026-06-01T08:05:00Z",
    outAt: "2026-06-01T17:00:00Z",
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
      startDate: new Date("2026-06-10T00:00:00Z"),
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
        startDate: new Date("2026-06-10T00:00:00Z"),
        endDate: new Date("2026-06-10T00:00:00Z"),
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
        startDate: new Date("2026-06-12T00:00:00Z"),
        endDate: new Date("2026-06-12T00:00:00Z"),
        startUnitId: dayUnitId,
        endUnitId: dayUnitId,
        requestedAmount: 1,
        reason: "ลาป่วยรออนุมัติ (ทดสอบ)",
        submittedAt: demoStart,
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
        workDate: new Date("2026-06-01T00:00:00Z"),
        startAt: new Date("2026-06-01T17:00:00Z"),
        endAt: new Date("2026-06-01T19:00:00Z"),
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
  if (!pendingOt) {
    await db.overtimeRequest.create({
      data: {
        organizationId,
        branchId: branches.BRANCH01,
        employeeId: suspended.id,
        overtimeRuleId: otRule?.id ?? null,
        statusId: submittedOtId,
        workDate: new Date("2026-06-08T00:00:00Z"),
        startAt: new Date("2026-06-08T17:00:00Z"),
        endAt: new Date("2026-06-08T20:00:00Z"),
        requestedMinutes: 180,
        reason: "OT รออนุมัติ (ทดสอบ)",
        submittedAt: demoStart,
      },
    });
  }

  const lateStaff = byKey("b1-staff-1");
  const lateDay = await db.attendanceDay.findUnique({
    where: {
      employeeId_workDate: {
        employeeId: lateStaff.id,
        workDate: new Date("2026-06-02T00:00:00Z"),
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
        workDate: new Date("2026-06-02T00:00:00Z"),
        requestedClockInAt: new Date("2026-06-02T20:00:00Z"),
        requestedClockOutAt: new Date("2026-06-03T05:00:00Z"),
        reason: "ขอปรับเวลาเข้า (ทดสอบ)",
        statusId: submittedLeaveId,
        requestedByAuthUserId: lateStaff.authUserId ?? actorId,
      },
    });
  }

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
        statusId: pendingNotifId,
        title: "คำขอลาป่วยรออนุมัติ",
        body: "นภา สุขใจ ส่งคำขอลาป่วย 1 วัน",
        entityType: "LEAVE_REQUEST",
        entityId: leaveSubmitted.id,
      },
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
    if (!notifOt) {
      await db.notification.create({
        data: {
          organizationId,
          branchId: branches.BRANCH01,
          recipientAuthUserId: actorId,
          recipientEmployeeId: suspended.id,
          typeId: otNotifId,
          statusId: pendingNotifId,
          title: "คำขอ OT รออนุมัติ",
          body: "วราภรณ์ พักงาน ส่งคำขอ OT 3 ชั่วโมง",
          entityType: "OVERTIME_REQUEST",
          entityId: pendingOtRow.id,
        },
      });
    }
  }

  const payPeriod = await db.payrollPeriod.findFirst({
    where: { organizationId, payrollScheduleId: payrollSchedule.id },
    orderBy: { periodStart: "asc" },
  });
  if (payPeriod) {
    const run = await db.payrollRun.upsert({
      where: {
        payrollPeriodId_runNumber: {
          payrollPeriodId: payPeriod.id,
          runNumber: 1,
        },
      },
      update: {},
      create: {
        organizationId,
        payrollPeriodId: payPeriod.id,
        runNumber: 1,
        statusId: draftStatusId,
        createdByAuthUserId: actorId,
      },
    });
    for (const person of LOGIN_TEST_ROSTER) {
      if (person.status === "RESIGNED") continue;
      const emp = byKey(person.key);
      const tax = person.key === "hq-staff-2" ? 1_200 : 0;
      const sso = person.key === "hq-staff-2" ? 750 : 0;
      const gross = person.amount;
      const net = gross - tax - sso;
      const runEmp = await db.payrollRunEmployee.upsert({
        where: {
          payrollRunId_employeeId: { payrollRunId: run.id, employeeId: emp.id },
        },
        update: {
          grossEarnings: gross,
          totalDeductions: tax + sso,
          netPay: net,
        },
        create: {
          payrollRunId: run.id,
          employeeId: emp.id,
          grossEarnings: gross,
          totalDeductions: tax + sso,
          netPay: net,
          statusId: draftStatusId,
          calculatedAt: demoStart,
        },
      });
      const earn = await db.payrollRunItem.findFirst({
        where: {
          payrollRunEmployeeId: runEmp.id,
          sourceType: "LOGIN_TEST_EARN",
        },
      });
      if (!earn) {
        await db.payrollRunItem.create({
          data: {
            payrollRunEmployeeId: runEmp.id,
            earningTypeId: baseSalaryId,
            sourceType: "LOGIN_TEST_EARN",
            description: "ค่าจ้าง",
            quantity: 1,
            rate: gross,
            amount: gross,
          },
        });
      }
      if (tax > 0) {
        const taxLine = await db.payrollRunItem.findFirst({
          where: {
            payrollRunEmployeeId: runEmp.id,
            sourceType: "LOGIN_TEST_TAX",
          },
        });
        if (!taxLine) {
          await db.payrollRunItem.create({
            data: {
              payrollRunEmployeeId: runEmp.id,
              deductionTypeId: taxId,
              sourceType: "LOGIN_TEST_TAX",
              description: "หักภาษี",
              amount: tax,
            },
          });
        }
      }
      if (sso > 0) {
        const ssoLine = await db.payrollRunItem.findFirst({
          where: {
            payrollRunEmployeeId: runEmp.id,
            sourceType: "LOGIN_TEST_SSO",
          },
        });
        if (!ssoLine) {
          await db.payrollRunItem.create({
            data: {
              payrollRunEmployeeId: runEmp.id,
              deductionTypeId: ssoId,
              sourceType: "LOGIN_TEST_SSO",
              description: "หักประกันสังคม",
              amount: sso,
            },
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
