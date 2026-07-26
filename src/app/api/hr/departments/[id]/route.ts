import {
  jsonResponse,
  parseJsonBody,
  requireHrApi,
  withHrApi,
} from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { departmentUpdateSchema } from "@/lib/hr/schemas";
import {
  deactivateDepartment,
  getDepartment,
  updateDepartment,
} from "@/lib/hr/services/departments";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request);
    const department = await getDepartment(repository, service, id);
    return jsonResponse({ department });
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const body = await parseJsonBody(request, departmentUpdateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.departmentManage,
    });
    const department = await updateDepartment(repository, service, id, body);
    return jsonResponse({ department });
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.departmentManage,
    });
    const department = await deactivateDepartment(repository, service, id);
    return jsonResponse({ department });
  });
}
