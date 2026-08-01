import { jsonResponse, requireHrApi, withHrApi } from "@/lib/hr/api";
import { readAttendancePhoto } from "@/lib/hr/attendance-photos";
import { HrError } from "@/lib/hr/errors";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import { resolveSelfEmployee } from "@/lib/hr/services/operations";
import { prisma } from "@/lib/prisma";

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
      permission: [
        HR_PERMISSIONS.attendanceRead,
        HR_PERMISSIONS.attendanceSelf,
      ],
    });

    const event = await prisma.attendanceEvent.findFirst({
      where: { id, organizationId: service.organizationId },
      select: { id: true, employeeId: true, organizationId: true },
    });
    if (!event) {
      throw new HrError("NOT_FOUND", { message: "ไม่พบรายการลงเวลา" });
    }

    if (!canHr(service, HR_PERMISSIONS.attendanceRead)) {
      const self = await resolveSelfEmployee(service);
      if (self.id !== event.employeeId) {
        throw new HrError("FORBIDDEN", { message: "ไม่มีสิทธิ์ดูรูปนี้" });
      }
    }

    const photo = await readAttendancePhoto({
      organizationId: event.organizationId,
      eventId: event.id,
    });
    if (!photo) {
      throw new HrError("NOT_FOUND", { message: "ยังไม่มีรูปหลักฐาน" });
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

/** Keep Next happy if something POSTs here by mistake. */
export async function POST(): Promise<Response> {
  return jsonResponse(
    { error: { code: "METHOD_NOT_ALLOWED", message: "ใช้การลงเวลาเพื่อแนบรูป" } },
    405,
  );
}
