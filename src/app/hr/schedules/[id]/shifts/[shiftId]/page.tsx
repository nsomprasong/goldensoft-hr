import { notFound, redirect } from "next/navigation";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import ScheduleShiftWorkspace from "@/components/hr/schedule-shift-workspace";
import HrShell from "@/components/hr-shell";
import { schedulesHrefForBranch } from "@/lib/hr/branch-nav";
import { getScheduleShiftBoard } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import { formatThaiDateRange } from "@/lib/hr/thai-date";

export const dynamic = "force-dynamic";

export default async function ScheduleShiftPage({
  params,
}: {
  params: Promise<{ id: string; shiftId: string }>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.scheduleRead });
  const { id, shiftId } = await params;
  const board = await getScheduleShiftBoard(ctx, id, shiftId);
  const data = board.data;
  const canManage = canHr(ctx, HR_PERMISSIONS.scheduleManage);
  const locked = data?.period.statusCode === "LOCKED";

  // Header branch changed away from this period's branch → go to that branch's list.
  if (
    board.message === "BRANCH_OUT_OF_SCOPE" ||
    (ctx.branchId &&
      data?.period.branchId &&
      data.period.branchId !== ctx.branchId)
  ) {
    redirect(schedulesHrefForBranch(ctx.branchId));
  }

  if (board.available && !data) {
    notFound();
  }

  return (
    <HrShell ctx={ctx} active="schedules">
      <header className="hr-schedule-hero">
        <div className="hr-schedule-hero-top">
          <a
            className="hr-schedule-hero-back"
            href={`/hr/schedules/${id}`}
            aria-label="กลับช่วงตาราง"
          >
            ←
          </a>
        </div>

        <h1 className="hr-schedule-hero-title">
          {data?.shift.name ?? "จัดพนักงานในกะ"}
        </h1>

        {data ? (
          <div className="hr-schedule-hero-chips" aria-label="ข้อมูลกะ">
            <span className="hr-schedule-hero-chip" title="ช่วงตาราง">
              <span aria-hidden="true">📅</span>
              {formatThaiDateRange(
                data.period.periodStart,
                data.period.periodEnd,
              )}
            </span>
            <span className="hr-schedule-hero-chip" title="เวลา">
              <span aria-hidden="true">⏱</span>
              {data.shift.timeLabel}
            </span>
            {locked ? (
              <span
                className="hr-schedule-hero-chip hr-schedule-hero-chip--locked"
                title="ถูกล็อก"
              >
                <span aria-hidden="true">🔒</span>
                ล็อก
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      <DatabaseUnavailableNotice message={board.message} />

      {data ? (
        <ScheduleShiftWorkspace
          scheduleId={data.period.id}
          shiftId={data.shift.id}
          shiftName={data.shift.name}
          shiftTimeLabel={data.shift.timeLabel}
          periodStart={data.period.periodStart}
          periodEnd={data.period.periodEnd}
          locked={Boolean(locked)}
          canManage={canManage}
          onShift={data.onShift}
          unassignedEmployees={data.unassigned}
          otherShifts={data.otherShifts}
          employeeOptions={data.employeeOptions}
          available={board.available}
        />
      ) : null}
    </HrShell>
  );
}
