/**
 * Multi-org Auth ↔ Employee QA addon (HR).
 *
 * Prerequisite:
 *   1) goldensoft-platform `npm run seed:full-qa`
 *   2) goldensoft-platform `npm run seed:multi-org-auth-qa`
 *   3) goldensoft-hr `npm run seed:full-qa` (depts/positions/FQA setup)
 *
 * Password for linked Auth users: `11111111`
 */
import { createHash, randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { saveDemoAvatarSvg } from "@/lib/hr/employee-photos";

export const MULTI_ORG_QA_PASSWORD = "11111111";
export const MULTI_ORG_QA_MARKER = "multi-org-auth-qa";
export const MULTI_ORG_QA_EMPLOYEE_PREFIX = "MOA-";

type OrgCode = "TEST-ALPHA" | "TEST-BETA";

type LinkedSeat = {
  kind: "linked";
  key: string;
  orgCode: OrgCode;
  employeeCode: string;
  email: string;
  phone: string;
  firstNameTh: string;
  lastNameTh: string;
  homeBranch: "HQ" | "B2";
  accountAccess: "ACTIVE" | "DISABLED";
  onboarding?: "NO_NOTIFICATION" | "OTP_VERIFICATION" | "INVITATION";
  isActive: boolean;
  employeeStatus: "ACTIVE" | "TERMINATED" | "INACTIVE";
  scenario: string;
  hue: number;
};

type UnlinkedSeat = {
  kind: "unlinked";
  key: string;
  orgCode: OrgCode;
  employeeCode: string;
  phone: string;
  firstNameTh: string;
  lastNameTh: string;
  homeBranch: "HQ" | "B2";
  accountAccess: "NOT_LINKED" | "PENDING_ACTIVATION";
  onboarding: "NO_NOTIFICATION" | "OTP_VERIFICATION" | "INVITATION";
  challenge?: "OTP" | "INVITATION";
  scenario: string;
  hue: number;
};

export type MultiOrgQaSeat = LinkedSeat | UnlinkedSeat;

/** Keep emails/codes aligned with Platform multi-org-auth-qa-dataset.ts */
export const MULTI_ORG_QA_SEATS: readonly MultiOrgQaSeat[] = [
  {
    kind: "linked",
    key: "both-alpha",
    orgCode: "TEST-ALPHA",
    employeeCode: "MOA-BOTH",
    email: "x.both@ex.com",
    phone: "0830000001",
    firstNameTh: "ขวัญใจ",
    lastNameTh: "สองบริษัท",
    homeBranch: "HQ",
    accountAccess: "ACTIVE",
    onboarding: "NO_NOTIFICATION",
    isActive: true,
    employeeStatus: "ACTIVE",
    scenario: "พนักงาน active ในอัลฟ่า (Auth เดียวกับเบต้า)",
    hue: 28,
  },
  {
    kind: "linked",
    key: "both-beta",
    orgCode: "TEST-BETA",
    employeeCode: "MOA-BOTH",
    email: "x.both@ex.com",
    phone: "0830000001",
    firstNameTh: "ขวัญใจ",
    lastNameTh: "สองบริษัท",
    homeBranch: "HQ",
    accountAccess: "ACTIVE",
    onboarding: "NO_NOTIFICATION",
    isActive: true,
    employeeStatus: "ACTIVE",
    scenario: "พนักงาน active ในเบต้า (Auth เดียวกับอัลฟ่า)",
    hue: 28,
  },
  {
    kind: "linked",
    key: "branch-alpha",
    orgCode: "TEST-ALPHA",
    employeeCode: "MOA-BR",
    email: "x.branch@ex.com",
    phone: "0830000002",
    firstNameTh: "สาขาชัด",
    lastNameTh: "หลายสาขา",
    homeBranch: "B2",
    accountAccess: "ACTIVE",
    onboarding: "NO_NOTIFICATION",
    isActive: true,
    employeeStatus: "ACTIVE",
    scenario: "องค์กรเดียวหลายสาขา — ทดสอบหน้าเลือกสาขา",
    hue: 160,
  },
  {
    kind: "linked",
    key: "rehire-old",
    orgCode: "TEST-ALPHA",
    employeeCode: "MOA-OLD",
    email: "x.rehire@ex.com",
    phone: "0830000003",
    firstNameTh: "เริ่มใหม่",
    lastNameTh: "รีไฮร์",
    homeBranch: "HQ",
    accountAccess: "DISABLED",
    onboarding: "NO_NOTIFICATION",
    isActive: false,
    employeeStatus: "TERMINATED",
    scenario: "ประวัติจ้างงานเก่า (inactive) ยังเก็บ auth_user_id — partial unique",
    hue: 0,
  },
  {
    kind: "linked",
    key: "rehire-new",
    orgCode: "TEST-ALPHA",
    employeeCode: "MOA-NEW",
    email: "x.rehire@ex.com",
    phone: "0830000031",
    firstNameTh: "เริ่มใหม่",
    lastNameTh: "รีไฮร์",
    homeBranch: "HQ",
    accountAccess: "ACTIVE",
    onboarding: "NO_NOTIFICATION",
    isActive: true,
    employeeStatus: "ACTIVE",
    scenario: "พนักงานรีไฮร์ active คนละแถว ใช้ Auth เดิมในองค์กรเดียว",
    hue: 200,
  },
  {
    kind: "unlinked",
    key: "not-linked",
    orgCode: "TEST-ALPHA",
    employeeCode: "MOA-FREE",
    phone: "0830000004",
    firstNameTh: "ยังไม่",
    lastNameTh: "เชื่อมบัญชี",
    homeBranch: "HQ",
    accountAccess: "NOT_LINKED",
    onboarding: "NO_NOTIFICATION",
    scenario: "พนักงานยังไม่เชื่อม Auth — onboarding NO_NOTIFICATION",
    hue: 45,
  },
  {
    kind: "unlinked",
    key: "pending-otp",
    orgCode: "TEST-ALPHA",
    employeeCode: "MOA-OTP",
    phone: "0830000005",
    firstNameTh: "รอโอทีพี",
    lastNameTh: "เปิดบัญชี",
    homeBranch: "HQ",
    accountAccess: "PENDING_ACTIVATION",
    onboarding: "OTP_VERIFICATION",
    challenge: "OTP",
    scenario: "รอเปิดใช้งานด้วย OTP (challenge mock ใน DB — ไม่ส่ง SMS จริง)",
    hue: 300,
  },
  {
    kind: "unlinked",
    key: "pending-invite",
    orgCode: "TEST-ALPHA",
    employeeCode: "MOA-INV",
    phone: "0830000006",
    firstNameTh: "รอเชิญ",
    lastNameTh: "เปิดบัญชี",
    homeBranch: "B2",
    accountAccess: "PENDING_ACTIVATION",
    onboarding: "INVITATION",
    challenge: "INVITATION",
    scenario: "รอเปิดใช้งานด้วยคำเชิญ (challenge mock — ไม่ส่งอีเมลจริง)",
    hue: 330,
  },
];

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
    throw new Error(`Master ${model}.${code} missing — run npm run seed:hr / migration 0017`);
  }
  return row.id as string;
}

async function resolveOrg(
  prisma: PrismaClient,
  orgCode: OrgCode,
): Promise<{
  organizationId: string;
  branches: Record<"HQ" | "B2", string>;
  actorId: string;
  positionId: string;
  departmentId: string;
  employmentMonthlyId: string;
}> {
  const orgs = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id::text AS id
    FROM platform.organizations
    WHERE customer_code = ${orgCode}
      AND deleted_at IS NULL
    LIMIT 1
  `;
  const org = orgs[0];
  if (!org) {
    throw new Error(`ไม่พบ ${orgCode} — รัน Platform seed:full-qa ก่อน`);
  }

  const branchRows = await prisma.$queryRaw<Array<{ id: string; code: string }>>`
    SELECT id::text AS id, code
    FROM platform.branches
    WHERE organization_id = ${org.id}::uuid
      AND deleted_at IS NULL
  `;
  const branches: Record<string, string> = {};
  for (const b of branchRows) branches[b.code] = b.id;
  if (!branches.HQ || !branches.B2) {
    throw new Error(`${orgCode} ต้องมี HQ และ B2`);
  }

  const owners = await prisma.$queryRaw<Array<{ auth_user_id: string }>>`
    SELECT up.auth_user_id::text AS auth_user_id
    FROM platform.user_profiles up
    INNER JOIN platform.organization_memberships om ON om.user_profile_id = up.id
    INNER JOIN platform.organization_membership_roles omr ON omr.membership_id = om.id
    INNER JOIN platform.organization_roles r ON r.id = omr.role_id
    WHERE om.organization_id = ${org.id}::uuid
      AND r.code = 'OWNER'
      AND up.deleted_at IS NULL
    LIMIT 1
  `;
  const actorId = owners[0]?.auth_user_id;
  if (!actorId) {
    throw new Error(`${orgCode} ไม่มี OWNER สำหรับ actor seed`);
  }

  const db = prisma as any;
  let position = await db.position.findFirst({
    where: { organizationId: org.id, code: "FQA_STAFF" },
    select: { id: true, departmentId: true },
  });
  if (!position) {
    position = await db.position.findFirst({
      where: { organizationId: org.id, code: { startsWith: "FQA_" }, isActive: true },
      select: { id: true, departmentId: true },
    });
  }
  if (!position) {
    throw new Error(
      `${orgCode} ไม่มีตำแหน่ง — รัน goldensoft-hr npm run seed:full-qa ก่อน`,
    );
  }

  return {
    organizationId: org.id,
    branches: { HQ: branches.HQ!, B2: branches.B2! },
    actorId,
    positionId: position.id,
    departmentId: position.departmentId,
    employmentMonthlyId: await requireMasterId(prisma, "employmentType", "MONTHLY"),
  };
}

async function resolvePlatformUser(
  prisma: PrismaClient,
  email: string,
  organizationId: string,
): Promise<{ platformUserId: string; authUserId: string }> {
  const rows = await prisma.$queryRaw<
    Array<{ platform_user_id: string; auth_user_id: string }>
  >`
    SELECT
      up.id::text AS platform_user_id,
      up.auth_user_id::text AS auth_user_id
    FROM platform.user_profiles up
    INNER JOIN platform.organization_memberships om
      ON om.user_profile_id = up.id
    WHERE lower(up.email) = ${email.toLowerCase()}
      AND om.organization_id = ${organizationId}::uuid
      AND up.deleted_at IS NULL
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new Error(
      `ไม่พบบัญชี ${email} ในองค์กร — รัน Platform npm run seed:multi-org-auth-qa ก่อน`,
    );
  }
  return {
    platformUserId: row.platform_user_id,
    authUserId: row.auth_user_id,
  };
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Wire MOA employees into Full-QA locations / calendar / published schedule. */
async function attachSelfServiceOps(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    employeeId: string;
    homeBranch: "HQ" | "B2";
    actorId: string;
  },
): Promise<void> {
  const db = prisma as any;
  const locCode = input.homeBranch === "B2" ? "FQA_B2" : "FQA_HQ";
  const scheduleCode =
    input.homeBranch === "B2" ? "FQA_JUNJUL_B2" : "FQA_JUNJUL_HQ";

  const location = await db.workLocation.findFirst({
    where: { organizationId: input.organizationId, code: locCode },
  });
  const calendar = await db.workCalendar.findFirst({
    where: { organizationId: input.organizationId, code: "FQA_STANDARD" },
  });
  const dayShift = await db.shift.findFirst({
    where: { organizationId: input.organizationId, code: "FQA_DAY" },
  });
  const schedulePeriod = await db.schedulePeriod.findFirst({
    where: { organizationId: input.organizationId, code: scheduleCode },
  });
  const leaveAnnual = await db.leaveType.findFirst({
    where: { organizationId: input.organizationId, code: "FQA_ANNUAL" },
  });
  const leaveSick = await db.leaveType.findFirst({
    where: { organizationId: input.organizationId, code: "FQA_SICK" },
  });
  const leavePersonal = await db.leaveType.findFirst({
    where: { organizationId: input.organizationId, code: "FQA_PERSONAL" },
  });
  const wageTypeId = await requireMasterId(prisma, "wageType", "MONTHLY");

  if (location) {
    const existingPrimaryLoc = await db.employeeWorkLocation.findFirst({
      where: {
        employeeId: input.employeeId,
        isPrimary: true,
        effectiveTo: null,
      },
    });
    if (existingPrimaryLoc) {
      await db.employeeWorkLocation.update({
        where: { id: existingPrimaryLoc.id },
        data: {
          workLocationId: location.id,
          effectiveFrom: new Date("2026-06-01T00:00:00Z"),
          isPrimary: true,
        },
      });
    } else {
      await db.employeeWorkLocation.create({
        data: {
          employeeId: input.employeeId,
          workLocationId: location.id,
          effectiveFrom: new Date("2026-06-01T00:00:00Z"),
          isPrimary: true,
        },
      });
    }
  }

  if (calendar) {
    await db.employeeWorkCalendar.upsert({
      where: {
        employeeId_workCalendarId_effectiveFrom: {
          employeeId: input.employeeId,
          workCalendarId: calendar.id,
          effectiveFrom: new Date("2026-06-01T00:00:00Z"),
        },
      },
      update: {},
      create: {
        employeeId: input.employeeId,
        workCalendarId: calendar.id,
        effectiveFrom: new Date("2026-06-01T00:00:00Z"),
      },
    });
  }

  const existingComp = await prisma.employeeCompensation.findFirst({
    where: { employeeId: input.employeeId, isCurrent: true },
  });
  if (!existingComp) {
    await prisma.employeeCompensation.create({
      data: {
        employeeId: input.employeeId,
        wageTypeId,
        amount: 25_000,
        currency: "THB",
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        standardHoursPerDay: 8,
        standardDaysPerMonth: 30,
        overtimeEligible: true,
        isCurrent: true,
        createdBy: input.actorId,
      },
    });
  }

  for (const [type, days] of [
    [leaveAnnual, 10] as const,
    [leaveSick, 30] as const,
    [leavePersonal, 3] as const,
  ]) {
    if (!type) continue;
    await db.employeeLeaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_balanceYear: {
          employeeId: input.employeeId,
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
        employeeId: input.employeeId,
        leaveTypeId: type.id,
        balanceYear: 2026,
        openingBalance: days,
        usedBalance: 0,
        availableBalance: days,
      },
    });
  }

  if (schedulePeriod && dayShift && location) {
    const start = new Date("2026-07-01T00:00:00Z");
    const end = new Date("2026-07-31T00:00:00Z");
    for (
      let cursor = new Date(start);
      cursor <= end;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      const workDate = new Date(cursor);
      const dow = workDate.getUTCDay();
      const isRest = dow === 0 || dow === 6;
      await db.shiftAssignment.upsert({
        where: {
          employeeId_workDate_sequenceNo: {
            employeeId: input.employeeId,
            workDate,
            sequenceNo: 1,
          },
        },
        update: {
          schedulePeriodId: schedulePeriod.id,
          shiftId: isRest ? null : dayShift.id,
          workLocationId: isRest ? null : location.id,
          isRestDay: isRest,
          isLeaveDay: false,
        },
        create: {
          employeeId: input.employeeId,
          schedulePeriodId: schedulePeriod.id,
          workDate,
          sequenceNo: 1,
          shiftId: isRest ? null : dayShift.id,
          workLocationId: isRest ? null : location.id,
          isRestDay: isRest,
          isLeaveDay: false,
          createdByAuthUserId: input.actorId,
        },
      });
    }
  }
}

export type MultiOrgQaHrSeedResult = {
  password: string;
  employees: Array<{
    key: string;
    orgCode: OrgCode;
    employeeCode: string;
    employeeId: string;
    accountAccess: string;
    isActive: boolean;
    email?: string;
    mockToken?: string;
    scenario: string;
  }>;
};

export async function seedMultiOrgAuthQaHr(
  prisma: PrismaClient,
): Promise<MultiOrgQaHrSeedResult> {
  const statusActiveId = await requireMasterId(prisma, "employeeStatus", "ACTIVE");
  const statusTerminatedId = await requireMasterId(
    prisma,
    "employeeStatus",
    "TERMINATED",
  );
  const statusInactiveId = await requireMasterId(
    prisma,
    "employeeStatus",
    "INACTIVE",
  );
  const accessIds = {
    NOT_LINKED: await requireMasterId(
      prisma,
      "employeeAccountAccessStatus",
      "NOT_LINKED",
    ),
    PENDING_ACTIVATION: await requireMasterId(
      prisma,
      "employeeAccountAccessStatus",
      "PENDING_ACTIVATION",
    ),
    ACTIVE: await requireMasterId(prisma, "employeeAccountAccessStatus", "ACTIVE"),
    DISABLED: await requireMasterId(
      prisma,
      "employeeAccountAccessStatus",
      "DISABLED",
    ),
  };
  const onboardingIds = {
    NO_NOTIFICATION: await requireMasterId(
      prisma,
      "employeeOnboardingMethod",
      "NO_NOTIFICATION",
    ),
    OTP_VERIFICATION: await requireMasterId(
      prisma,
      "employeeOnboardingMethod",
      "OTP_VERIFICATION",
    ),
    INVITATION: await requireMasterId(
      prisma,
      "employeeOnboardingMethod",
      "INVITATION",
    ),
  };
  const challengePendingId = await requireMasterId(
    prisma,
    "employeeActivationStatus",
    "PENDING",
  );

  const orgCache = new Map<OrgCode, Awaited<ReturnType<typeof resolveOrg>>>();
  const employees: MultiOrgQaHrSeedResult["employees"] = [];

  for (const seat of MULTI_ORG_QA_SEATS) {
    if (!orgCache.has(seat.orgCode)) {
      orgCache.set(seat.orgCode, await resolveOrg(prisma, seat.orgCode));
    }
    const org = orgCache.get(seat.orgCode)!;
    const branchId = org.branches[seat.homeBranch];
    const employeeStatusId =
      seat.kind === "linked"
        ? seat.employeeStatus === "TERMINATED"
          ? statusTerminatedId
          : seat.employeeStatus === "INACTIVE"
            ? statusInactiveId
            : statusActiveId
        : statusActiveId;

    const link =
      seat.kind === "linked"
        ? await resolvePlatformUser(prisma, seat.email, org.organizationId)
        : null;

    const displayName = `${seat.firstNameTh} ${seat.lastNameTh}`;
    const employee = await prisma.employee.upsert({
      where: {
        organizationId_employeeCode: {
          organizationId: org.organizationId,
          employeeCode: seat.employeeCode,
        },
      },
      update: {
        branchId,
        departmentId: org.departmentId,
        positionId: org.positionId,
        employmentTypeId: org.employmentMonthlyId,
        employeeStatusId,
        accountAccessStatusId: accessIds[seat.accountAccess],
        onboardingMethodId: seat.onboarding
          ? onboardingIds[seat.onboarding]
          : null,
        firstNameTh: seat.firstNameTh,
        lastNameTh: seat.lastNameTh,
        displayName,
        phone: seat.phone,
        email: seat.kind === "linked" ? seat.email : null,
        platformUserId: link?.platformUserId ?? null,
        authUserId: link?.authUserId ?? null,
        isActive: seat.kind === "linked" ? seat.isActive : true,
        notes: `${MULTI_ORG_QA_MARKER}: ${seat.scenario}`,
        accountActivatedAt:
          seat.accountAccess === "ACTIVE" ? new Date("2026-01-15T00:00:00Z") : null,
        accountDisabledAt:
          seat.accountAccess === "DISABLED"
            ? new Date("2026-03-01T00:00:00Z")
            : null,
        updatedBy: org.actorId,
      },
      create: {
        organizationId: org.organizationId,
        employeeCode: seat.employeeCode,
        branchId,
        departmentId: org.departmentId,
        positionId: org.positionId,
        employmentTypeId: org.employmentMonthlyId,
        employeeStatusId,
        accountAccessStatusId: accessIds[seat.accountAccess],
        onboardingMethodId: seat.onboarding
          ? onboardingIds[seat.onboarding]
          : null,
        firstNameTh: seat.firstNameTh,
        lastNameTh: seat.lastNameTh,
        displayName,
        phone: seat.phone,
        email: seat.kind === "linked" ? seat.email : null,
        platformUserId: link?.platformUserId ?? null,
        authUserId: link?.authUserId ?? null,
        hireDate: new Date("2025-06-01T00:00:00Z"),
        isActive: seat.kind === "linked" ? seat.isActive : true,
        notes: `${MULTI_ORG_QA_MARKER}: ${seat.scenario}`,
        accountActivatedAt:
          seat.accountAccess === "ACTIVE" ? new Date("2026-01-15T00:00:00Z") : null,
        accountDisabledAt:
          seat.accountAccess === "DISABLED"
            ? new Date("2026-03-01T00:00:00Z")
            : null,
        createdBy: org.actorId,
        updatedBy: org.actorId,
      },
    });

    const photoUrl = await saveDemoAvatarSvg({
      organizationId: org.organizationId,
      employeeId: employee.id,
      label: `${seat.firstNameTh.slice(0, 1)}${seat.lastNameTh.slice(0, 1)}`,
      hue: seat.hue,
    });
    await prisma.employee.update({
      where: { id: employee.id },
      data: { photoUrl: `${photoUrl}?v=multi-org-qa` },
    });

    if (seat.kind === "linked" && seat.isActive) {
      await attachSelfServiceOps(prisma, {
        organizationId: org.organizationId,
        employeeId: employee.id,
        homeBranch: seat.homeBranch,
        actorId: org.actorId,
      });
    }

    let mockToken: string | undefined;
    if (seat.kind === "unlinked" && seat.challenge) {
      mockToken =
        seat.challenge === "OTP"
          ? `moa-otp-${seat.employeeCode.replace(/^MOA-/, "").toLowerCase()}`
          : `moa-invite-${seat.employeeCode.replace(/^MOA-/, "").toLowerCase()}`;
      const methodId =
        seat.challenge === "OTP"
          ? onboardingIds.OTP_VERIFICATION
          : onboardingIds.INVITATION;

      await prisma.$executeRaw`
        UPDATE hr.employee_activation_challenges
        SET status_id = (
              SELECT id FROM hr.employee_activation_statuses WHERE code = 'CANCELLED' LIMIT 1
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = ${employee.id}::uuid
          AND status_id = ${challengePendingId}::uuid
      `;

      await prisma.$executeRaw`
        INSERT INTO hr.employee_activation_challenges (
          id, organization_id, employee_id, onboarding_method_id, status_id,
          phone_normalized, token_hash, expires_at,
          created_by_auth_user_id, created_at, updated_at
        ) VALUES (
          ${randomUUID()}::uuid,
          ${org.organizationId}::uuid,
          ${employee.id}::uuid,
          ${methodId}::uuid,
          ${challengePendingId}::uuid,
          ${seat.phone},
          ${hashToken(mockToken)},
          ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)},
          ${org.actorId}::uuid,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
    }

    employees.push({
      key: seat.key,
      orgCode: seat.orgCode,
      employeeCode: seat.employeeCode,
      employeeId: employee.id,
      accountAccess: seat.accountAccess,
      isActive: seat.kind === "linked" ? seat.isActive : true,
      email: seat.kind === "linked" ? seat.email : undefined,
      mockToken,
      scenario: seat.scenario,
    });
  }

  return { password: MULTI_ORG_QA_PASSWORD, employees };
}

export async function cleanupMultiOrgAuthQaHr(
  prisma: PrismaClient,
): Promise<{ employees: number; challenges: number }> {
  const rows = await prisma.employee.findMany({
    where: { employeeCode: { startsWith: MULTI_ORG_QA_EMPLOYEE_PREFIX } },
    select: { id: true },
  });
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) {
    return { employees: 0, challenges: 0 };
  }

  const challenges = await prisma.employeeActivationChallenge.deleteMany({
    where: { employeeId: { in: ids } },
  });
  const db = prisma as any;
  await db.shiftAssignment.deleteMany({ where: { employeeId: { in: ids } } });
  await db.employeeWorkLocation.deleteMany({
    where: { employeeId: { in: ids } },
  });
  await db.employeeWorkCalendar.deleteMany({
    where: { employeeId: { in: ids } },
  });
  await prisma.employeeCompensation.deleteMany({
    where: { employeeId: { in: ids } },
  });
  try {
    await prisma.employeeLeaveBalance.deleteMany({
      where: { employeeId: { in: ids } },
    });
  } catch {
    // leave balances may not exist for these rows
  }
  await prisma.employee.deleteMany({ where: { id: { in: ids } } });
  return { employees: ids.length, challenges: challenges.count };
}
