import { jsonResponse, requireHrApi, withHrApi } from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { unlinkPlatformUser } from "@/lib/hr/services/employees";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeLinkUser,
    });
    const employee = await unlinkPlatformUser(repository, service, id);
    return jsonResponse({ employee });
  });
}
