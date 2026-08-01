import MeFaceEnrollWorkspace from "@/components/hr/me-face-enroll-workspace";
import HrShell from "@/components/hr-shell";
import { getSelfFaceMatchStatus } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { SelfFaceMatchStatus } from "@/lib/hr/services/face-matching";

export const dynamic = "force-dynamic";

const FALLBACK: SelfFaceMatchStatus = {
  mode: "OFF",
  matchThreshold: 0.55,
  enrolled: false,
  enrolledAt: null,
  photoUrl: null,
  requireDescriptor: false,
};

export default async function MeFacePage() {
  const ctx = await requireHrPage({
    permission: HR_PERMISSIONS.attendanceSelf,
  });
  const status = await getSelfFaceMatchStatus(ctx);

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>ลงทะเบียนใบหน้า</h1>
          <p>ใช้จับคู่ตอนลงเวลาเข้า–ออกงาน</p>
        </div>
      </div>
      <MeFaceEnrollWorkspace initial={status.data ?? FALLBACK} />
    </HrShell>
  );
}
