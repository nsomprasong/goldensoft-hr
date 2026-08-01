import { mkdir } from "node:fs/promises";
import path from "node:path";

import { jsonResponse, requireHrApi, withHrApi } from "@/lib/hr/api";
import { HrError } from "@/lib/hr/errors";
import {
  deleteEmployeePhoto,
  readEmployeePhoto,
  saveEmployeePhoto,
  employeePhotoPublicPath,
} from "@/lib/hr/employee-photos";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { getEmployee, updateEmployee } from "@/lib/hr/services/employees";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function photoError(code: string): HrError {
  if (code === "PHOTO_TOO_LARGE") {
    return new HrError("VALIDATION_ERROR", {
      message: "ไฟล์รูปใหญ่เกิน 2.5 MB",
    });
  }
  if (code === "UNSUPPORTED_PHOTO_TYPE") {
    return new HrError("VALIDATION_ERROR", {
      message: "รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ GIF",
    });
  }
  if (code === "EMPTY_PHOTO") {
    return new HrError("VALIDATION_ERROR", {
      message: "ไม่พบข้อมูลรูปภาพ",
    });
  }
  return new HrError("VALIDATION_ERROR", { message: "อัปโหลดรูปไม่สำเร็จ" });
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeRead,
    });
    const employee = await getEmployee(repository, service, id);
    const photo = await readEmployeePhoto({
      organizationId: service.organizationId,
      employeeId: employee.id,
    });
    if (!photo) {
      throw new HrError("NOT_FOUND", { message: "ยังไม่มีรูปพนักงาน" });
    }
    return new Response(new Uint8Array(photo.buffer), {
      status: 200,
      headers: {
        "content-type": photo.contentType,
        "cache-control": "private, max-age=300",
      },
    });
  });
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeUpdate,
    });
    const employee = await getEmployee(repository, service, id);

    const contentType = request.headers.get("content-type") ?? "";
    let buffer: Buffer;
    let declaredType: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("photo");
      if (!(file instanceof File)) {
        throw new HrError("VALIDATION_ERROR", {
          message: "กรุณาเลือกรูปจากกล้องหรือไฟล์",
        });
      }
      declaredType = file.type || null;
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = (await request.json().catch(() => null)) as {
        imageBase64?: string;
        contentType?: string;
      } | null;
      const raw = body?.imageBase64?.trim() ?? "";
      const match = /^data:([^;]+);base64,(.+)$/s.exec(raw);
      const b64 = match?.[2] ?? (raw.includes(",") ? raw.split(",")[1] : raw);
      if (!b64) {
        throw new HrError("VALIDATION_ERROR", {
          message: "กรุณาเลือกรูปจากกล้องหรือไฟล์",
        });
      }
      declaredType = match?.[1] ?? body?.contentType ?? null;
      buffer = Buffer.from(b64, "base64");
    }

    await mkdir(
      path.join(process.cwd(), "storage", "employee-photos", service.organizationId),
      { recursive: true },
    );

    let saved;
    try {
      saved = await saveEmployeePhoto({
        organizationId: service.organizationId,
        employeeId: employee.id,
        buffer,
        contentType: declaredType,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      throw photoError(code);
    }

    const updated = await updateEmployee(repository, service, employee.id, {
      photoUrl: `${saved.photoUrl}?v=${Date.now()}`,
    });

    return jsonResponse({
      ok: true,
      photoUrl: updated.photoUrl ?? employeePhotoPublicPath(employee.id),
      employee: updated,
    });
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withHrApi(async () => {
    const { id } = await context.params;
    const { service, repository } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.employeeUpdate,
    });
    const employee = await getEmployee(repository, service, id);
    await deleteEmployeePhoto({
      organizationId: service.organizationId,
      employeeId: employee.id,
    });
    const updated = await updateEmployee(repository, service, employee.id, {
      photoUrl: null,
    });
    return jsonResponse({ ok: true, employee: updated });
  });
}
