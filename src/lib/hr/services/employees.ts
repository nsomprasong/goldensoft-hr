/**
 * Employee domain service.
 *
 * HR owns employee records and never creates Supabase auth users. Linking a
 * Platform account is a separate action. When a linked employee's home branch
 * changes, HR syncs Platform membership scope so login lands on that branch.
 */
import {
  assertBranchInScope,
  assertCanManageOrganizationOwnerEmployment,
  assertHrPermission,
  hrCan,
  isGoldenSoftPlatformStaff,
} from "@/lib/hr/authorize";
import { HR_AUDIT_ACTIONS, writeHrAudit } from "@/lib/hr/audit";
import { nextEmployeeCode } from "@/lib/hr/business-codes";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { toDateOnly } from "@/lib/hr/payroll-rules";
import type {
  EmployeeRecord,
  HrRepository,
} from "@/lib/hr/repository/types";
import {
  normalizeCode,
  normalizePagination,
  optionalText,
  requireActiveMaster,
  requireMasterByCode,
  requireText,
  resolveBranchScope,
  toPagedResponse,
  type HrServiceContext,
  type PagedResponse,
  type PageRequest,
} from "@/lib/hr/services/shared";

/** True when the linked Platform membership has an active OWNER role. */
export async function employeeHasOrganizationOwnerRole(
  organizationId: string,
  platformUserId: string | null | undefined,
): Promise<boolean> {
  if (!platformUserId) return false;
  if (!process.env.DATABASE_URL) return false;
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>`
      SELECT true AS ok
      FROM platform.organization_memberships om
      JOIN platform.membership_statuses ms ON ms.id = om.status_id
      JOIN platform.organization_membership_roles omr
        ON omr.membership_id = om.id
       AND omr.revoked_at IS NULL
      JOIN platform.assignment_statuses ast ON ast.id = omr.status_id
      JOIN platform.organization_roles r ON r.id = omr.role_id
      WHERE om.organization_id = ${organizationId}::uuid
        AND om.user_profile_id = ${platformUserId}::uuid
        AND ms.code = 'ACTIVE'
        AND om.ended_at IS NULL
        AND ast.code = 'ACTIVE'
        AND upper(r.code) = 'OWNER'
      LIMIT 1
    `;
    return Boolean(rows[0]?.ok);
  } catch {
    return false;
  }
}

async function assertOwnerEmploymentGuard(
  ctx: HrServiceContext,
  employee: Pick<EmployeeRecord, "platformUserId">,
): Promise<void> {
  const isOwner = await employeeHasOrganizationOwnerRole(
    ctx.organizationId,
    employee.platformUserId,
  );
  assertCanManageOrganizationOwnerEmployment(ctx, isOwner);
}

async function recordAssignmentHistory(input: {
  employeeId: string;
  branchId: string;
  departmentId: string | null;
  positionId: string | null;
  changedByAuthUserId: string;
}): Promise<void> {
  if (
    !process.env.DATABASE_URL ||
    process.env.HR_USE_MEMORY_REPO === "true" ||
    process.env.NODE_ENV === "test"
  ) {
    return;
  }
  const { writeEmployeeAssignmentHistory } = await import(
    "./employee-history"
  );
  await writeEmployeeAssignmentHistory(input);
}

export type EmployeeListInput = PageRequest & {
  search?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  employmentTypeId?: string | null;
  employeeStatusId?: string | null;
  isActive?: boolean | null;
};

export type EmployeeCreateData = {
  employeeCode?: string | null;
  branchId: string;
  employmentTypeId: string;
  employeeStatusId: string;
  /** OTP_VERIFICATION | INVITATION | NO_NOTIFICATION — defaults to NO_NOTIFICATION */
  onboardingMethodCode?: string | null;
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
  displayName?: string | null;
  phone: string;
  email?: string | null;
  photoUrl?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  hireDate: string | Date;
  probationEndDate?: string | Date | null;
  departmentId?: string | null;
  positionId?: string | null;
  notes?: string | null;
};

export type EmployeeUpdateData = Partial<
  Omit<EmployeeCreateData, "employeeCode">
> & {
  resignationDate?: string | Date | null;
  terminatedAt?: string | Date | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-() ]{6,20}$/;

function normalizeEmail(raw: string | null | undefined): string | null {
  const value = optionalText(raw, 320);
  if (!value) return null;
  if (!EMAIL_PATTERN.test(value)) {
    throw new HrError("VALIDATION_ERROR", { message: "รูปแบบอีเมลไม่ถูกต้อง" });
  }
  return value.toLowerCase();
}

function normalizePhone(raw: string): string {
  const value = requireText(raw, "เบอร์โทรศัพท์", 20);
  if (!PHONE_PATTERN.test(value)) {
    throw new HrError("VALIDATION_ERROR", {
      message: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง",
    });
  }
  return value;
}

function optionalDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  return toDateOnly(value);
}

/** Only structural rows that are still active may be attached to an employee. */
async function requireActiveDepartment(
  repository: HrRepository,
  ctx: HrServiceContext,
  departmentId: string,
): Promise<void> {
  const row = await repository.departments.findById(
    ctx.organizationId,
    departmentId,
  );
  if (!row) throw new HrError("NOT_FOUND", { details: { departmentId } });
  if (!row.isActive) {
    throw new HrError("INACTIVE_ENTITY", { details: { departmentId } });
  }
}

async function requireActivePosition(
  repository: HrRepository,
  ctx: HrServiceContext,
  positionId: string,
): Promise<void> {
  const row = await repository.positions.findById(
    ctx.organizationId,
    positionId,
  );
  if (!row) throw new HrError("NOT_FOUND", { details: { positionId } });
  if (!row.isActive) {
    throw new HrError("INACTIVE_ENTITY", { details: { positionId } });
  }
}

export async function listEmployees(
  repository: HrRepository,
  ctx: HrServiceContext,
  input: EmployeeListInput = {},
): Promise<PagedResponse<EmployeeRecord>> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeRead);
  const pagination = normalizePagination(input);
  const scope = resolveBranchScope(ctx, input.branchId);

  const result = await repository.employees.list({
    organizationId: ctx.organizationId,
    branchIds: scope.branchIds,
    branchId: scope.branchId,
    departmentId: input.departmentId ?? null,
    positionId: input.positionId ?? null,
    employmentTypeId: input.employmentTypeId ?? null,
    employeeStatusId: input.employeeStatusId ?? null,
    isActive: input.isActive ?? null,
    search: input.search ?? null,
    skip: pagination.skip,
    take: pagination.take,
  });

  return toPagedResponse(result, pagination);
}

export async function getEmployee(
  repository: HrRepository,
  ctx: HrServiceContext,
  employeeId: string,
): Promise<EmployeeRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeRead);
  const employee = await repository.employees.findById(
    ctx.organizationId,
    employeeId,
  );
  if (!employee) throw new HrError("NOT_FOUND", { details: { employeeId } });
  assertBranchInScope(ctx, employee.branchId);
  return employee;
}

export async function createEmployee(
  repository: HrRepository,
  ctx: HrServiceContext,
  data: EmployeeCreateData,
): Promise<EmployeeRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeCreate);

  const employeeCode = data.employeeCode?.trim()
    ? normalizeCode(data.employeeCode, "รหัสพนักงาน")
    : await nextEmployeeCode(repository, ctx.organizationId);
  const duplicate = await repository.employees.findByCode(
    ctx.organizationId,
    employeeCode,
  );
  if (duplicate) {
    throw new HrError("DUPLICATE_CODE", { details: { employeeCode } });
  }

  const branchId = requireText(data.branchId, "สาขา", 64);
  assertBranchInScope(ctx, branchId);

  await requireActiveMaster(repository, "employmentType", data.employmentTypeId);
  await requireActiveMaster(repository, "employeeStatus", data.employeeStatusId);

  if (data.departmentId) {
    await requireActiveDepartment(repository, ctx, data.departmentId);
  }
  if (data.positionId) {
    await requireActivePosition(repository, ctx, data.positionId);
  }

  const firstNameTh = requireText(data.firstNameTh, "ชื่อ (ไทย)", 100);
  const lastNameTh = requireText(data.lastNameTh, "นามสกุล (ไทย)", 100);

  const onboardingCode = (
    data.onboardingMethodCode?.trim() || "NO_NOTIFICATION"
  ).toUpperCase();
  const onboardingMethod = await requireMasterByCode(
    repository,
    "employeeOnboardingMethod",
    onboardingCode,
  );
  const notLinked = await requireMasterByCode(
    repository,
    "employeeAccountAccessStatus",
    "NOT_LINKED",
  );
  const pendingAccess = await requireMasterByCode(
    repository,
    "employeeAccountAccessStatus",
    "PENDING_ACTIVATION",
  );
  const accountAccessStatusId =
    onboardingCode === "NO_NOTIFICATION" ? notLinked.id : pendingAccess.id;

  const created = await repository.employees.create({
    organizationId: ctx.organizationId,
    employeeCode,
    platformUserId: null,
    authUserId: null,
    branchId,
    departmentId: data.departmentId ?? null,
    positionId: data.positionId ?? null,
    employmentTypeId: data.employmentTypeId,
    employeeStatusId: data.employeeStatusId,
    accountAccessStatusId,
    onboardingMethodId: onboardingMethod.id,
    accountActivatedAt: null,
    accountDisabledAt: null,
    firstNameTh,
    lastNameTh,
    firstNameEn: optionalText(data.firstNameEn, 100),
    lastNameEn: optionalText(data.lastNameEn, 100),
    displayName:
      optionalText(data.displayName, 200) ?? `${firstNameTh} ${lastNameTh}`,
    phone: normalizePhone(data.phone),
    email: normalizeEmail(data.email),
    photoUrl: optionalText(data.photoUrl, 2000),
    emergencyContactName: optionalText(data.emergencyContactName, 200),
    emergencyContactPhone: data.emergencyContactPhone ? normalizePhone(data.emergencyContactPhone) : null,
    hireDate: toDateOnly(data.hireDate),
    probationEndDate: optionalDate(data.probationEndDate),
    resignationDate: null,
    terminatedAt: null,
    notes: optionalText(data.notes, 2000),
    isActive: true,
    createdBy: ctx.actorAuthUserId,
    updatedBy: ctx.actorAuthUserId,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: created.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.employeeCreate,
    entityType: "employee",
    entityId: created.id,
    after: created,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  if (onboardingCode === "NO_NOTIFICATION") {
    await writeHrAudit(repository, {
      organizationId: ctx.organizationId,
      branchId: created.branchId,
      actorAuthUserId: ctx.actorAuthUserId,
      actionCode: HR_AUDIT_ACTIONS.employeeNoNotificationSelected,
      entityType: "employee",
      entityId: created.id,
      after: { onboardingMethodCode: onboardingCode },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  return created;
}

export async function updateEmployee(
  repository: HrRepository,
  ctx: HrServiceContext,
  employeeId: string,
  data: EmployeeUpdateData,
): Promise<EmployeeRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeUpdate);

  const before = await repository.employees.findById(
    ctx.organizationId,
    employeeId,
  );
  if (!before) throw new HrError("NOT_FOUND", { details: { employeeId } });
  assertBranchInScope(ctx, before.branchId);

  const patch: Parameters<HrRepository["employees"]["update"]>[1] = {
    updatedBy: ctx.actorAuthUserId,
  };

  if (data.branchId !== undefined) {
    const branchId = requireText(data.branchId, "สาขา", 64);
    assertBranchInScope(ctx, branchId);
    patch.branchId = branchId;
  }
  if (data.employmentTypeId !== undefined) {
    await requireActiveMaster(
      repository,
      "employmentType",
      data.employmentTypeId,
    );
    patch.employmentTypeId = data.employmentTypeId;
  }
  if (data.employeeStatusId !== undefined) {
    await requireActiveMaster(
      repository,
      "employeeStatus",
      data.employeeStatusId,
    );
    patch.employeeStatusId = data.employeeStatusId;
  }
  if (data.departmentId !== undefined) {
    if (data.departmentId) {
      await requireActiveDepartment(repository, ctx, data.departmentId);
    }
    patch.departmentId = data.departmentId ?? null;
  }
  if (data.positionId !== undefined) {
    if (data.positionId) {
      await requireActivePosition(repository, ctx, data.positionId);
    }
    patch.positionId = data.positionId ?? null;
  }
  if (data.firstNameTh !== undefined) {
    patch.firstNameTh = requireText(data.firstNameTh, "ชื่อ (ไทย)", 100);
  }
  if (data.lastNameTh !== undefined) {
    patch.lastNameTh = requireText(data.lastNameTh, "นามสกุล (ไทย)", 100);
  }
  if (data.firstNameEn !== undefined) {
    patch.firstNameEn = optionalText(data.firstNameEn, 100);
  }
  if (data.lastNameEn !== undefined) {
    patch.lastNameEn = optionalText(data.lastNameEn, 100);
  }
  if (data.displayName !== undefined) {
    patch.displayName = requireText(data.displayName, "ชื่อที่แสดง", 200);
  }
  if (data.phone !== undefined) {
    patch.phone = normalizePhone(data.phone);
  }
  if (data.email !== undefined) {
    patch.email = normalizeEmail(data.email);
  }
  if (data.photoUrl !== undefined) patch.photoUrl = optionalText(data.photoUrl, 2000);
  if (data.emergencyContactName !== undefined) patch.emergencyContactName = optionalText(data.emergencyContactName, 200);
  if (data.emergencyContactPhone !== undefined) patch.emergencyContactPhone = data.emergencyContactPhone ? normalizePhone(data.emergencyContactPhone) : null;
  if (data.hireDate !== undefined) {
    patch.hireDate = toDateOnly(data.hireDate);
  }
  if (data.probationEndDate !== undefined) {
    patch.probationEndDate = optionalDate(data.probationEndDate);
  }
  if (data.resignationDate !== undefined) {
    patch.resignationDate = optionalDate(data.resignationDate);
  }
  if (data.terminatedAt !== undefined) patch.terminatedAt = optionalDate(data.terminatedAt);
  if (data.notes !== undefined) {
    patch.notes = optionalText(data.notes, 2000);
  }

  let after = await repository.employees.update(employeeId, patch);

  if (
    after.branchId !== before.branchId &&
    after.platformUserId
  ) {
    try {
      const { syncPlatformHomeBranch } = await import(
        "@/lib/platform/sync-home-branch"
      );
      await syncPlatformHomeBranch({
        organizationId: ctx.organizationId,
        platformUserId: after.platformUserId,
        branchId: after.branchId,
        actorAuthUserId: ctx.actorAuthUserId,
      });
    } catch (error) {
      // Keep HR and Platform aligned: roll back the home-branch change.
      after = await repository.employees.update(employeeId, {
        branchId: before.branchId,
        updatedBy: ctx.actorAuthUserId,
      });
      throw error;
    }
  }

  if (
    after.branchId !== before.branchId ||
    after.departmentId !== before.departmentId ||
    after.positionId !== before.positionId
  ) {
    await recordAssignmentHistory({
      employeeId: after.id,
      branchId: after.branchId,
      departmentId: after.departmentId,
      positionId: after.positionId,
      changedByAuthUserId: ctx.actorAuthUserId,
    });
  }

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: after.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.employeeUpdate,
    entityType: "employee",
    entityId: after.id,
    before,
    after,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return after;
}

export async function deactivateEmployee(
  repository: HrRepository,
  ctx: HrServiceContext,
  employeeId: string,
  options: {
    employeeStatusCode?: string;
    resignationDate?: string | Date | null;
  } = {},
): Promise<EmployeeRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeDeactivate);

  const before = await repository.employees.findById(
    ctx.organizationId,
    employeeId,
  );
  if (!before) throw new HrError("NOT_FOUND", { details: { employeeId } });
  assertBranchInScope(ctx, before.branchId);
  await assertOwnerEmploymentGuard(ctx, before);

  const status = await requireMasterByCode(
    repository,
    "employeeStatus",
    options.employeeStatusCode ?? "INACTIVE",
  );

  const after = await repository.employees.update(employeeId, {
    isActive: false,
    employeeStatusId: status.id,
    resignationDate: optionalDate(options.resignationDate),
    updatedBy: ctx.actorAuthUserId,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: after.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.employeeDeactivate,
    entityType: "employee",
    entityId: after.id,
    before,
    after,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return after;
}

export async function reactivateEmployee(
  repository: HrRepository,
  ctx: HrServiceContext,
  employeeId: string,
  options: { employeeStatusCode?: string } = {},
): Promise<EmployeeRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeDeactivate);

  const before = await repository.employees.findById(
    ctx.organizationId,
    employeeId,
  );
  if (!before) throw new HrError("NOT_FOUND", { details: { employeeId } });
  assertBranchInScope(ctx, before.branchId);
  await assertOwnerEmploymentGuard(ctx, before);

  if (before.isActive) {
    return before;
  }

  const status = await requireMasterByCode(
    repository,
    "employeeStatus",
    options.employeeStatusCode ?? "ACTIVE",
  );

  const after = await repository.employees.update(employeeId, {
    isActive: true,
    employeeStatusId: status.id,
    resignationDate: null,
    terminatedAt: null,
    updatedBy: ctx.actorAuthUserId,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: after.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.employeeEmploymentReactivated,
    entityType: "employee",
    entityId: after.id,
    before,
    after,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return after;
}

/** Whether the current actor may show deactivate/reactivate for this employee. */
export async function canToggleEmployeeActive(
  ctx: HrServiceContext,
  employee: Pick<EmployeeRecord, "platformUserId" | "isActive">,
): Promise<boolean> {
  if (!hrCan(ctx, HR_PERMISSIONS.employeeDeactivate)) return false;
  const isOwner = await employeeHasOrganizationOwnerRole(
    ctx.organizationId,
    employee.platformUserId,
  );
  if (!isOwner) return true;
  return isGoldenSoftPlatformStaff(ctx);
}

export type LinkPlatformUserInput = {
  platformUserId: string;
  /** auth.users.id, when the person can already sign in. */
  authUserId?: string | null;
  /**
   * Organization the platform user actually belongs to, verified upstream by
   * the Platform API. Supplying a foreign organization is refused outright.
   */
  platformUserOrganizationId: string;
};

export async function linkPlatformUser(
  repository: HrRepository,
  ctx: HrServiceContext,
  employeeId: string,
  input: LinkPlatformUserInput,
): Promise<EmployeeRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeLinkUser);

  const anyOrg = await repository.employees.findByIdAnyOrganization(employeeId);
  if (anyOrg && anyOrg.organizationId !== ctx.organizationId) {
    throw new HrError("CROSS_ORG_LINK", { details: { employeeId } });
  }
  if (!anyOrg) throw new HrError("NOT_FOUND", { details: { employeeId } });

  const before = anyOrg;
  assertBranchInScope(ctx, before.branchId);

  if (input.platformUserOrganizationId !== ctx.organizationId) {
    throw new HrError("CROSS_ORG_LINK", {
      details: { platformUserId: input.platformUserId },
    });
  }

  const taken = await repository.employees.findByPlatformUserId(
    ctx.organizationId,
    input.platformUserId,
  );
  if (taken && taken.id !== employeeId && taken.isActive) {
    throw new HrError("DUPLICATE_PLATFORM_USER", {
      details: { platformUserId: input.platformUserId },
    });
  }

  if (input.authUserId) {
    const authTaken = await repository.employees.findByAuthUserId(
      ctx.organizationId,
      input.authUserId,
      { activeOnly: true },
    );
    if (authTaken && authTaken.id !== employeeId) {
      throw new HrError("DUPLICATE_AUTH_USER", {
        details: { authUserId: input.authUserId },
      });
    }
  }

  const activeAccess = await requireMasterByCode(
    repository,
    "employeeAccountAccessStatus",
    "ACTIVE",
  );

  const after = await repository.employees.update(employeeId, {
    platformUserId: input.platformUserId,
    authUserId: input.authUserId ?? null,
    accountAccessStatusId: activeAccess.id,
    accountActivatedAt: new Date(),
    accountDisabledAt: null,
    updatedBy: ctx.actorAuthUserId,
  });

  try {
    const { syncPlatformHomeBranch } = await import(
      "@/lib/platform/sync-home-branch"
    );
    await syncPlatformHomeBranch({
      organizationId: ctx.organizationId,
      platformUserId: after.platformUserId!,
      branchId: after.branchId,
      actorAuthUserId: ctx.actorAuthUserId,
    });
  } catch (error) {
    await repository.employees.update(employeeId, {
      platformUserId: before.platformUserId,
      authUserId: before.authUserId,
      updatedBy: ctx.actorAuthUserId,
    });
    throw error;
  }

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: after.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.employeeLinkUser,
    entityType: "employee",
    entityId: after.id,
    before,
    after,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: after.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.employeeAuthLinked,
    entityType: "employee",
    entityId: after.id,
    after: {
      authUserId: after.authUserId,
      platformUserId: after.platformUserId,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: after.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.employeeAccountActivated,
    entityType: "employee",
    entityId: after.id,
    after: { accountAccessStatusId: after.accountAccessStatusId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return after;
}

export async function unlinkPlatformUser(
  repository: HrRepository,
  ctx: HrServiceContext,
  employeeId: string,
): Promise<EmployeeRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeLinkUser);

  const before = await repository.employees.findById(
    ctx.organizationId,
    employeeId,
  );
  if (!before) throw new HrError("NOT_FOUND", { details: { employeeId } });
  assertBranchInScope(ctx, before.branchId);

  const notLinked = await requireMasterByCode(
    repository,
    "employeeAccountAccessStatus",
    "NOT_LINKED",
  );

  const after = await repository.employees.update(employeeId, {
    platformUserId: null,
    authUserId: null,
    accountAccessStatusId: notLinked.id,
    accountDisabledAt: new Date(),
    updatedBy: ctx.actorAuthUserId,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: after.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.employeeUnlinkUser,
    entityType: "employee",
    entityId: after.id,
    before,
    after,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: after.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.employeeAuthUnlinked,
    entityType: "employee",
    entityId: after.id,
    before: { authUserId: before.authUserId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return after;
}

export async function resignEmployee(
  repository: HrRepository,
  ctx: HrServiceContext,
  employeeId: string,
  resignationDate: string | Date,
): Promise<EmployeeRecord> {
  return deactivateEmployee(repository, ctx, employeeId, {
    employeeStatusCode: "RESIGNED",
    resignationDate,
  });
}

export async function terminateEmployee(
  repository: HrRepository,
  ctx: HrServiceContext,
  employeeId: string,
): Promise<EmployeeRecord> {
  const employee = await deactivateEmployee(repository, ctx, employeeId, {
    employeeStatusCode: "TERMINATED",
  });
  return repository.employees.update(employeeId, {
    terminatedAt: new Date(),
    updatedBy: ctx.actorAuthUserId,
  });
}
