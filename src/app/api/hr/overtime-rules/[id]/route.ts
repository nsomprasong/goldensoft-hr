import {
  jsonResponse,
  parseJsonBody,
  requireHrApi,
  withHrApi,
} from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { overtimeRuleUpdateSchema } from "@/lib/hr/schemas";
import {
  deactivateOvertimeRule,
  getOvertimeRule,
  updateOvertimeRule,
} from "@/lib/hr/services/overtime-rules";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request);
    const overtimeRule = await getOvertimeRule(repository, service, id);
    return jsonResponse({ overtimeRule });
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const body = await parseJsonBody(request, overtimeRuleUpdateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.settingsManage,
    });
    const overtimeRule = await updateOvertimeRule(
      repository,
      service,
      id,
      body,
    );
    return jsonResponse({ overtimeRule });
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.settingsManage,
    });
    const overtimeRule = await deactivateOvertimeRule(repository, service, id);
    return jsonResponse({ overtimeRule });
  });
}
