import {
  jsonResponse,
  parseJsonBody,
  readBooleanParam,
  readPagination,
  readSearchParam,
  requireHrApi,
  withHrApi,
} from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { overtimeRuleCreateSchema } from "@/lib/hr/schemas";
import {
  createOvertimeRule,
  listOvertimeRules,
} from "@/lib/hr/services/overtime-rules";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const { service, repository } = await requireHrApi(request);
    const pagination = readPagination(request);
    const result = await listOvertimeRules(repository, service, {
      ...pagination,
      search: readSearchParam(request, "search"),
      isActive: readBooleanParam(request, "isActive"),
    });
    return jsonResponse(result);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const body = await parseJsonBody(request, overtimeRuleCreateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.settingsManage,
    });
    const overtimeRule = await createOvertimeRule(repository, service, body);
    return jsonResponse({ overtimeRule }, 201);
  });
}
