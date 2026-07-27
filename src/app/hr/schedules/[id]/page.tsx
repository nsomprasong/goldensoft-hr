import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import DeleteSchedulePeriodButton from "@/components/hr/delete-schedule-period-button";
import PublishScheduleButton from "@/components/hr/publish-schedule-button";
import ScheduleComposer from "@/components/hr/schedule-composer";
import HrShell from "@/components/hr-shell";
import {
  getSchedulePeriod,
  listScheduleComposerOptions,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import { formatThaiDate, formatThaiDateRange } from "@/lib/hr/thai-date";

export const dynamic = "force-dynamic";

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.scheduleRead });
  const { id } = await params;
  const [result, options] = await Promise.all([
    getSchedulePeriod(ctx, id),
    listScheduleComposerOptions(ctx),
  ]);
  const period = result.data?.period ?? null;
  const assignments = result.data?.assignments ?? [];
  const canManage = canHr(ctx, HR_PERMISSIONS.scheduleManage);
  const canPublish = canHr(ctx, HR_PERMISSIONS.schedulePublish);
  const locked = period?.statusCode === "LOCKED";
  const unavailable = result.message || options.message;

  return (
    <HrShell ctx={ctx} active="schedules">
      <div className="hr-page-head">
        <div>
          <h1>{period?.name ?? "ตารางกะงาน"}</h1>
          <p>
            {period
              ? `${formatThaiDateRange(period.periodStart, period.periodEnd)} · ${period.statusName}`
              : `ช่วงตาราง ${id}`}
          </p>
        </div>
        <span className="inline-actions">
          <Link className="btn btn-sm" href="/hr/schedules">
            กลับ
          </Link>
          {canPublish && period ? (
            <PublishScheduleButton
              scheduleId={period.id}
              statusCode={period.statusCode}
              disabled={!result.available}
            />
          ) : null}
          {canManage && period ? (
            <DeleteSchedulePeriodButton
              scheduleId={period.id}
              name={period.name}
              statusCode={period.statusCode}
              disabled={!result.available}
            />
          ) : null}
        </span>
      </div>

      <DatabaseUnavailableNotice message={unavailable} />

      {!period && result.available ? (
        <p className="empty">ไม่พบตารางนี้</p>
      ) : null}

      {period ? (
        <section className="card">
          <h2>รายการกะ ({assignments.length})</h2>
          {assignments.length === 0 ? (
            <p className="empty">ยังไม่มีรายการกะในตารางนี้</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>พนักงาน</th>
                    <th>กะงาน</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((row) => (
                    <tr key={row.id}>
                      <td className="nowrap">{formatThaiDate(row.workDate)}</td>
                      <td>{row.employeeLabel}</td>
                      <td>{row.shiftLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {period && canManage && !locked ? (
        <div style={{ marginTop: "1rem" }}>
          <ScheduleComposer
            mode="add"
            scheduleId={period.id}
            lockedPeriod={{
              periodStart: period.periodStart,
              periodEnd: period.periodEnd,
              name: period.name,
            }}
            employees={options.data.employees}
            shifts={options.data.shifts}
            disabled={!result.available || !options.available}
          />
        </div>
      ) : null}

      {period && locked ? (
        <p className="muted" style={{ marginTop: "1rem" }}>
          ตารางถูกล็อกแล้ว แก้ไขหรือเพิ่มกะไม่ได้
        </p>
      ) : null}
    </HrShell>
  );
}
