import AttendanceDayWorkspace from "@/components/hr/attendance-day-workspace";
import HrShell from "@/components/hr-shell";
import { showEmployeeBranchLabel } from "@/lib/hr/api";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.attendanceRead });
  const showBranchLabel = showEmployeeBranchLabel(ctx);
  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>เวลาทำงาน</h1>
          <p>สรุปการลงเวลาของพนักงานรายวัน พร้อมรูปหลักฐาน</p>
        </div>
      </div>
      <AttendanceDayWorkspace showBranchLabel={showBranchLabel} />
    </HrShell>
  );
}
