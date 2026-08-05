import { prisma } from "@/lib/prisma";
import { assertHrPermission } from "@/lib/hr/authorize";
import { HR_AUDIT_ACTIONS, writeHrAudit } from "@/lib/hr/audit";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { HrRepository } from "@/lib/hr/repository/types";
import type { HrServiceContext } from "@/lib/hr/services/shared";
import { assertPositionVisibleInContext } from "@/lib/hr/services/positions";

export async function setPositionPrimaryRole(
  repository: HrRepository,
  ctx: HrServiceContext,
  positionId: string,
  organizationRoleId: string | null,
) {
  assertHrPermission(ctx, HR_PERMISSIONS.positionManage);
  const position = await repository.positions.findById(ctx.organizationId, positionId);
  if (!position) throw new HrError("NOT_FOUND");
  assertPositionVisibleInContext(ctx, position);
  if (position.isSystemStandard) throw new HrError("FORBIDDEN", { message: "ตำแหน่งมาตรฐานแก้บทบาทได้จากส่วนกลางเท่านั้น" });

  const before = await prisma.$queryRaw<Array<{ organization_role_id: string }>>`
    SELECT organization_role_id::text FROM hr.position_roles
    WHERE position_id=${positionId}::uuid AND is_primary=true
  `;
  if (organizationRoleId) {
    const visibleRole = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id::text FROM platform.organization_roles
      WHERE id=${organizationRoleId}::uuid AND is_active=true
        AND (organization_id IS NULL OR organization_id=${ctx.organizationId}::uuid)
    `;
    if (!visibleRole[0]) throw new HrError("CROSS_ORG_LINK", { message: "ไม่สามารถผูกตำแหน่งกับบทบาทขององค์กรอื่นได้" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM hr.position_roles WHERE position_id=${positionId}::uuid AND is_primary=true`;
    if (organizationRoleId) {
      await tx.$executeRaw`INSERT INTO hr.position_roles (id,position_id,organization_role_id,is_primary,created_at,updated_at) VALUES (gen_random_uuid(),${positionId}::uuid,${organizationRoleId}::uuid,true,now(),now()) ON CONFLICT (position_id,organization_role_id) DO UPDATE SET is_primary=true,updated_at=now()`;
    }
    await tx.position.update({ where: { id: positionId }, data: { defaultRoleId: organizationRoleId } });
  });

  const affectedEmployees = await prisma.employee.count({ where: { organizationId: ctx.organizationId, positionId, isActive: true } });
  await writeHrAudit(repository, {
    organizationId: ctx.organizationId, branchId: ctx.branchId, actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.positionRoleChange, entityType: "position", entityId: positionId,
    before: { organizationRoleId: before[0]?.organization_role_id ?? null },
    after: { organizationRoleId, affectedEmployees },
  });
  return { organizationRoleId, affectedEmployees };
}
