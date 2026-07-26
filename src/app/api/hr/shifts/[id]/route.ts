import {
  jsonResponse,
  parseJsonBody,
  requireHrApi,
  withHrApi,
} from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { shiftUpdateSchema } from "@/lib/hr/schemas";
import {
  deactivateShift,
  getShift,
  updateShift,
} from "@/lib/hr/services/shifts";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request, {
      permission: [HR_PERMISSIONS.shiftRead, HR_PERMISSIONS.shiftManage],
    });
    const shift = await getShift(repository, service, id);
    return jsonResponse({ shift });
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const body = await parseJsonBody(request, shiftUpdateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.shiftManage,
      branchId: body.branchId ?? null,
    });
    const shift = await updateShift(repository, service, id, body);
    return jsonResponse({ shift });
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.shiftManage,
    });
    const shift = await deactivateShift(repository, service, id);
    return jsonResponse({ shift });
  });
}
