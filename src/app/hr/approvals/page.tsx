import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import AdjustmentApprovalList from "@/components/hr/adjustment-approval-list";
import LeaveApprovalCards from "@/components/hr/leave-approval-cards";
import OvertimeApprovalList from "@/components/hr/overtime-approval-list";
import HrShell from "@/components/hr-shell";
import { getApprovalInbox } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const ctx = await requireHrPage({
    permission: [
      HR_PERMISSIONS.approvalRead,
      HR_PERMISSIONS.leaveApprove,
      HR_PERMISSIONS.overtimeApprove,
      HR_PERMISSIONS.attendanceManage,
    ],
  });
  const canLeave = canHr(ctx, HR_PERMISSIONS.leaveApprove);
  const canOt = canHr(ctx, HR_PERMISSIONS.overtimeApprove);
  const canAdjust = canHr(ctx, [
    HR_PERMISSIONS.attendanceManage,
    HR_PERMISSIONS.approvalManage,
  ]);
  const inbox = await getApprovalInbox(ctx);
  const leaveCount = inbox.data.leave.length;
  const otCount = inbox.data.overtime.length;
  const adjustCount = inbox.data.attendanceAdjustments.length;
  const total = leaveCount + otCount + adjustCount;

  return (
    <HrShell ctx={ctx}>
      <DatabaseUnavailableNotice message={inbox.message} />

      <header className="hr-schedule-hero hr-leave-hero">
        <h1 className="hr-schedule-hero-title">รายการอนุมัติ</h1>
        <p className="hr-leave-hero-lead">
          คิวกลางสำหรับลา OT และปรับปรุงเวลา — รออนุมัติ {total} รายการ
        </p>
      </header>

      <section className="hr-ot-requests" aria-label="คำขอลารออนุมัติ">
        <div className="hr-shift-board-head">
          <h2>
            <span aria-hidden="true">✉</span> คำขอลา
          </h2>
          <span className="hr-shift-board-count">{leaveCount}</span>
        </div>
        <LeaveApprovalCards
          rows={inbox.data.leave}
          canApprove={canLeave}
          emptyMessage="ไม่มีคำขอลารออนุมัติ"
        />
      </section>

      <OvertimeApprovalList
        rows={inbox.data.overtime}
        canApprove={canOt}
        showHero={false}
        sectionTitle="คำขอ OT"
        emptyMessage="ไม่มีคำขอ OT รออนุมัติ"
      />

      <AdjustmentApprovalList
        rows={inbox.data.attendanceAdjustments}
        canApprove={canAdjust}
        showHero={false}
        sectionTitle="ปรับปรุงเวลา"
        emptyMessage="ไม่มีคำขอปรับปรุงเวลารออนุมัติ"
      />
    </HrShell>
  );
}
