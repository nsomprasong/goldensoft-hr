/**
 * HR side of the full-QA suite (อัลฟ่า / เบต้า).
 *
 * Prerequisite: goldensoft-platform `npm run seed:full-qa`
 * Attendance window: 2026-06-01 .. 2026-07-31 (พ.ศ. 1/06/2569–31/07/2569)
 * Password: 11111111
 *
 * Roster must stay in sync with platform full-qa-dataset.ts
 */
import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { saveDemoAvatarSvg } from "@/lib/hr/employee-photos";
import { generateSemimonthlyPeriods } from "@/lib/hr/payroll-rules";

export const FULL_QA_ORG_CODES = ["TEST-ALPHA", "TEST-BETA"] as const;
export const FULL_QA_PREFIX = "FQA_";
export const FULL_QA_EMPLOYEE_PREFIXES = ["A", "B"] as const;
export const FULL_QA_MARKER_KEY = "full-qa-hr";
export const FULL_QA_PASSWORD = "11111111";
export const FULL_QA_PERIOD_START = "2026-06-01";
export const FULL_QA_PERIOD_END = "2026-07-31";

export type FullQaFixture =
  | "normal"
  | "late"
  | "absent"
  | "leave"
  | "advance"
  | "night"
  | "viewer";

export type FullQaHrPerson = {
  key: string;
  orgCode: (typeof FULL_QA_ORG_CODES)[number];
  employeeCode: string;
  email: string;
  phone: string;
  firstNameTh: string;
  lastNameTh: string;
  displayName: string;
  homeBranch: "HQ" | "B2";
  positionCode: string;
  wageType: "MONTHLY" | "DAILY";
  amount: number;
  shift: "DAY" | "NIGHT";
  fixture: FullQaFixture;
  scenario: string;
  hue: number;
};

/** Mirrors Platform FULL_QA_ROSTER (emails / codes / names). */
export const FULL_QA_ROSTER: readonly FullQaHrPerson[] = (() => {
  const alphaNames: Array<[string, string]> = [
    ["สมชาย", "ใจดี"],
    ["สมหญิง", "รักงาน"],
    ["วิชัย", "ขยันงาน"],
    ["นภา", "สุขใจ"],
    ["ประยุทธ์", "มั่นคง"],
    ["ศิริพร", "ยิ้มแย้ม"],
    ["อนุชา", "ตรงเวลา"],
    ["จิราภรณ์", "พัฒนา"],
    ["ธนา", "รุ่งเรือง"],
    ["วราภรณ์", "เพียรดี"],
    ["เมธา", "สุจริต"],
    ["ปิยะ", "ก้าวหน้า"],
    ["กมล", "ตั้งใจ"],
    ["รัตนา", "สดใส"],
    ["ชัยวัฒน์", "อดทน"],
    ["อรุณี", "ใจเย็น"],
    ["พิมพ์ใจ", "รักดี"],
    ["ณัฐพล", "ขยัน"],
    ["สุภาพร", "มั่นใจ"],
    ["เกรียงไกร", "องอาจ"],
  ];

  function build(
    orgCode: (typeof FULL_QA_ORG_CODES)[number],
    prefix: "a" | "b",
    letter: "A" | "B",
    phoneBase: number,
  ): FullQaHrPerson[] {
    const phone = (n: number) => String(phoneBase + n - 1).padStart(10, "0");
    const name = (i: number) => alphaNames[(i - 1) % alphaNames.length]!;
    const emp = (seq: number) => `${letter}${String(seq).padStart(2, "0")}`;
    const person = (
      seq: number,
      keySuffix: string,
      emailLocal: string,
      homeBranch: "HQ" | "B2",
      positionCode: string,
      fixture: FullQaFixture,
      scenario: string,
      extras: Partial<Pick<FullQaHrPerson, "wageType" | "amount" | "shift">> = {},
    ): FullQaHrPerson => {
      const [firstNameTh, lastNameTh] = name(seq);
      return {
        key: `${prefix}-${keySuffix}`,
        orgCode,
        employeeCode: emp(seq),
        email: `${emailLocal}@ex.com`,
        phone: phone(seq),
        firstNameTh,
        lastNameTh,
        displayName: `${firstNameTh} ${lastNameTh}`,
        homeBranch,
        positionCode,
        wageType: extras.wageType ?? "MONTHLY",
        amount: extras.amount ?? (homeBranch === "HQ" ? 22_000 + seq * 500 : 18_000 + seq * 400),
        shift: extras.shift ?? "DAY",
        fixture,
        scenario,
        hue: (seq * 37) % 360,
      };
    };

    return [
      person(1, "owner", `${prefix}.owner`, "HQ", "OWNER", "normal", "เจ้าขององค์กร"),
      person(2, "admin", `${prefix}.admin`, "HQ", "ORG_ADMIN", "normal", "ผู้ดูแลระบบองค์กร"),
      person(3, "hq-mgr", `${prefix}.hq.mgr`, "HQ", "BR_MGR", "normal", "ผู้ดูแลระบบประจำสาขา HQ"),
      person(4, "hq-view", `${prefix}.hq.view`, "HQ", "BR_VIEW", "viewer", "ผู้ดูระบบประจำสาขา HQ"),
      person(5, "hq-e5", `${prefix}.hq.e5`, "HQ", "SUPERVISOR", "late", "หัวหน้างาน — มาสาย"),
      person(6, "hq-e6", `${prefix}.hq.e6`, "HQ", "HR_STAFF", "leave", "เจ้าหน้าที่บุคคล — ลา"),
      person(7, "hq-e7", `${prefix}.hq.e7`, "HQ", "ACCOUNTANT", "absent", "บัญชี — ขาดงาน"),
      person(8, "hq-e8", `${prefix}.hq.e8`, "HQ", "STAFF", "advance", "พนักงาน — เบิกล่วงหน้า"),
      person(9, "hq-e9", `${prefix}.hq.e9`, "HQ", "CASHIER", "normal", "แคชเชียร์"),
      person(10, "hq-e10", `${prefix}.hq.e10`, "HQ", "STAFF", "normal", "พนักงาน HQ"),
      person(11, "b2-mgr", `${prefix}.b2.mgr`, "B2", "BR_MGR", "normal", "ผู้ดูแลระบบประจำสาขา B2"),
      person(12, "b2-view", `${prefix}.b2.view`, "B2", "BR_VIEW", "viewer", "ผู้ดูระบบประจำสาขา B2"),
      person(13, "b2-e13", `${prefix}.b2.e13`, "B2", "SUPERVISOR", "late", "หัวหน้างานสาขา — มาสาย"),
      person(14, "b2-e14", `${prefix}.b2.e14`, "B2", "DRIVER", "night", "พนักงานขับรถ — กะกลางคืน", {
        wageType: "DAILY",
        amount: 850,
        shift: "NIGHT",
      }),
      person(15, "b2-e15", `${prefix}.b2.e15`, "B2", "STAFF", "absent", "พนักงานสาขา — ขาดงาน"),
      person(16, "b2-e16", `${prefix}.b2.e16`, "B2", "STAFF", "leave", "พนักงานสาขา — ลา"),
      person(17, "b2-e17", `${prefix}.b2.e17`, "B2", "CASHIER", "advance", "แคชเชียร์ — เบิกล่วงหน้า"),
      person(18, "b2-e18", `${prefix}.b2.e18`, "B2", "STAFF", "normal", "พนักงานสาขา"),
      person(19, "b2-e19", `${prefix}.b2.e19`, "B2", "STAFF", "normal", "พนักงานสาขา"),
      person(20, "b2-e20", `${prefix}.b2.e20`, "B2", "STAFF", "normal", "พนักงานสาขา"),
    ];
  }

  return [
    ...build("TEST-ALPHA", "a", "A", 810_000_001),
    ...build("TEST-BETA", "b", "B", 820_000_001),
  ];
})();

const POSITION_DEFS: Array<{ code: string; nameTh: string; nameEn: string; dept: "OPS" | "HR" | "FIN" }> = [
  { code: "OWNER", nameTh: "เจ้าของกิจการ", nameEn: "Owner", dept: "OPS" },
  { code: "ORG_ADMIN", nameTh: "ผู้ดูแลระบบองค์กร", nameEn: "Org Admin", dept: "HR" },
  { code: "BR_MGR", nameTh: "ผู้จัดการสาขา", nameEn: "Branch Manager", dept: "OPS" },
  { code: "BR_VIEW", nameTh: "ผู้ดูระบบสาขา", nameEn: "Branch Viewer", dept: "OPS" },
  { code: "SUPERVISOR", nameTh: "หัวหน้างาน", nameEn: "Supervisor", dept: "OPS" },
  { code: "HR_STAFF", nameTh: "เจ้าหน้าที่บุคคล", nameEn: "HR Staff", dept: "HR" },
  { code: "ACCOUNTANT", nameTh: "พนักงานบัญชี", nameEn: "Accountant", dept: "FIN" },
  { code: "CASHIER", nameTh: "แคชเชียร์", nameEn: "Cashier", dept: "FIN" },
  { code: "DRIVER", nameTh: "พนักงานขับรถ", nameEn: "Driver", dept: "OPS" },
  { code: "STAFF", nameTh: "พนักงานทั่วไป", nameEn: "Staff", dept: "OPS" },
];

type PlatformOrgContext = {
  organizationId: string;
  orgCode: string;
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

function eachDateInclusive(startIso: string, endIso: string): Date[] {
  const out: Date[] = [];
  const cur = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  while (cur <= end) {
    out.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function isWeekday(d: Date): boolean {
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  return day >= 1 && day <= 5;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Wall-clock time in Asia/Bangkok (matches UI formatClockTime). */
function clockAt(d: Date, hm: string): Date {
  return new Date(`${isoDate(d)}T${hm}+07:00`);
}

/** Deterministic day outcome for rule testing. */
function dayOutcome(
  fixture: FullQaFixture,
  d: Date,
): "PRESENT" | "LATE" | "ABSENT" | "LEAVE" | "REST" {
  if (!isWeekday(d)) return "REST";
  const dom = d.getUTCDate();
  const month = d.getUTCMonth() + 1;

  if (fixture === "late") {
    if (dom % 3 === 0) return "LATE";
    if (dom === 15) return "ABSENT";
    return "PRESENT";
  }
  if (fixture === "absent") {
    if (dom === 5 || dom === 19 || (month === 7 && dom === 8)) return "ABSENT";
    if (dom === 12) return "LATE";
    return "PRESENT";
  }
  if (fixture === "leave") {
    if (dom === 10 || dom === 11 || (month === 7 && dom === 3)) return "LEAVE";
    if (dom === 22) return "LATE";
    return "PRESENT";
  }
  if (fixture === "night") {
    if (dom % 4 === 0) return "LATE";
    if (dom === 17) return "ABSENT";
    return "PRESENT";
  }
  if (fixture === "advance") {
    if (dom === 9) return "LATE";
    if (dom === 24) return "ABSENT";
    return "PRESENT";
  }
  // normal / viewer — mostly present, light noise
  if (dom === 6 && month === 6) return "LATE";
  if (dom === 28 && month === 7) return "ABSENT";
  return "PRESENT";
}

export async function resolveFullQaPlatformContexts(
  prisma: PrismaClient,
): Promise<PlatformOrgContext[]> {
  const contexts: PlatformOrgContext[] = [];
  for (const orgCode of FULL_QA_ORG_CODES) {
    const orgs = await prisma.$queryRaw<
      Array<{ id: string; customer_code: string }>
    >`
      SELECT id::text AS id, customer_code
      FROM platform.organizations
      WHERE customer_code = ${orgCode}
        AND deleted_at IS NULL
      LIMIT 1
    `;
    const org = orgs[0];
    if (!org) {
      throw new Error(
        `ไม่พบองค์กร ${orgCode} — รันที่ goldensoft-platform: npm run seed:full-qa ก่อน`,
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
    if (!branches.HQ || !branches.B2) {
      throw new Error(`${orgCode} ต้องมีสาขา HQ และ B2`);
    }

    const roster = FULL_QA_ROSTER.filter((r) => r.orgCode === orgCode);
    const emailSet = new Set(roster.map((r) => r.email.toLowerCase()));
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

    const users: PlatformOrgContext["users"] = {};
    for (const row of userRows) {
      if (!emailSet.has(row.email)) continue;
      users[row.email] = {
        platformUserId: row.platform_user_id,
        authUserId: row.auth_user_id,
        email: row.email,
      };
    }
    for (const person of roster) {
      if (!users[person.email.toLowerCase()]) {
        throw new Error(
          `ไม่พบบัญชี ${person.email} — รัน seed:full-qa ที่ Platform ใหม่`,
        );
      }
    }

    contexts.push({
      organizationId: org.id,
      orgCode,
      branches,
      users,
    });
  }
  return contexts;
}

async function seedOneOrgHr(
  prisma: PrismaClient,
  ctx: PlatformOrgContext,
): Promise<{ employees: number; attendanceDays: number; leaves: number; advances: number }> {
  const db = prisma as any;
  const { organizationId, branches } = ctx;
  const roster = FULL_QA_ROSTER.filter((r) => r.orgCode === ctx.orgCode);
  const actorId = ctx.users[roster[0]!.email.toLowerCase()]!.authUserId;
  const prefix = FULL_QA_PREFIX;
  const periodStart = new Date(`${FULL_QA_PERIOD_START}T00:00:00Z`);
  const periodEnd = new Date(`${FULL_QA_PERIOD_END}T00:00:00Z`);
  const allDates = eachDateInclusive(FULL_QA_PERIOD_START, FULL_QA_PERIOD_END);

  const [
    employmentMonthlyId,
    employmentDailyId,
    statusActiveId,
    shiftTypeId,
    nightShiftTypeId,
    payFrequencyId,
    overtimeRateTypeId,
    draftStatusId,
    publishedScheduleStatusId,
    publicHolidayId,
    dayUnitId,
    approvedLeaveId,
    submittedLeaveId,
    presentId,
    lateId,
    absentId,
    leaveAttId,
    restDayId,
    clockInId,
    clockOutId,
  ] = await Promise.all([
    requireMasterId(prisma, "employmentType", "MONTHLY"),
    requireMasterId(prisma, "employmentType", "DAILY"),
    requireMasterId(prisma, "employeeStatus", "ACTIVE"),
    requireMasterId(prisma, "shiftType", "REGULAR"),
    requireMasterId(prisma, "shiftType", "NIGHT"),
    requireMasterId(prisma, "payFrequency", "SEMIMONTHLY"),
    requireMasterId(prisma, "overtimeRateType", "NORMAL_DAY"),
    requireMasterId(prisma, "payrollPeriodStatus", "DRAFT"),
    requireMasterId(prisma, "schedulePeriodStatus", "PUBLISHED"),
    requireMasterId(prisma, "holidayType", "PUBLIC"),
    requireMasterId(prisma, "leaveUnit", "DAY"),
    requireMasterId(prisma, "leaveRequestStatus", "APPROVED"),
    requireMasterId(prisma, "leaveRequestStatus", "SUBMITTED"),
    requireMasterId(prisma, "attendanceStatus", "PRESENT"),
    requireMasterId(prisma, "attendanceStatus", "LATE"),
    requireMasterId(prisma, "attendanceStatus", "ABSENT"),
    requireMasterId(prisma, "attendanceStatus", "LEAVE"),
    requireMasterId(prisma, "attendanceStatus", "REST_DAY"),
    requireMasterId(prisma, "attendanceEventType", "CLOCK_IN"),
    requireMasterId(prisma, "attendanceEventType", "CLOCK_OUT"),
  ]);

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
  const deptFin = await prisma.department.upsert({
    where: { organizationId_code: { organizationId, code: `${prefix}FIN` } },
    update: {},
    create: {
      organizationId,
      code: `${prefix}FIN`,
      nameTh: "ฝ่ายการเงิน",
      nameEn: "Finance",
    },
  });
  const deptId = { OPS: deptOps.id, HR: deptHr.id, FIN: deptFin.id };

  const positionIds: Record<string, string> = {};
  for (const def of POSITION_DEFS) {
    const row = await prisma.position.upsert({
      where: {
        organizationId_code: { organizationId, code: `${prefix}${def.code}` },
      },
      update: {
        nameTh: def.nameTh,
        nameEn: def.nameEn,
        departmentId: deptId[def.dept],
      },
      create: {
        organizationId,
        departmentId: deptId[def.dept],
        code: `${prefix}${def.code}`,
        nameTh: def.nameTh,
        nameEn: def.nameEn,
      },
    });
    positionIds[def.code] = row.id;
  }

  const locHq = await prisma.workLocation.upsert({
    where: { organizationId_code: { organizationId, code: `${prefix}HQ` } },
    update: {
      branchId: branches.HQ,
      latitude: 13.7563,
      longitude: 100.5018,
      geofenceRadiusMeters: 50,
    },
    create: {
      organizationId,
      branchId: branches.HQ,
      code: `${prefix}HQ`,
      name: "สำนักงานใหญ่",
      latitude: 13.7563,
      longitude: 100.5018,
      geofenceRadiusMeters: 50,
      timezone: "Asia/Bangkok",
    },
  });
  const locB2 = await prisma.workLocation.upsert({
    where: { organizationId_code: { organizationId, code: `${prefix}B2` } },
    update: {
      branchId: branches.B2,
      latitude: 13.6682,
      longitude: 100.614,
      geofenceRadiusMeters: 100,
    },
    create: {
      organizationId,
      branchId: branches.B2,
      code: `${prefix}B2`,
      name: "สาขา 2",
      latitude: 13.6682,
      longitude: 100.614,
      geofenceRadiusMeters: 100,
      timezone: "Asia/Bangkok",
    },
  });

  const dayShift = await prisma.shift.upsert({
    where: { organizationId_code: { organizationId, code: `${prefix}DAY` } },
    update: {},
    create: {
      organizationId,
      branchId: branches.HQ,
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
      branchId: branches.B2,
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

  for (const month of [6, 7]) {
    const periods = generateSemimonthlyPeriods(2026, month, {
      kind: "DAYS_AFTER_END",
      days: 5,
    });
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
  }

  const calendar = await db.workCalendar.upsert({
    where: {
      organizationId_code: { organizationId, code: `${prefix}STANDARD` },
    },
    update: { branchId: branches.HQ, workDays: [1, 2, 3, 4, 5] },
    create: {
      organizationId,
      branchId: branches.HQ,
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
        name: "วันหยุดตัวอย่าง Full QA",
      },
    },
    update: {},
    create: {
      organizationId,
      branchId: branches.HQ,
      workCalendarId: calendar.id,
      holidayTypeId: publicHolidayId,
      holidayDate: new Date("2026-06-03T00:00:00Z"),
      name: "วันหยุดตัวอย่าง Full QA",
      isPaid: true,
    },
  });

  const scheduleHq = await db.schedulePeriod.upsert({
    where: {
      organizationId_code: { organizationId, code: `${prefix}JUNJUL_HQ` },
    },
    update: {
      branchId: branches.HQ,
      periodStart,
      periodEnd,
      statusId: publishedScheduleStatusId,
      publishedAt: new Date(),
      publishedByAuthUserId: actorId,
    },
    create: {
      organizationId,
      branchId: branches.HQ,
      code: `${prefix}JUNJUL_HQ`,
      name: "ตารางงาน มิ.ย.–ก.ค. 2569 (HQ)",
      periodStart,
      periodEnd,
      statusId: publishedScheduleStatusId,
      timezone: "Asia/Bangkok",
      publishedAt: new Date(),
      publishedByAuthUserId: actorId,
    },
  });
  const scheduleB2 = await db.schedulePeriod.upsert({
    where: {
      organizationId_code: { organizationId, code: `${prefix}JUNJUL_B2` },
    },
    update: {
      branchId: branches.B2,
      periodStart,
      periodEnd,
      statusId: publishedScheduleStatusId,
      publishedAt: new Date(),
      publishedByAuthUserId: actorId,
    },
    create: {
      organizationId,
      branchId: branches.B2,
      code: `${prefix}JUNJUL_B2`,
      name: "ตารางงาน มิ.ย.–ก.ค. 2569 (B2)",
      periodStart,
      periodEnd,
      statusId: publishedScheduleStatusId,
      timezone: "Asia/Bangkok",
      publishedAt: new Date(),
      publishedByAuthUserId: actorId,
    },
  });

  // Link shifts onto periods (required by schedule board / composer).
  for (const [periodId, shiftId] of [
    [scheduleHq.id, dayShift.id],
    [scheduleB2.id, dayShift.id],
    [scheduleB2.id, nightShift.id],
  ] as const) {
    await db.schedulePeriodShift.upsert({
      where: {
        schedulePeriodId_shiftId: {
          schedulePeriodId: periodId,
          shiftId,
        },
      },
      update: {},
      create: { schedulePeriodId: periodId, shiftId },
    });
  }

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

  const policyFrom = new Date("2026-01-01T00:00:00Z");
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
      update: { annualEntitlement: days, isActive: true },
      create: {
        organizationId,
        leaveTypeId: type.id,
        branchId: null,
        code: `ENT_${prefix}${codeSuffix}`.slice(0, 40),
        name: `${label} (องค์กร)`,
        annualEntitlement: days,
        effectiveFrom: policyFrom,
        isActive: true,
      },
    });
  }

  await prisma.$executeRaw`
    INSERT INTO hr.payroll_deduction_settings (
      id, organization_id, tax_enabled, tax_rate_percent,
      social_security_enabled, social_security_rate_percent,
      social_security_max_amount, late_deduction_enabled, late_baht_per_minute,
      absence_deduction_enabled, absence_baht_per_day, updated_by_auth_user_id
    ) VALUES (
      gen_random_uuid(),
      ${organizationId}::uuid,
      true, 3, true, 5, 750, true, 5, true, 500, ${actorId}::uuid
    )
    ON CONFLICT (organization_id) DO UPDATE SET
      tax_enabled = EXCLUDED.tax_enabled,
      late_deduction_enabled = EXCLUDED.late_deduction_enabled,
      late_baht_per_minute = EXCLUDED.late_baht_per_minute,
      absence_deduction_enabled = EXCLUDED.absence_deduction_enabled,
      absence_baht_per_day = EXCLUDED.absence_baht_per_day,
      updated_by_auth_user_id = EXCLUDED.updated_by_auth_user_id,
      updated_at = CURRENT_TIMESTAMP
  `;

  type EmpRow = {
    id: string;
    key: string;
    branchId: string;
    authUserId: string;
    person: FullQaHrPerson;
  };
  const employees: EmpRow[] = [];

  for (const person of roster) {
    const link = ctx.users[person.email.toLowerCase()]!;
    const branchId = branches[person.homeBranch]!;
    const positionId = positionIds[person.positionCode] ?? positionIds.STAFF!;
    const departmentId =
      person.positionCode === "HR_STAFF" || person.positionCode === "ORG_ADMIN"
        ? deptHr.id
        : person.positionCode === "ACCOUNTANT" || person.positionCode === "CASHIER"
          ? deptFin.id
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
        employmentTypeId:
          person.wageType === "DAILY" ? employmentDailyId : employmentMonthlyId,
        employeeStatusId: statusActiveId,
        firstNameTh: person.firstNameTh,
        lastNameTh: person.lastNameTh,
        displayName: person.displayName,
        phone: person.phone,
        email: person.email,
        platformUserId: link.platformUserId,
        authUserId: link.authUserId,
        isActive: true,
        notes: person.scenario,
        updatedBy: actorId,
      },
      create: {
        organizationId,
        employeeCode: person.employeeCode,
        branchId,
        departmentId,
        positionId,
        employmentTypeId:
          person.wageType === "DAILY" ? employmentDailyId : employmentMonthlyId,
        employeeStatusId: statusActiveId,
        firstNameTh: person.firstNameTh,
        lastNameTh: person.lastNameTh,
        displayName: person.displayName,
        phone: person.phone,
        email: person.email,
        platformUserId: link.platformUserId,
        authUserId: link.authUserId,
        hireDate: new Date("2025-01-01T00:00:00Z"),
        isActive: true,
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
      data: { photoUrl: `${photoUrl}?v=full-qa` },
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
          overtimeEligible: true,
          isCurrent: true,
          createdBy: actorId,
        },
      });
    }

    for (const [type, days] of [
      [leaveAnnual, 10] as const,
      [leaveSick, 30] as const,
      [leavePersonal, 3] as const,
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
          usedBalance: person.fixture === "leave" ? 2 : 0,
          availableBalance: person.fixture === "leave" ? days - 2 : days,
        },
        create: {
          employeeId: employee.id,
          leaveTypeId: type.id,
          balanceYear: 2026,
          openingBalance: days,
          usedBalance: person.fixture === "leave" ? 2 : 0,
          availableBalance: person.fixture === "leave" ? days - 2 : days,
        },
      });
    }

    employees.push({
      id: employee.id,
      key: person.key,
      branchId,
      authUserId: link.authUserId,
      person,
    });
  }

  let attendanceDays = 0;
  let leaveCount = 0;

  for (const emp of employees) {
    const location = emp.person.homeBranch === "B2" ? locB2 : locHq;
    const shift = emp.person.shift === "NIGHT" ? nightShift : dayShift;
    const schedulePeriod =
      emp.person.homeBranch === "B2" ? scheduleB2 : scheduleHq;

    await db.employeeWorkCalendar.upsert({
      where: {
        employeeId_workCalendarId_effectiveFrom: {
          employeeId: emp.id,
          workCalendarId: calendar.id,
          effectiveFrom: periodStart,
        },
      },
      update: {},
      create: {
        employeeId: emp.id,
        workCalendarId: calendar.id,
        effectiveFrom: periodStart,
      },
    });

    const existingPrimaryLoc = await db.employeeWorkLocation.findFirst({
      where: { employeeId: emp.id, isPrimary: true, effectiveTo: null },
    });
    if (existingPrimaryLoc) {
      await db.employeeWorkLocation.update({
        where: { id: existingPrimaryLoc.id },
        data: {
          workLocationId: location.id,
          effectiveFrom: periodStart,
          isPrimary: true,
        },
      });
    } else {
      await db.employeeWorkLocation.create({
        data: {
          employeeId: emp.id,
          workLocationId: location.id,
          effectiveFrom: periodStart,
          isPrimary: true,
        },
      });
    }

    for (const workDate of allDates) {
      const outcome = dayOutcome(emp.person.fixture, workDate);
      const isRest = outcome === "REST";
      const isLeave = outcome === "LEAVE";

      const assignment = await db.shiftAssignment.upsert({
        where: {
          employeeId_workDate_sequenceNo: {
            employeeId: emp.id,
            workDate,
            sequenceNo: 1,
          },
        },
        update: {
          schedulePeriodId: schedulePeriod.id,
          shiftId: isRest ? null : shift.id,
          workLocationId: isRest ? null : location.id,
          isRestDay: isRest,
          isLeaveDay: isLeave,
        },
        create: {
          schedulePeriodId: schedulePeriod.id,
          employeeId: emp.id,
          shiftId: isRest ? null : shift.id,
          workDate,
          sequenceNo: 1,
          workLocationId: isRest ? null : location.id,
          isRestDay: isRest,
          isLeaveDay: isLeave,
          createdByAuthUserId: actorId,
        },
      });

      let statusId = presentId;
      let inAt: Date | null = null;
      let outAt: Date | null = null;
      let lateMinutes = 0;
      let note = "มาตรงเวลา";
      let scheduledMinutes = 480;

      if (outcome === "REST") {
        statusId = restDayId;
        note = "วันหยุดประจำสัปดาห์";
        scheduledMinutes = 0;
      } else if (outcome === "PRESENT") {
        if (emp.person.shift === "NIGHT") {
          inAt = clockAt(workDate, "20:00:00");
          const next = new Date(workDate);
          next.setUTCDate(next.getUTCDate() + 1);
          outAt = clockAt(next, "05:00:00");
        } else {
          inAt = clockAt(workDate, "08:00:00");
          outAt = clockAt(workDate, "17:00:00");
        }
      } else if (outcome === "LATE") {
        statusId = lateId;
        lateMinutes = emp.person.shift === "NIGHT" ? 25 : 35;
        note = "มาสาย";
        if (emp.person.shift === "NIGHT") {
          inAt = clockAt(workDate, "20:25:00");
          const next = new Date(workDate);
          next.setUTCDate(next.getUTCDate() + 1);
          outAt = clockAt(next, "05:00:00");
        } else {
          inAt = clockAt(workDate, "08:35:00");
          outAt = clockAt(workDate, "17:00:00");
        }
      } else if (outcome === "ABSENT") {
        statusId = absentId;
        note = "ขาดงาน";
      } else if (outcome === "LEAVE") {
        statusId = leaveAttId;
        note = "ลา";
        scheduledMinutes = 0;
        const leaveType =
          workDate.getUTCDate() === 11 ? leaveSick : leaveAnnual;
        const existingLeave = await db.leaveRequest.findFirst({
          where: {
            employeeId: emp.id,
            startDate: workDate,
            reason: { startsWith: "Full QA leave" },
          },
        });
        if (!existingLeave) {
          await db.leaveRequest.create({
            data: {
              organizationId,
              employeeId: emp.id,
              leaveTypeId: leaveType.id,
              statusId: approvedLeaveId,
              startDate: workDate,
              endDate: workDate,
              startUnitId: dayUnitId,
              endUnitId: dayUnitId,
              requestedAmount: 1,
              reason: `Full QA leave ${isoDate(workDate)}`,
              submittedAt: workDate,
              reviewedAt: workDate,
              reviewedByAuthUserId: actorId,
            },
          });
          leaveCount += 1;
        }
      }

      await db.attendanceDay.upsert({
        where: { employeeId_workDate: { employeeId: emp.id, workDate } },
        update: {
          statusId,
          clockInAt: inAt,
          clockOutAt: outAt,
          lateMinutes,
          notes: note,
          scheduledMinutes,
          workedMinutes: inAt && outAt ? 480 - lateMinutes : 0,
          schedulePeriodId: schedulePeriod.id,
          shiftAssignmentId: assignment.id,
        },
        create: {
          organizationId,
          branchId: emp.branchId,
          employeeId: emp.id,
          workDate,
          statusId,
          schedulePeriodId: schedulePeriod.id,
          shiftAssignmentId: assignment.id,
          clockInAt: inAt,
          clockOutAt: outAt,
          scheduledMinutes,
          workedMinutes: inAt && outAt ? 480 - lateMinutes : 0,
          lateMinutes,
          notes: note,
        },
      });
      attendanceDays += 1;

      const dayKey = isoDate(workDate).replace(/-/g, "");
      if (inAt) {
        await db.attendanceEvent.upsert({
          where: {
            employeeId_idempotencyKey: {
              employeeId: emp.id,
              idempotencyKey: `${prefix}IN_${emp.key}_${dayKey}`,
            },
          },
          update: { occurredAt: inAt },
          create: {
            organizationId,
            branchId: emp.branchId,
            employeeId: emp.id,
            eventTypeId: clockInId,
            occurredAt: inAt,
            workLocationId: location.id,
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            geofenceDistanceMeters: 0,
            idempotencyKey: `${prefix}IN_${emp.key}_${dayKey}`,
            source: "FULL_QA",
          },
        });
      }
      if (outAt) {
        await db.attendanceEvent.upsert({
          where: {
            employeeId_idempotencyKey: {
              employeeId: emp.id,
              idempotencyKey: `${prefix}OUT_${emp.key}_${dayKey}`,
            },
          },
          update: { occurredAt: outAt },
          create: {
            organizationId,
            branchId: emp.branchId,
            employeeId: emp.id,
            eventTypeId: clockOutId,
            occurredAt: outAt,
            workLocationId: location.id,
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            geofenceDistanceMeters: 0,
            idempotencyKey: `${prefix}OUT_${emp.key}_${dayKey}`,
            source: "FULL_QA",
          },
        });
      }
    }
  }

  // Pending leave for inbox testing (leave-fixture employee)
  const leaveEmp = employees.find((e) => e.person.fixture === "leave");
  if (leaveEmp) {
    const inboxToday = (() => {
      const label = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      return new Date(`${label}T00:00:00.000Z`);
    })();
    const pending = await db.leaveRequest.findFirst({
      where: {
        employeeId: leaveEmp.id,
        reason: "Full QA leave pending",
      },
    });
    if (!pending) {
      await db.leaveRequest.create({
        data: {
          organizationId,
          employeeId: leaveEmp.id,
          leaveTypeId: leaveSick.id,
          statusId: submittedLeaveId,
          startDate: inboxToday,
          endDate: inboxToday,
          startUnitId: dayUnitId,
          endUnitId: dayUnitId,
          requestedAmount: 1,
          reason: "Full QA leave pending",
          submittedAt: new Date(),
        },
      });
      leaveCount += 1;
    }
  }

  // Salary advances
  let advances = 0;
  const payPeriods = await db.payrollPeriod.findMany({
    where: { organizationId, payrollScheduleId: payrollSchedule.id },
    orderBy: { periodStart: "asc" },
  });
  const startPeriod = payPeriods[0];
  const advancePeople = employees.filter((e) => e.person.fixture === "advance");
  for (const [idx, emp] of advancePeople.entries()) {
    if (!startPeriod) break;
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id::text AS id FROM hr.salary_advances
      WHERE organization_id = ${organizationId}::uuid
        AND employee_id = ${emp.id}::uuid
        AND reason LIKE 'Full QA advance%'
      LIMIT 1
    `;
    if (existing[0]) continue;

    const advanceId = randomUUID();
    const amount = idx === 0 ? 2000 : 3000;
    const reason = `Full QA advance ${emp.person.employeeCode}`;
    if (idx === 0) {
      await prisma.$executeRaw`
        INSERT INTO hr.salary_advances (
          id, organization_id, employee_id, amount, advance_date, reason, status,
          installment_count, start_payroll_period_id, disbursement_mode,
          submitted_at, created_by_auth_user_id,
          approved_by_auth_user_id, approved_at
        ) VALUES (
          ${advanceId}::uuid,
          ${organizationId}::uuid,
          ${emp.id}::uuid,
          ${amount},
          ${periodStart}::date,
          ${reason},
          'APPROVED',
          2,
          ${startPeriod.id}::uuid,
          'CASH_ALREADY',
          ${periodStart},
          ${actorId}::uuid,
          ${actorId}::uuid,
          ${periodStart}
        )
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO hr.salary_advances (
          id, organization_id, employee_id, amount, advance_date, reason, status,
          installment_count, start_payroll_period_id, disbursement_mode,
          submitted_at, created_by_auth_user_id
        ) VALUES (
          ${advanceId}::uuid,
          ${organizationId}::uuid,
          ${emp.id}::uuid,
          ${amount},
          ${periodStart}::date,
          ${reason},
          'SUBMITTED',
          2,
          ${startPeriod.id}::uuid,
          'WITH_SALARY',
          ${periodStart},
          ${actorId}::uuid
        )
      `;
    }
    await prisma.$executeRaw`
      INSERT INTO hr.salary_advance_installments (
        id, organization_id, salary_advance_id, sequence, amount, payroll_period_id, status
      ) VALUES (
        gen_random_uuid(),
        ${organizationId}::uuid,
        ${advanceId}::uuid,
        1,
        ${amount / 2},
        ${startPeriod.id}::uuid,
        'PENDING'
      )
    `;
    if (payPeriods[1]) {
      await prisma.$executeRaw`
        INSERT INTO hr.salary_advance_installments (
          id, organization_id, salary_advance_id, sequence, amount, payroll_period_id, status
        ) VALUES (
          gen_random_uuid(),
          ${organizationId}::uuid,
          ${advanceId}::uuid,
          2,
          ${amount / 2},
          ${payPeriods[1].id}::uuid,
          'PENDING'
        )
      `;
    }
    advances += 1;
  }

  await prisma.demoSeedMarker.upsert({
    where: {
      organizationId_markerKey: {
        organizationId,
        markerKey: FULL_QA_MARKER_KEY,
      },
    },
    update: {},
    create: { organizationId, markerKey: FULL_QA_MARKER_KEY },
  });

  return {
    employees: employees.length,
    attendanceDays,
    leaves: leaveCount,
    advances,
  };
}

export async function seedFullQaHr(prisma: PrismaClient): Promise<{
  password: string;
  organizations: Array<{
    organizationId: string;
    orgCode: string;
    employees: number;
    attendanceDays: number;
    leaves: number;
    advances: number;
  }>;
  roster: Array<{
    orgCode: string;
    employeeCode: string;
    email: string;
    displayName: string;
    homeBranch: string;
    positionCode: string;
    scenario: string;
    fixture: string;
  }>;
}> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("full-qa HR seed forbidden in production");
  }

  const contexts = await resolveFullQaPlatformContexts(prisma);
  const organizations = [];
  for (const ctx of contexts) {
    console.log(`Seeding HR for ${ctx.orgCode}…`);
    const stats = await seedOneOrgHr(prisma, ctx);
    organizations.push({
      organizationId: ctx.organizationId,
      orgCode: ctx.orgCode,
      ...stats,
    });
  }

  return {
    password: FULL_QA_PASSWORD,
    organizations,
    roster: FULL_QA_ROSTER.map((p) => ({
      orgCode: p.orgCode,
      employeeCode: p.employeeCode,
      email: p.email,
      displayName: p.displayName,
      homeBranch: p.homeBranch,
      positionCode: p.positionCode,
      scenario: p.scenario,
      fixture: p.fixture,
    })),
  };
}

export async function cleanupFullQaHr(
  prisma: PrismaClient,
  options: { dryRun?: boolean } = {},
): Promise<{ dryRun: boolean; deleted: boolean; employees: number; orgCodes: string[] }> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("full-qa HR cleanup forbidden in production");
  }

  const contexts = await resolveFullQaPlatformContexts(prisma).catch(() => []);
  if (contexts.length === 0) {
    return {
      dryRun: Boolean(options.dryRun),
      deleted: false,
      employees: 0,
      orgCodes: [],
    };
  }

  let totalEmployees = 0;
  for (const ctx of contexts) {
    totalEmployees += await prisma.employee.count({
      where: {
        organizationId: ctx.organizationId,
        OR: [
          { employeeCode: { startsWith: "A" } },
          { employeeCode: { startsWith: "B" } },
        ],
      },
    });
  }

  if (options.dryRun) {
    return {
      dryRun: true,
      deleted: false,
      employees: totalEmployees,
      orgCodes: contexts.map((c) => c.orgCode),
    };
  }

  const db = prisma as any;
  for (const ctx of contexts) {
    const organizationId = ctx.organizationId;
    const employeeFilter = {
      organizationId,
      OR: [
        { employeeCode: { startsWith: "A" } },
        { employeeCode: { startsWith: "B" } },
      ],
    };
    const prefixed = {
      organizationId,
      code: { startsWith: FULL_QA_PREFIX },
    };

    const empIds = (
      await prisma.employee.findMany({
        where: employeeFilter,
        select: { id: true },
      })
    ).map((e) => e.id);

    if (empIds.length === 0) continue;

    await db.notification.deleteMany({
      where: { organizationId, recipientEmployeeId: { in: empIds } },
    }).catch(() => undefined);

    await prisma.$executeRaw`
      DELETE FROM hr.salary_advance_installments
      WHERE organization_id = ${organizationId}::uuid
        AND salary_advance_id IN (
          SELECT id FROM hr.salary_advances
          WHERE organization_id = ${organizationId}::uuid
            AND employee_id = ANY(${empIds}::uuid[])
        )
    `.catch(() => undefined);
    await prisma.$executeRaw`
      DELETE FROM hr.salary_advances
      WHERE organization_id = ${organizationId}::uuid
        AND employee_id = ANY(${empIds}::uuid[])
    `.catch(() => undefined);

    await db.attendanceEvent.deleteMany({
      where: { employeeId: { in: empIds } },
    });
    await db.attendanceAdjustment.deleteMany({
      where: { employeeId: { in: empIds } },
    }).catch(() => undefined);
    await db.attendanceDay.deleteMany({
      where: { employeeId: { in: empIds } },
    });
    await db.shiftAssignment.deleteMany({
      where: { employeeId: { in: empIds } },
    });
    await db.overtimeRequest.deleteMany({
      where: { employeeId: { in: empIds } },
    }).catch(() => undefined);
    await db.leaveRequest.deleteMany({
      where: { employeeId: { in: empIds } },
    });
    await db.employeeLeaveBalance.deleteMany({
      where: { employeeId: { in: empIds } },
    });
    await db.employeeWorkLocation.deleteMany({
      where: { employeeId: { in: empIds } },
    });
    await db.employeeWorkCalendar.deleteMany({
      where: { employeeId: { in: empIds } },
    });
    await db.employeeCompensation.deleteMany({
      where: { employeeId: { in: empIds } },
    });
    await db.employee.deleteMany({ where: { id: { in: empIds } } });

    await db.schedulePeriod.deleteMany({ where: prefixed });
    await db.holiday.deleteMany({
      where: { organizationId, name: { contains: "Full QA" } },
    }).catch(() => undefined);
    await db.workCalendar.deleteMany({ where: prefixed });
    await db.leavePolicy.deleteMany({
      where: { organizationId, code: { startsWith: "ENT_FQA_" } },
    });
    await db.leaveType.deleteMany({ where: prefixed });
    await db.overtimeRule.deleteMany({ where: prefixed });
    await db.shift.deleteMany({ where: prefixed });
    await db.workLocation.deleteMany({ where: prefixed });
    await db.position.deleteMany({ where: prefixed });
    await db.department.deleteMany({ where: prefixed });

    const schedules = await db.payrollSchedule.findMany({
      where: prefixed,
      select: { id: true },
    });
    for (const s of schedules) {
      await db.payrollPeriod.deleteMany({
        where: { payrollScheduleId: s.id },
      });
    }
    await db.payrollSchedule.deleteMany({ where: prefixed });
    await db.demoSeedMarker.deleteMany({
      where: { organizationId, markerKey: FULL_QA_MARKER_KEY },
    });
  }

  return {
    dryRun: false,
    deleted: true,
    employees: totalEmployees,
    orgCodes: contexts.map((c) => c.orgCode),
  };
}
