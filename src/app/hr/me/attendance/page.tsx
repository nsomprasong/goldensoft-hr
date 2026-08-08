import MeAttendanceWorkspace from "@/components/hr/me-attendance-workspace";
import HrPageBackButton from "@/components/hr/hr-page-back-button";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function MyAttendancePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.attendanceSelf });
  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>ลงเวลาของฉัน</h1>
          <p>ถ่ายรูป · ตรวจ GPS · บันทึกเข้า–ออกงาน</p>
        </div>
        <HrPageBackButton href="/hr" />
      </div>
      <MeAttendanceWorkspace />
    </HrShell>
  );
}
