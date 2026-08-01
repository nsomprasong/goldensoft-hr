import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import DeleteSchedulePeriodButton from "@/components/hr/delete-schedule-period-button";
import ScheduleDetailWorkspace from "@/components/hr/schedule-detail-workspace";
import HrShell from "@/components/hr-shell";
import {
  getSchedulePeriod,
  listOrganizationBranches,
  listScheduleComposerOptions,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import { formatThaiDateRange } from "@/lib/hr/thai-date";

export const dynamic = "force-dynamic";

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.scheduleRead });
  const { id } = await params;
  const [result, options, branches] = await Promise.all([
    getSchedulePeriod(ctx, id),
    listScheduleComposerOptions(ctx, { shiftsOnly: true }),
    listOrganizationBranches(ctx),
  ]);
  const period = result.data?.period ?? null;
  const periodShifts = result.data?.periodShifts ?? [];
  const canManage = canHr(ctx, HR_PERMISSIONS.scheduleManage);
  const canPublish = canHr(ctx, HR_PERMISSIONS.schedulePublish);
  const locked = period?.statusCode === "LOCKED";
  const unavailable = result.message || options.message;
  const branchLabel =
    (period?.branchId &&
      branches.data.find((row) => row.id === period.branchId)?.label) ||
    null;
  const backHref = period?.branchId
    ? `/hr/schedules?branchId=${encodeURIComponent(period.branchId)}`
    : "/hr/schedules";

  const statusClass =
    period?.statusCode === "PUBLISHED"
      ? "hr-schedule-hero-chip hr-schedule-hero-chip--ok"
      : period?.statusCode === "LOCKED"
        ? "hr-schedule-hero-chip hr-schedule-hero-chip--locked"
        : "hr-schedule-hero-chip";

  return (
    <HrShell ctx={ctx} active="schedules">
      <header className="hr-schedule-hero">
        <div className="hr-schedule-hero-top">
          <a className="hr-schedule-hero-back" href={backHref} aria-label="กลับ">
            ←
          </a>
          <div className="hr-schedule-hero-actions">
            {canManage && period ? (
              <DeleteSchedulePeriodButton
                scheduleId={period.id}
                name={period.name}
                statusCode={period.statusCode}
                disabled={!result.available}
              />
            ) : null}
          </div>
        </div>

        <h1 className="hr-schedule-hero-title">
          {period
            ? formatThaiDateRange(period.periodStart, period.periodEnd)
            : "ตารางกะงาน"}
        </h1>

        {period ? (
          <div className="hr-schedule-hero-chips" aria-label="ข้อมูลช่วงตาราง">
            {branchLabel ? (
              <span className="hr-schedule-hero-chip" title="สาขา">
                <span aria-hidden="true">📍</span>
                {branchLabel}
              </span>
            ) : null}
            <span className={statusClass} title="สถานะ">
              <span aria-hidden="true">
                {period.statusCode === "PUBLISHED"
                  ? "●"
                  : period.statusCode === "LOCKED"
                    ? "🔒"
                    : "○"}
              </span>
              {period.statusName}
            </span>
          </div>
        ) : (
          <p className="muted">ช่วงตาราง {id}</p>
        )}
      </header>

      <DatabaseUnavailableNotice message={unavailable} />

      {!period && result.available ? (
        <p className="empty">ไม่พบตารางนี้</p>
      ) : null}

      {period && !period.branchId ? (
        <p className="empty">ช่วงตารางนี้ยังไม่มีสาขา — สร้างใหม่โดยเลือกสาขาก่อน</p>
      ) : null}

      {period && period.branchId ? (
        <ScheduleDetailWorkspace
          scheduleId={period.id}
          periodName={period.name}
          periodStart={period.periodStart}
          periodEnd={period.periodEnd}
          statusCode={period.statusCode}
          statusName={period.statusName}
          locked={locked}
          canManage={canManage}
          canPublish={canPublish}
          periodShifts={periodShifts}
          shifts={options.data.shifts}
          available={result.available && options.available}
        />
      ) : null}
    </HrShell>
  );
}
