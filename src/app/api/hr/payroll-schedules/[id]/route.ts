import {
  jsonResponse,
  parseJsonBody,
  requireHrApi,
  withHrApi,
} from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { payrollScheduleUpdateSchema } from "@/lib/hr/schemas";
import {
  getPayrollSchedule,
  updatePayrollSchedule,
} from "@/lib/hr/services/payroll-schedules";

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
        HR_PERMISSIONS.payrollScheduleRead,
        HR_PERMISSIONS.payrollScheduleManage,
      ],
    });
    const payrollSchedule = await getPayrollSchedule(repository, service, id);
    return jsonResponse({ payrollSchedule });
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const body = await parseJsonBody(request, payrollScheduleUpdateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.payrollScheduleManage,
    });
    const payrollSchedule = await updatePayrollSchedule(
      repository,
      service,
      id,
      body,
    );
    return jsonResponse({ payrollSchedule });
  });
}
