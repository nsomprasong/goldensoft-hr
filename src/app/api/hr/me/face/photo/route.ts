import { requireHrApi, withHrApi } from "@/lib/hr/api";
import { HrError } from "@/lib/hr/errors";
import { readFaceEnrollmentPhoto } from "@/lib/hr/face-enrollment-photos";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { getSelfFaceMatchStatus } from "@/lib/hr/services/face-matching";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const { service } = await requireHrApi(request, {
      permission: HR_PERMISSIONS.attendanceSelf,
    });
    const status = await getSelfFaceMatchStatus(service);
    if (!status.enrolled) {
      throw new HrError("NOT_FOUND", { message: "ยังไม่ได้ลงทะเบียนใบหน้า" });
    }

    const employee = await prisma.employee.findFirst({
      where: {
        organizationId: service.organizationId,
        authUserId: service.actorAuthUserId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!employee) {
      throw new HrError("NOT_FOUND", {
        message: "ไม่พบข้อมูลพนักงานที่เชื่อมต่อ",
      });
    }

    const photo = await readFaceEnrollmentPhoto({
      organizationId: service.organizationId,
      employeeId: employee.id,
    });
    if (!photo) {
      throw new HrError("NOT_FOUND", { message: "ไม่พบรูปใบหน้าที่ลงทะเบียน" });
    }

    return new Response(new Uint8Array(photo.buffer), {
      status: 200,
      headers: {
        "content-type": photo.contentType,
        "cache-control": "private, max-age=120",
      },
    });
  });
}
