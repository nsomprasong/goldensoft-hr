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
import { shiftCreateSchema } from "@/lib/hr/schemas";
import { createShift, listShifts } from "@/lib/hr/services/shifts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const { service, repository } = await requireHrApi(request, {
      permission: [HR_PERMISSIONS.shiftRead, HR_PERMISSIONS.shiftManage],
    });
    const pagination = readPagination(request);
    const result = await listShifts(repository, service, {
      ...pagination,
      search: readSearchParam(request, "search"),
      branchId: readSearchParam(request, "branchId"),
      isActive: readBooleanParam(request, "isActive"),
    });
    return jsonResponse(result);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const body = await parseJsonBody(request, shiftCreateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.shiftManage,
      branchId: body.branchId ?? null,
    });
    const shift = await createShift(repository, service, body);
    return jsonResponse({ shift }, 201);
  });
}
