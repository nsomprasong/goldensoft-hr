import { prisma } from "@/lib/prisma";
import { assertHrPermission } from "@/lib/hr/authorize";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { HrServiceContext } from "@/lib/hr/services/shared";

export type OrganizationRoleOption = {
  id: string;
  name: string;
  description: string | null;
  typeLabel: "บทบาทมาตรฐาน" | "บทบาทขององค์กร";
  permissionCount: number;
};

/** Organization-safe role picker. Platform roles live in another table and can never appear here. */
export async function listOrganizationRoleOptions(ctx: HrServiceContext): Promise<OrganizationRoleOption[]> {
  assertHrPermission(ctx, [HR_PERMISSIONS.positionManage, HR_PERMISSIONS.employeeRead, HR_PERMISSIONS.employeeUpdate]);
  const rows = await prisma.$queryRaw<Array<{
    id: string; name_th: string; description: string | null; is_system: boolean; permission_count: number;
  }>>`
    SELECT r.id::text, r.name_th, r.description, r.is_system,
      COUNT(DISTINCT rp.permission_id)::int AS permission_count
    FROM platform.organization_roles r
    LEFT JOIN platform.organization_role_permissions rp ON rp.organization_role_id=r.id AND rp.revoked_at IS NULL
    LEFT JOIN platform.permissions p ON p.id=rp.permission_id AND p.is_active=true
    WHERE r.is_active=true
      AND ((r.organization_id IS NULL AND r.is_system=true) OR r.organization_id=${ctx.organizationId}::uuid)
      AND NOT EXISTS (
        SELECT 1 FROM platform.organization_role_permissions denied_rp
        JOIN platform.permissions denied_p ON denied_p.id=denied_rp.permission_id AND denied_p.is_active=true
        WHERE denied_rp.organization_role_id=r.id AND denied_rp.revoked_at IS NULL
          AND denied_p.product_code NOT IN ('PLATFORM','GOLDENSOFT_HR')
          AND NOT EXISTS (
            SELECT 1 FROM platform.entitlements e
            JOIN platform.products product ON product.id=e.product_id
            JOIN platform.entitlement_statuses es ON es.id=e.status_id
            WHERE e.organization_id=${ctx.organizationId}::uuid AND product.code=denied_p.product_code
              AND es.code='ACTIVE' AND (e.ends_at IS NULL OR e.ends_at>CURRENT_TIMESTAMP)
          )
      )
    GROUP BY r.id, r.name_th, r.description, r.is_system, r.sort_order
    ORDER BY r.is_system DESC, r.sort_order, r.name_th
  `;
  return rows.map((row) => ({
    id: row.id, name: row.name_th, description: row.description,
    typeLabel: row.is_system ? "บทบาทมาตรฐาน" : "บทบาทขององค์กร",
    permissionCount: Number(row.permission_count),
  }));
}
