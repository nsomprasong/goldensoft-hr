import {
  jsonResponse,
  parseJsonBody,
  requireHrApi,
  withHrApi,
} from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { positionUpdateSchema } from "@/lib/hr/schemas";
import {
  deactivatePosition,
  getPosition,
  updatePosition,
} from "@/lib/hr/services/positions";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request);
    const position = await getPosition(repository, service, id);
    return jsonResponse({ position });
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const body = await parseJsonBody(request, positionUpdateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.positionManage,
    });
    const position = await updatePosition(repository, service, id, body);
    return jsonResponse({ position });
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.positionManage,
    });
    const position = await deactivatePosition(repository, service, id);
    return jsonResponse({ position });
  });
}
