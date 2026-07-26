import {
  jsonResponse,
  parseJsonBody,
  readBooleanParam,
  readPagination,
  requireHrApi,
  withHrApi,
} from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { payrollScheduleCreateSchema } from "@/lib/hr/schemas";
import {
  createPayrollSchedule,
  listPayrollSchedules,
} from "@/lib/hr/services/payroll-schedules";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const { service, repository } = await requireHrApi(request, {
      permission: [
        HR_PERMISSIONS.payrollScheduleRead,
        HR_PERMISSIONS.payrollScheduleManage,
      ],
    });
    const pagination = readPagination(request);
    const result = await listPayrollSchedules(repository, service, {
      ...pagination,
      isActive: readBooleanParam(request, "isActive"),
    });
    return jsonResponse(result);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const body = await parseJsonBody(request, payrollScheduleCreateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.payrollScheduleManage,
    });
    const payrollSchedule = await createPayrollSchedule(
      repository,
      service,
      body,
    );
    return jsonResponse({ payrollSchedule }, 201);
  });
}
