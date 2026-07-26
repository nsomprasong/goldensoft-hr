import {
  jsonResponse,
  parseJsonBody,
  requireHrApi,
  withHrApi,
} from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { compensationCreateSchema } from "@/lib/hr/schemas";
import {
  addCompensation,
  listCompensations,
} from "@/lib/hr/services/compensations";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request, {
      permission: [
        HR_PERMISSIONS.compensationRead,
        HR_PERMISSIONS.compensationManage,
      ],
    });
    const compensations = await listCompensations(repository, service, id);
    return jsonResponse({ compensations });
  });
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const body = await parseJsonBody(request, compensationCreateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.compensationManage,
    });
    const compensation = await addCompensation(repository, service, id, body);
    return jsonResponse({ compensation }, 201);
  });
}
