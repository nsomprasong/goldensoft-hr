import { z } from "zod";
import { jsonResponse, parseJsonBody, requireHrApi, withHrApi } from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { setPositionPrimaryRole } from "@/lib/hr/services/position-roles";
import { getPosition } from "@/lib/hr/services/positions";

const schema = z.object({ organizationRoleId: z.string().uuid().nullable() });
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request, { permission: HR_PERMISSIONS.positionManage });
    const position = await getPosition(repository, service, id);
    const affectedEmployees = await repository.employees.list({ organizationId: service.organizationId, positionId: id, branchId: service.branchId, skip: 0, take: 1 });
    return jsonResponse({ organizationRoleId: position.defaultRoleId ?? null, affectedEmployees: affectedEmployees.total });
  });
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const body = await parseJsonBody(request, schema);
    const { service, repository } = await requireHrApi(request, { permission: HR_PERMISSIONS.positionManage });
    return jsonResponse(await setPositionPrimaryRole(repository, service, id, body.organizationRoleId));
  });
}
