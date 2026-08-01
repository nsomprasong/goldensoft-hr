import { jsonResponse, parseJsonBody, requireHrApi, withHrApi } from "@/lib/hr/api";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import {
  assignEmployeeRole,
  getEmployeeRoleState,
  revokeEmployeeRole,
} from "@/lib/hr/services/employee-roles";
import { z } from "zod";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  action: z.enum(["assign", "revoke"]),
  roleId: z.string().uuid().optional(),
  membershipRoleId: z.string().uuid().optional(),
});

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { ctx, service } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeRead,
    });
    const state = await getEmployeeRoleState(ctx, service, id);
    return jsonResponse(state);
  });
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const body = await parseJsonBody(request, bodySchema);
    const { ctx, service } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeUpdate,
    });

    if (body.action === "assign") {
      if (!body.roleId) {
        throw new HrError("VALIDATION_ERROR", { message: "ต้องเลือกบทบาท" });
      }
      await assignEmployeeRole(ctx, service, id, body.roleId);
      return jsonResponse({ ok: true });
    }

    if (!body.membershipRoleId) {
      throw new HrError("VALIDATION_ERROR", {
        message: "ต้องระบุบทบาทที่จะถอด",
      });
    }
    await revokeEmployeeRole(ctx, service, id, body.membershipRoleId);
    return jsonResponse({ ok: true });
  });
}
