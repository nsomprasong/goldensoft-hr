import { jsonResponse, requireHrApi, withHrApi } from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { getHrDashboard } from "@/lib/hr/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeRead,
    });
    const branchId = new URL(request.url).searchParams.get("branchId");
    const dashboard = await getHrDashboard(repository, service, { branchId });
    return jsonResponse({ dashboard });
  });
}
