import { jsonResponse, requireHrApi, withHrApi } from "@/lib/hr/api";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import {
  createEmployeeDocument,
  listEmployeeDocuments,
} from "@/lib/hr/services/employee-documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeRead,
    });
    const documents = await listEmployeeDocuments(service, id);
    return jsonResponse({ documents });
  });
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeUpdate,
    });

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      throw new HrError("VALIDATION_ERROR", {
        message: "กรุณาอัปโหลดเป็น multipart/form-data",
      });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new HrError("VALIDATION_ERROR", {
        message: "กรุณาเลือกไฟล์เอกสาร",
      });
    }

    const title = String(form.get("title") ?? "").trim() || file.name;
    const category = String(form.get("category") ?? "OTHER").trim() || "OTHER";
    const buffer = Buffer.from(await file.arrayBuffer());

    const document = await createEmployeeDocument(service, id, {
      title,
      category,
      buffer,
      originalName: file.name || title,
      contentType: file.type || null,
    });
    return jsonResponse({ document }, 201);
  });
}
