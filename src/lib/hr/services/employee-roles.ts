import { prisma } from "@/lib/prisma";
import {
  assertBranchInScope,
  assertHrPermission,
  hrCan,
} from "@/lib/hr/authorize";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { HrRequestContext } from "@/lib/platform/types";
import type { HrServiceContext } from "@/lib/hr/services/shared";

export type EmployeeRoleOption = {
  id: string;
  label: string;
};

export type EmployeeAssignedRole = {
  membershipRoleId: string;
  roleId: string;
  label: string;
  code: string;
};

export type EmployeeRoleState = {
  linked: boolean;
  membershipId: string | null;
  assigned: EmployeeAssignedRole[];
  available: EmployeeRoleOption[];
  canAssign: boolean;
  /** True when actor may assign/revoke OWNER or ADMIN. */
  canAssignPrivileged: boolean;
};

const PRIVILEGED_ROLE_CODES = new Set(["OWNER", "ADMIN"]);

/** Who may assign/revoke non-privileged roles (needs employee.update). */
function canAssignRoles(service: HrServiceContext): boolean {
  return hrCan(service, HR_PERMISSIONS.employeeRoleAssign) || hrCan(service, HR_PERMISSIONS.employeeUpdate);
}

/** OWNER/ADMIN (and platform admin) may assign privileged org roles. */
function canAssignPrivilegedRoles(ctx: HrRequestContext): boolean {
  if (ctx.contextMode === "platform_admin") return true;
  return ctx.permissions.includes(HR_PERMISSIONS.employeeRoleAssignPrivileged);
}

async function requireEmployee(
  ctx: HrServiceContext,
  employeeId: string,
): Promise<{ id: string; branchId: string; platformUserId: string | null }> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; branch_id: string; platform_user_id: string | null }>
  >`
    SELECT
      id::text AS id,
      branch_id::text AS branch_id,
      platform_user_id::text AS platform_user_id
    FROM hr.employees
    WHERE id = ${employeeId}::uuid
      AND organization_id = ${ctx.organizationId}::uuid
    LIMIT 1
  `;
  const employee = rows[0];
  if (!employee) throw new HrError("NOT_FOUND", { message: "ไม่พบพนักงาน" });
  assertBranchInScope(ctx, employee.branch_id);
  return {
    id: employee.id,
    branchId: employee.branch_id,
    platformUserId: employee.platform_user_id,
  };
}

async function assignmentStatusId(code: "ACTIVE" | "REVOKED"): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id::text AS id
    FROM platform.assignment_statuses
    WHERE code = ${code}
    LIMIT 1
  `;
  const id = rows[0]?.id;
  if (!id) {
    throw new HrError("INTERNAL_ERROR", {
      message: `ไม่พบสถานะการกำหนดบทบาท ${code}`,
    });
  }
  return id;
}

export async function getEmployeeRoleState(
  pageCtx: HrRequestContext,
  service: HrServiceContext,
  employeeId: string,
): Promise<EmployeeRoleState> {
  assertHrPermission(service, HR_PERMISSIONS.employeeRead);
  const employee = await requireEmployee(service, employeeId);
  const canAssign = canAssignRoles(service);

  const availableRows = await prisma.$queryRaw<
    Array<{ id: string; code: string; name_th: string }>
  >`
    SELECT id::text AS id, code, name_th
    FROM platform.organization_roles
    WHERE is_active = true
      AND (
        (organization_id IS NULL AND is_system = true)
        OR organization_id = ${service.organizationId}::uuid
      )
    ORDER BY sort_order ASC, name_th ASC
  `;
  const allowPrivileged = canAssignPrivilegedRoles(pageCtx);
  const available = availableRows
    .filter(
      (row) =>
        allowPrivileged || !PRIVILEGED_ROLE_CODES.has(row.code.toUpperCase()),
    )
    .map((row) => ({
      id: row.id,
      label: row.name_th,
    }));

  if (!employee.platformUserId) {
    return {
      linked: false,
      membershipId: null,
      assigned: [],
      available,
      canAssign: false,
      canAssignPrivileged: allowPrivileged,
    };
  }

  const membershipRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT om.id::text AS id
    FROM platform.organization_memberships om
    JOIN platform.membership_statuses ms ON ms.id = om.status_id
    WHERE om.organization_id = ${service.organizationId}::uuid
      AND om.user_profile_id = ${employee.platformUserId}::uuid
      AND ms.code = 'ACTIVE'
      AND om.ended_at IS NULL
    LIMIT 1
  `;
  const membershipId = membershipRows[0]?.id ?? null;
  if (!membershipId) {
    return {
      linked: true,
      membershipId: null,
      assigned: [],
      available,
      canAssign: false,
      canAssignPrivileged: allowPrivileged,
    };
  }

  const assignedRows = await prisma.$queryRaw<
    Array<{
      membership_role_id: string;
      role_id: string;
      code: string;
      name_th: string;
    }>
  >`
    SELECT
      omr.id::text AS membership_role_id,
      r.id::text AS role_id,
      r.code,
      r.name_th
    FROM platform.organization_membership_roles omr
    JOIN platform.organization_roles r ON r.id = omr.role_id
    JOIN platform.assignment_statuses ast ON ast.id = omr.status_id
    WHERE omr.membership_id = ${membershipId}::uuid
      AND omr.revoked_at IS NULL
      AND ast.code = 'ACTIVE'
    ORDER BY r.sort_order ASC, r.name_th ASC
  `;

  const assignedIds = new Set(assignedRows.map((row) => row.role_id));

  return {
    linked: true,
    membershipId,
    assigned: assignedRows.map((row) => ({
      membershipRoleId: row.membership_role_id,
      roleId: row.role_id,
      label: row.name_th,
      code: row.code,
    })),
    available: available.filter((role) => !assignedIds.has(role.id)),
    canAssign,
    canAssignPrivileged: allowPrivileged,
  };
}

export async function assignEmployeeRole(
  pageCtx: HrRequestContext,
  service: HrServiceContext,
  employeeId: string,
  roleId: string,
): Promise<{ ok: true }> {
  assertHrPermission(service, [HR_PERMISSIONS.employeeRoleAssign, HR_PERMISSIONS.employeeUpdate]);
  if (!canAssignRoles(service)) {
    throw new HrError("FORBIDDEN", { message: "ไม่มีสิทธิ์กำหนดบทบาท" });
  }

  const state = await getEmployeeRoleState(pageCtx, service, employeeId);
  if (!state.membershipId) {
    throw new HrError("VALIDATION_ERROR", {
      message: "พนักงานยังไม่มีสมาชิกภาพบนแพลตฟอร์ม",
    });
  }

  const roleRows = await prisma.$queryRaw<Array<{ id: string; code: string }>>`
    SELECT id::text AS id, code
    FROM platform.organization_roles
    WHERE id = ${roleId}::uuid
      AND is_active = true
      AND (
        (organization_id IS NULL AND is_system = true)
        OR organization_id = ${service.organizationId}::uuid
      )
    LIMIT 1
  `;
  if (!roleRows[0]) {
    throw new HrError("NOT_FOUND", { message: "ไม่พบบทบาท" });
  }
  if (
    PRIVILEGED_ROLE_CODES.has(roleRows[0].code.toUpperCase()) &&
    !canAssignPrivilegedRoles(pageCtx)
  ) {
    throw new HrError("FORBIDDEN", {
      message: "ไม่มีสิทธิ์กำหนดบทบาทเจ้าของหรือแอดมิน",
    });
  }

  const activeId = await assignmentStatusId("ACTIVE");
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id::text AS id
    FROM platform.organization_membership_roles
    WHERE membership_id = ${state.membershipId}::uuid
      AND role_id = ${roleId}::uuid
    ORDER BY assigned_at DESC
    LIMIT 1
  `;

  if (existing[0]) {
    await prisma.$executeRaw`
      UPDATE platform.organization_membership_roles
      SET revoked_at = NULL,
          status_id = ${activeId}::uuid,
          assigned_at = CURRENT_TIMESTAMP
      WHERE id = ${existing[0].id}::uuid
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO platform.organization_membership_roles (
        membership_id, role_id, status_id
      ) VALUES (
        ${state.membershipId}::uuid,
        ${roleId}::uuid,
        ${activeId}::uuid
      )
    `;
  }

  return { ok: true };
}

export async function revokeEmployeeRole(
  pageCtx: HrRequestContext,
  service: HrServiceContext,
  employeeId: string,
  membershipRoleId: string,
): Promise<{ ok: true }> {
  assertHrPermission(service, [HR_PERMISSIONS.employeeRoleAssign, HR_PERMISSIONS.employeeUpdate]);
  if (!canAssignRoles(service)) {
    throw new HrError("FORBIDDEN", { message: "ไม่มีสิทธิ์ถอดบทบาท" });
  }
  await requireEmployee(service, employeeId);

  const row = await prisma.$queryRaw<
    Array<{ id: string; role_code: string; organization_id: string }>
  >`
    SELECT
      omr.id::text AS id,
      r.code AS role_code,
      om.organization_id::text AS organization_id
    FROM platform.organization_membership_roles omr
    JOIN platform.organization_roles r ON r.id = omr.role_id
    JOIN platform.organization_memberships om ON om.id = omr.membership_id
    WHERE omr.id = ${membershipRoleId}::uuid
      AND omr.revoked_at IS NULL
      AND om.organization_id = ${service.organizationId}::uuid
    LIMIT 1
  `;
  if (!row[0]) {
    throw new HrError("NOT_FOUND", { message: "ไม่พบการกำหนดบทบาท" });
  }
  if (
    PRIVILEGED_ROLE_CODES.has(row[0].role_code.toUpperCase()) &&
    !canAssignPrivilegedRoles(pageCtx)
  ) {
    throw new HrError("FORBIDDEN", {
      message: "ไม่มีสิทธิ์ถอดบทบาทเจ้าของหรือแอดมิน",
    });
  }

  if (row[0].role_code === "OWNER") {
    const owners = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*)::int AS count
      FROM platform.organization_membership_roles omr
      JOIN platform.organization_roles r ON r.id = omr.role_id
      JOIN platform.organization_memberships om ON om.id = omr.membership_id
      JOIN platform.assignment_statuses ast ON ast.id = omr.status_id
      WHERE om.organization_id = ${service.organizationId}::uuid
        AND r.code = 'OWNER'
        AND omr.revoked_at IS NULL
        AND ast.code = 'ACTIVE'
    `;
    if (Number(owners[0]?.count ?? 0) <= 1) {
      throw new HrError("VALIDATION_ERROR", {
        message: "ไม่สามารถถอดเจ้าขององค์กรคนสุดท้ายได้",
      });
    }
  }

  const revokedId = await assignmentStatusId("REVOKED");
  await prisma.$executeRaw`
    UPDATE platform.organization_membership_roles
    SET revoked_at = CURRENT_TIMESTAMP,
        status_id = ${revokedId}::uuid
    WHERE id = ${membershipRoleId}::uuid
  `;

  return { ok: true };
}
