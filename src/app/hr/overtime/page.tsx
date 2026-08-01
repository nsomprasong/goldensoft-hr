import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import OvertimeApprovalList from "@/components/hr/overtime-approval-list";
import HrShell from "@/components/hr-shell";
import { listOvertimeRequests } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function OvertimePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.overtimeRead });
  const list = await listOvertimeRequests(ctx);
  const canApprove = canHr(ctx, HR_PERMISSIONS.overtimeApprove);

  return (
    <HrShell ctx={ctx}>
      <DatabaseUnavailableNotice message={list.message} />
      <OvertimeApprovalList rows={list.data} canApprove={canApprove} />
    </HrShell>
  );
}
