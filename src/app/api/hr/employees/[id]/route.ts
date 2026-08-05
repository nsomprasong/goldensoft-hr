import {
  jsonResponse,
  parseJsonBody,
  requireHrApi,
  withHrApi,
} from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { employeeUpdateSchema } from "@/lib/hr/schemas";
import { getEmployee, updateEmployee } from "@/lib/hr/services/employees";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeRead,
    });
    const employee = await getEmployee(repository, service, id);
    return jsonResponse({ employee });
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const body = await parseJsonBody(request, employeeUpdateSchema);
    const { ctx, service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeUpdate,
      branchId: body.branchId ?? null,
    });
    const employee = await updateEmployee(repository, service, id, body);
    if (body.roleId && body.roleAssignmentSource !== "KEEP_EXISTING") {
      const { assignEmployeeRole, getEmployeeRoleState, revokeEmployeeRole } = await import("@/lib/hr/services/employee-roles");
      const roleState = await getEmployeeRoleState(ctx, service, id);
      if (roleState.membershipId) {
        for (const assigned of roleState.assigned) {
          if (assigned.roleId !== body.roleId) await revokeEmployeeRole(ctx, service, id, assigned.membershipRoleId);
        }
        if (!roleState.assigned.some((assigned) => assigned.roleId === body.roleId)) await assignEmployeeRole(ctx, service, id, body.roleId);
      }
      const { recordEmployeeRoleAssignment } = await import("@/lib/hr/services/employee-role-assignments");
      await recordEmployeeRoleAssignment(repository, service, { employeeId: id, roleId: body.roleId, source: body.roleAssignmentSource ?? "MANUAL_ASSIGNMENT", positionId: body.positionId ?? employee.positionId });
    }
    return jsonResponse({ employee });
  });
}
