import {
  jsonResponse,
  parseJsonBody,
  requireHrApi,
  withHrApi,
} from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { employeeReactivateSchema } from "@/lib/hr/schemas";
import { reactivateEmployee } from "@/lib/hr/services/employees";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const body = await parseJsonBody(request, employeeReactivateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeDeactivate,
    });
    const employee = await reactivateEmployee(repository, service, id, body);
    return jsonResponse({ employee });
  });
}
