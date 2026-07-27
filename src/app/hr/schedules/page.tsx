import DeleteSchedulePeriodButton from "@/components/hr/delete-schedule-period-button";
import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import ScheduleComposer from "@/components/hr/schedule-composer";
import HrShell from "@/components/hr-shell";
import {
  listScheduleComposerOptions,
  listSchedulePeriods,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import { formatThaiDateRange } from "@/lib/hr/thai-date";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SchedulesPage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.scheduleRead });
  const [periods, options] = await Promise.all([
    listSchedulePeriods(ctx),
    listScheduleComposerOptions(ctx),
  ]);
  const canManage = canHr(ctx, HR_PERMISSIONS.scheduleManage);
  const canPublish = canHr(ctx, HR_PERMISSIONS.schedulePublish);
  const unavailable = periods.message || options.message;

  return (
    <HrShell ctx={ctx} active="schedules">
      <div className="hr-page-head">
        <div>
          <h1>ตารางกะงาน</h1>
          <p>จัดตารางจบในขั้นตอนเดียว — เลือกวัน กะ และพนักงาน แล้วบันทึก</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={unavailable} />

      {canManage ? (
        <ScheduleComposer
          employees={options.data.employees}
          shifts={options.data.shifts}
          canPublish={canPublish}
          disabled={!periods.available || !options.available}
        />
      ) : (
        <p className="muted">คุณมีสิทธิ์ดูตารางเท่านั้น ไม่สามารถจัดตารางได้</p>
      )}

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>ตารางที่มีอยู่</h2>
        {periods.data.length === 0 ? (
          <p className="empty">ยังไม่มีตารางกะงาน</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ช่วงวัน</th>
                  <th>สถานะ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {periods.data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div>{row.name}</div>
                      <div className="muted nowrap">
                        {row.code} ·{" "}
                        {formatThaiDateRange(row.periodStart, row.periodEnd)}
                      </div>
                    </td>
                    <td>{row.statusName}</td>
                    <td>
                      <span className="inline-actions">
                        <Link
                          className="btn btn-sm"
                          href={`/hr/schedules/${row.id}`}
                        >
                          เปิด
                        </Link>
                        {canManage ? (
                          <DeleteSchedulePeriodButton
                            scheduleId={row.id}
                            name={row.name}
                            statusCode={row.statusCode}
                            disabled={!periods.available}
                          />
                        ) : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </HrShell>
  );
}
