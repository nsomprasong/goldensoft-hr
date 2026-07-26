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
import { departmentCreateSchema } from "@/lib/hr/schemas";
import {
  createDepartment,
  listDepartments,
} from "@/lib/hr/services/departments";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const { service, repository } = await requireHrApi(request);
    const pagination = readPagination(request);
    const result = await listDepartments(repository, service, {
      ...pagination,
      search: readSearchParam(request, "search"),
      isActive: readBooleanParam(request, "isActive"),
    });
    return jsonResponse(result);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const body = await parseJsonBody(request, departmentCreateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.departmentManage,
    });
    const department = await createDepartment(repository, service, body);
    return jsonResponse({ department }, 201);
  });
}
