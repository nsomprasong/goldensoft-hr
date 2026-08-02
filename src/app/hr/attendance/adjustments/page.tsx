import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import AdjustmentApprovalList from "@/components/hr/adjustment-approval-list";
import HrShell from "@/components/hr-shell";
import { showEmployeeBranchLabel } from "@/lib/hr/api";
import { listAttendanceAdjustments } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function AttendanceAdjustmentsPage() {
  const ctx = await requireHrPage({
    permission: [
      HR_PERMISSIONS.attendanceRead,
      HR_PERMISSIONS.attendanceManage,
    ],
  });
  const list = await listAttendanceAdjustments(ctx);
  const canApprove = canHr(ctx, [
    HR_PERMISSIONS.attendanceManage,
    HR_PERMISSIONS.approvalManage,
  ]);
  const showBranchLabel = showEmployeeBranchLabel(ctx);

  return (
    <HrShell ctx={ctx}>
      <DatabaseUnavailableNotice message={list.message} />
      <AdjustmentApprovalList
        rows={list.data}
        canApprove={canApprove}
        showBranchLabel={showBranchLabel}
      />
    </HrShell>
  );
}
