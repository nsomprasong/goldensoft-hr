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
import { positionCreateSchema } from "@/lib/hr/schemas";
import { createPosition, listPositions } from "@/lib/hr/services/positions";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const { service, repository } = await requireHrApi(request);
    const pagination = readPagination(request);
    const result = await listPositions(repository, service, {
      ...pagination,
      search: readSearchParam(request, "search"),
      departmentId: readSearchParam(request, "departmentId"),
      isActive: readBooleanParam(request, "isActive"),
    });
    return jsonResponse(result);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const body = await parseJsonBody(request, positionCreateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.positionManage,
    });
    const position = await createPosition(repository, service, body);
    return jsonResponse({ position }, 201);
  });
}
