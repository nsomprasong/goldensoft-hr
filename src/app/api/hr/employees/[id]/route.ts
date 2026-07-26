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
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeUpdate,
      branchId: body.branchId ?? null,
    });
    const employee = await updateEmployee(repository, service, id, body);
    return jsonResponse({ employee });
  });
}
