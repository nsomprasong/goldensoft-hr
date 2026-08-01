import { jsonResponse, requireHrApi, withHrApi } from "@/lib/hr/api";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import {
  deleteEmployeeDocument,
  getEmployeeDocumentFile,
} from "@/lib/hr/services/employee-documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; docId: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id, docId } = await context.params;
    const { service } = await requireHrApi(request, {
      permission: [
        HR_PERMISSIONS.employeeRead,
        HR_PERMISSIONS.advanceSelf,
      ],
    });
    const file = await getEmployeeDocumentFile(service, id, docId);
    const disposition = request.url.includes("download=1")
      ? `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
      : `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`;
    return new Response(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "content-type": file.contentType,
        "content-disposition": disposition,
        "cache-control": "private, max-age=120",
      },
    });
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id, docId } = await context.params;
    const { service } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeUpdate,
    });
    await deleteEmployeeDocument(service, id, docId);
    return jsonResponse({ ok: true });
  });
}
