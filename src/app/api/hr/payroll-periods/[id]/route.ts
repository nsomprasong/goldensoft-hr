import {
  jsonResponse,
  parseJsonBody,
  requireHrApi,
  withHrApi,
} from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { payrollPeriodUpdateSchema } from "@/lib/hr/schemas";
import {
  getPayrollPeriod,
  updatePayrollPeriodStatus,
} from "@/lib/hr/services/payroll-periods";

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
        HR_PERMISSIONS.payrollPeriodRead,
        HR_PERMISSIONS.payrollPeriodManage,
      ],
    });
    const payrollPeriod = await getPayrollPeriod(repository, service, id);
    return jsonResponse({ payrollPeriod });
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const body = await parseJsonBody(request, payrollPeriodUpdateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.payrollPeriodManage,
    });
    const payrollPeriod = await updatePayrollPeriodStatus(
      repository,
      service,
      id,
      body.statusCode,
    );
    return jsonResponse({ payrollPeriod });
  });
}
