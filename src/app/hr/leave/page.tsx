import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import LeaveApprovalCards from "@/components/hr/leave-approval-cards";
import HrShell from "@/components/hr-shell";
import { listLeaveRequests } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.leaveRead });
  const list = await listLeaveRequests(ctx);
  const canApprove = canHr(ctx, HR_PERMISSIONS.leaveApprove);

  return (
    <HrShell ctx={ctx}>
      <DatabaseUnavailableNotice message={list.message} />

      <header className="hr-schedule-hero hr-leave-hero">
        <h1 className="hr-schedule-hero-title">การลา</h1>
        <p className="hr-leave-hero-lead">
          คำขอลาของพนักงานและสถานะการอนุมัติ — {list.data.length} รายการ
        </p>
      </header>

      <section className="hr-ot-requests" aria-label="คำขอลา">
        <div className="hr-shift-board-head">
          <h2>
            <span aria-hidden="true">✉</span> คำขอลา
          </h2>
          <span className="hr-shift-board-count">{list.data.length}</span>
        </div>
        <LeaveApprovalCards rows={list.data} canApprove={canApprove} />
      </section>
    </HrShell>
  );
}
