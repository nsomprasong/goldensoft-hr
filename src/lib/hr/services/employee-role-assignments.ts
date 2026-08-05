import { prisma } from "@/lib/prisma";
import { assertHrPermission } from "@/lib/hr/authorize";
import { HR_AUDIT_ACTIONS, writeHrAudit } from "@/lib/hr/audit";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { HrRepository } from "@/lib/hr/repository/types";
import type { HrServiceContext } from "@/lib/hr/services/shared";
import { assertPositionVisibleInContext } from "@/lib/hr/services/positions";

export type EmployeeRoleChoice = "POSITION_RECOMMENDATION" | "MANUAL_ASSIGNMENT" | "KEEP_EXISTING";

export async function recordEmployeeRoleAssignment(repository: HrRepository, ctx: HrServiceContext, input: {
  employeeId: string; roleId: string; source: EmployeeRoleChoice; positionId?: string | null;
}) {
  assertHrPermission(ctx, [HR_PERMISSIONS.employeeRoleAssign, HR_PERMISSIONS.employeeCreate, HR_PERMISSIONS.employeeUpdate]);
  const employee = await repository.employees.findById(ctx.organizationId, input.employeeId);
  if (!employee) throw new HrError("NOT_FOUND", { message: "ไม่พบพนักงาน" });
  if (ctx.branchId && employee.branchId !== ctx.branchId) throw new HrError("BRANCH_OUT_OF_SCOPE");
  const role = await prisma.$queryRaw<Array<{ id: string; name_th: string }>>`
    SELECT id::text, name_th FROM platform.organization_roles
    WHERE id=${input.roleId}::uuid AND is_active=true
      AND ((organization_id IS NULL AND is_system=true) OR organization_id=${ctx.organizationId}::uuid)
    LIMIT 1
  `;
  if (!role[0]) throw new HrError("CROSS_ORG_LINK", { message: "ไม่สามารถกำหนดบทบาทขององค์กรอื่นให้พนักงานได้" });
  if (input.positionId) {
    const position = await repository.positions.findById(ctx.organizationId, input.positionId);
    if (!position) throw new HrError("BRANCH_OUT_OF_SCOPE");
    assertPositionVisibleInContext(ctx, position);
    if (position.branchId && position.branchId !== employee.branchId) throw new HrError("BRANCH_OUT_OF_SCOPE");
  }
  const source = await prisma.employeeRoleAssignmentSource.findUnique({ where: { code: input.source } });
  if (!source) throw new HrError("INTERNAL_ERROR", { message: "ไม่พบที่มาของการกำหนดบทบาท" });
  const before = await prisma.employeeRoleAssignment.findMany({ where: { organizationId: ctx.organizationId, employeeId: employee.id, isActive: true }, select: { organizationRoleId: true } });
  await prisma.$transaction(async (tx) => {
    await tx.employeeRoleAssignment.updateMany({ where: { organizationId: ctx.organizationId, employeeId: employee.id, isActive: true }, data: { isActive: false, revokedAt: new Date() } });
    await tx.employeeRoleAssignment.create({ data: {
      organizationId: ctx.organizationId, branchId: employee.branchId, employeeId: employee.id,
      organizationRoleId: input.roleId, sourcePositionId: input.positionId ?? null, assignmentSourceId: source.id,
      isPrimary: true, isActive: true, assignedBy: ctx.actorAuthUserId,
    } });
  });
  await writeHrAudit(repository, { organizationId: ctx.organizationId, branchId: employee.branchId, actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.employeeRoleChoice, entityType: "employee", entityId: employee.id,
    before: { roleIds: before.map((row) => row.organizationRoleId) }, after: { roleId: input.roleId, source: input.source, positionId: input.positionId ?? null },
  });
}
