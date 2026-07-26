import {
  jsonResponse,
  parseJsonBody,
  requireHrApi,
  withHrApi,
} from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { linkPlatformUserSchema } from "@/lib/hr/schemas";
import { linkPlatformUser } from "@/lib/hr/services/employees";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const body = await parseJsonBody(request, linkPlatformUserSchema);
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeLinkUser,
    });

    // The tenant is taken from the verified context, never from the payload —
    // a link can only ever be made inside the caller's own organization.
    const employee = await linkPlatformUser(repository, service, id, {
      platformUserId: body.platformUserId,
      authUserId: body.authUserId ?? null,
      platformUserOrganizationId: service.organizationId,
    });

    return jsonResponse({ employee });
  });
}
