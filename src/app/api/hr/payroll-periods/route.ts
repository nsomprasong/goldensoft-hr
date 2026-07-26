import {
  jsonResponse,
  parseJsonBody,
  readPagination,
  readSearchParam,
  requireHrApi,
  withHrApi,
} from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { payrollPeriodCreateSchema } from "@/lib/hr/schemas";
import {
  createPayrollPeriod,
  generatePayrollPeriods,
  listPayrollPeriods,
} from "@/lib/hr/services/payroll-periods";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const { service, repository } = await requireHrApi(request, {
      permission: [
        HR_PERMISSIONS.payrollPeriodRead,
        HR_PERMISSIONS.payrollPeriodManage,
      ],
    });
    const pagination = readPagination(request);
    const statusCodes = readSearchParam(request, "statusCodes");
    const result = await listPayrollPeriods(repository, service, {
      ...pagination,
      payrollScheduleId: readSearchParam(request, "payrollScheduleId"),
      statusCodes: statusCodes ? statusCodes.split(",") : null,
    });
    return jsonResponse(result);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const body = await parseJsonBody(request, payrollPeriodCreateSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.payrollPeriodManage,
    });

    if ("year" in body) {
      const generated = await generatePayrollPeriods(repository, service, body);
      return jsonResponse(generated, 201);
    }

    const payrollPeriod = await createPayrollPeriod(repository, service, body);
    return jsonResponse({ payrollPeriod }, 201);
  });
}
