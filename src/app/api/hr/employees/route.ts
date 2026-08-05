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
import {
  employeeCreateSchema,
} from "@/lib/hr/schemas";
import { createEmployee, listEmployees } from "@/lib/hr/services/employees";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeRead,
    });
    const pagination = readPagination(request);

    const result = await listEmployees(repository, service, {
      ...pagination,
      search: readSearchParam(request, "search"),
      branchId: readSearchParam(request, "branchId"),
      departmentId: readSearchParam(request, "departmentId"),
      positionId: readSearchParam(request, "positionId"),
      employmentTypeId: readSearchParam(request, "employmentTypeId"),
      employeeStatusId: readSearchParam(request, "employeeStatusId"),
      isActive: readBooleanParam(request, "isActive"),
    });

    return jsonResponse(result);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const body = await parseJsonBody(request, employeeCreateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeCreate,
      branchId: body.branchId,
    });

    const created = await createEmployee(repository, service, body);
    if (body.roleId) {
      const { recordEmployeeRoleAssignment } = await import("@/lib/hr/services/employee-role-assignments");
      await recordEmployeeRoleAssignment(repository, service, { employeeId: created.id, roleId: body.roleId, source: body.roleAssignmentSource ?? "MANUAL_ASSIGNMENT", positionId: body.positionId });
    }
    return jsonResponse({ employee: created }, 201);
  });
}
