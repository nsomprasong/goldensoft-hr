/**
 * Privacy-safe Auth probe + employee activation (OTP / invitation / none).
 * OTP/invitation delivery is mocked unless HR_ACTIVATION_DELIVERY=live (never default).
 */
import { createHash, randomBytes, randomInt } from "node:crypto";

import { HR_AUDIT_ACTIONS, writeHrAudit } from "@/lib/hr/audit";
import { assertBranchInScope, assertHrPermission } from "@/lib/hr/authorize";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { EmployeeRecord, HrRepository } from "@/lib/hr/repository/types";
import {
  requireMasterByCode,
  type HrServiceContext,
} from "@/lib/hr/services/shared";
import { linkPlatformUser } from "@/lib/hr/services/employees";

export type AuthPhoneProbeResult = {
  /** True when a central Auth/UserProfile exists for this phone. Never lists orgs. */
  exists: boolean;
};

export type AuthPhoneDirectory = {
  findAuthByNormalizedPhone(phone: string): Promise<{
    authUserId: string;
    platformUserId: string;
  } | null>;
};

const memoryPhoneDirectory = new Map<
  string,
  { authUserId: string; platformUserId: string }
>();

/** Test/dev helper — never call from production request paths with real PII dumps. */
export function upsertMemoryAuthPhone(
  phone: string,
  ids: { authUserId: string; platformUserId: string },
): void {
  memoryPhoneDirectory.set(phone, ids);
}

export function clearMemoryAuthPhoneDirectory(): void {
  memoryPhoneDirectory.clear();
}

const defaultDirectory: AuthPhoneDirectory = {
  async findAuthByNormalizedPhone(phone) {
    return memoryPhoneDirectory.get(phone) ?? null;
  },
};

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function deliveryMode(): "mock" | "live" {
  return process.env.HR_ACTIVATION_DELIVERY === "live" ? "live" : "mock";
}

/**
 * Probe whether a phone already has Auth — returns only `{ exists }` for UI.
 * Callers with employeeLinkUser may use the internal directory for linking.
 */
export async function probeAuthAccountByPhone(
  repository: HrRepository,
  ctx: HrServiceContext,
  phone: string,
  directory: AuthPhoneDirectory = defaultDirectory,
): Promise<AuthPhoneProbeResult> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeCreate);
  const normalized = phone.trim();
  const hit = await directory.findAuthByNormalizedPhone(normalized);
  if (hit) {
    await writeHrAudit(repository, {
      organizationId: ctx.organizationId,
      actorAuthUserId: ctx.actorAuthUserId,
      actionCode: HR_AUDIT_ACTIONS.employeeAuthDetected,
      entityType: "auth_probe",
      entityId: ctx.organizationId,
      after: { exists: true },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
  return { exists: Boolean(hit) };
}

export type ActivationChallenge = {
  id: string;
  organizationId: string;
  employeeId: string;
  onboardingMethodCode: string;
  statusCode: string;
  phoneNormalized: string | null;
  tokenHash: string;
  expiresAt: Date;
  /** Present only in mock mode for tests — never log in production. */
  mockToken?: string;
};

type ActivationStore = {
  challenges: ActivationChallenge[];
};

const activationStore: ActivationStore = { challenges: [] };

export function resetActivationStoreForTests(): void {
  activationStore.challenges = [];
}

function cancelPending(employeeId: string): void {
  for (const row of activationStore.challenges) {
    if (row.employeeId === employeeId && row.statusCode === "PENDING") {
      row.statusCode = "CANCELLED";
    }
  }
}

export async function startEmployeeActivation(
  repository: HrRepository,
  ctx: HrServiceContext,
  employeeId: string,
  methodCode: "OTP_VERIFICATION" | "INVITATION",
): Promise<ActivationChallenge> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeLinkUser);
  const employee = await repository.employees.findById(
    ctx.organizationId,
    employeeId,
  );
  if (!employee) throw new HrError("NOT_FOUND", { details: { employeeId } });
  assertBranchInScope(ctx, employee.branchId);

  const method = await requireMasterByCode(
    repository,
    "employeeOnboardingMethod",
    methodCode,
  );
  const pendingAccess = await requireMasterByCode(
    repository,
    "employeeAccountAccessStatus",
    "PENDING_ACTIVATION",
  );

  cancelPending(employeeId);

  const rawToken =
    methodCode === "OTP_VERIFICATION"
      ? String(randomInt(100000, 999999))
      : randomBytes(24).toString("base64url");
  const challenge: ActivationChallenge = {
    id: randomBytes(16).toString("hex"),
    organizationId: ctx.organizationId,
    employeeId,
    onboardingMethodCode: methodCode,
    statusCode: "PENDING",
    phoneNormalized: employee.phone,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    mockToken: deliveryMode() === "mock" ? rawToken : undefined,
  };
  activationStore.challenges.push(challenge);

  await repository.employees.update(employeeId, {
    onboardingMethodId: method.id,
    accountAccessStatusId: pendingAccess.id,
    updatedBy: ctx.actorAuthUserId,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: employee.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode:
      methodCode === "OTP_VERIFICATION"
        ? HR_AUDIT_ACTIONS.employeeOtpRequested
        : HR_AUDIT_ACTIONS.employeeInvitationCreated,
    entityType: "employee_activation",
    entityId: challenge.id,
    after: {
      employeeId,
      methodCode,
      delivery: deliveryMode(),
      expiresAt: challenge.expiresAt.toISOString(),
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  if (deliveryMode() === "live") {
    throw new HrError("VALIDATION_ERROR", {
      message:
        "การส่ง OTP/คำเชิญจริงยังไม่เปิดในสภาพแวดล้อมนี้ — ใช้ mock (ค่าเริ่มต้น)",
    });
  }

  return challenge;
}

export async function completeEmployeeActivation(
  repository: HrRepository,
  ctx: HrServiceContext,
  input: {
    employeeId: string;
    token: string;
    platformUserId: string;
    authUserId: string;
    platformUserOrganizationId: string;
  },
): Promise<EmployeeRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeLinkUser);
  const challenge = activationStore.challenges
    .filter(
      (row) =>
        row.employeeId === input.employeeId &&
        row.organizationId === ctx.organizationId &&
        row.statusCode === "PENDING",
    )
    .sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())[0];

  if (!challenge) {
    throw new HrError("NOT_FOUND", { message: "ไม่พบคำขอเปิดบัญชีที่รอดำเนินการ" });
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    challenge.statusCode = "EXPIRED";
    throw new HrError("VALIDATION_ERROR", { message: "คำขอเปิดบัญชีหมดอายุแล้ว" });
  }
  if (challenge.tokenHash !== hashToken(input.token)) {
    throw new HrError("VALIDATION_ERROR", { message: "รหัสยืนยันไม่ถูกต้อง" });
  }

  challenge.statusCode = "VERIFIED";

  const linked = await linkPlatformUser(repository, ctx, input.employeeId, {
    platformUserId: input.platformUserId,
    authUserId: input.authUserId,
    platformUserOrganizationId: input.platformUserOrganizationId,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: linked.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode:
      challenge.onboardingMethodCode === "OTP_VERIFICATION"
        ? HR_AUDIT_ACTIONS.employeeOtpVerified
        : HR_AUDIT_ACTIONS.employeeInvitationAccepted,
    entityType: "employee_activation",
    entityId: challenge.id,
    after: { employeeId: linked.id },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return linked;
}

/**
 * Application-level invariant: at most one active employee per auth within an org.
 * (DB enforces via partial unique index after migration 0017 is applied.)
 */
export async function assertNoActiveAuthCollision(
  repository: HrRepository,
  organizationId: string,
  authUserId: string,
  exceptEmployeeId?: string,
): Promise<void> {
  const hit = await repository.employees.findByAuthUserId(
    organizationId,
    authUserId,
    { activeOnly: true },
  );
  if (hit && hit.id !== exceptEmployeeId) {
    throw new HrError("DUPLICATE_AUTH_USER", {
      details: { authUserId, employeeId: hit.id },
    });
  }
}
