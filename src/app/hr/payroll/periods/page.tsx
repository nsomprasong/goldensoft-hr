import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import PayrollPeriodForm from "@/components/hr/payroll-period-form";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  listPayrollPeriods,
  listPayrollSchedules,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import { formatThaiDate, formatThaiDateRange } from "@/lib/hr/thai-date";

export const dynamic = "force-dynamic";

export default async function PayrollPeriodsPage() {
  const ctx = await requireHrPage({
    permission: HR_PERMISSIONS.payrollPeriodRead,
  });

  const [periods, schedules] = await Promise.all([
    listPayrollPeriods(ctx),
    listPayrollSchedules(ctx),
  ]);
  const availability = combineAvailability(periods, schedules);
  const canManage = canHr(ctx, HR_PERMISSIONS.payrollPeriodManage);

  return (
    <HrShell ctx={ctx} active="payroll-periods">
      <div className="hr-page-head">
        <div>
          <h1>งวดเงินเดือน</h1>
          <p>งวดล่าสุดขององค์กร {ctx.organizationName}</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      {periods.data.length === 0 ? (
        <p className="empty">ยังไม่มีงวดเงินเดือน</p>
      ) : (
        <div className="hr-card-grid">
          {periods.data.map((row) => (
            <article key={row.id} className="card hr-entity-card">
              <div className="hr-entity-card-top">
                <div className="hr-entity-card-title-wrap">
                  <h2 className="hr-entity-card-title">{row.scheduleName}</h2>
                  <p className="hr-entity-card-subtitle">
                    {formatThaiDateRange(row.periodStart, row.periodEnd)}
                  </p>
                </div>
                <span
                  className={
                    row.statusCode === "LOCKED"
                      ? "badge badge-inactive"
                      : row.statusCode === "APPROVED" ||
                          row.statusCode === "PAID"
                        ? "badge badge-active"
                        : "badge"
                  }
                >
                  {row.statusNameTh}
                </span>
              </div>

              <dl className="hr-entity-card-meta">
                <div>
                  <dt>วันเริ่มงวด</dt>
                  <dd>{formatThaiDate(row.periodStart)}</dd>
                </div>
                <div>
                  <dt>วันสิ้นงวด</dt>
                  <dd>{formatThaiDate(row.periodEnd)}</dd>
                </div>
                <div>
                  <dt>วันจ่ายเงิน</dt>
                  <dd>{formatThaiDate(row.paymentDate)}</dd>
                </div>
              </dl>

              <div className="hr-entity-card-actions">
                <Link
                  className="btn btn-sm"
                  href={`/hr/payroll/periods/${row.id}`}
                >
                  เปิดดู
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {canManage ? (
        <PayrollPeriodForm
          disabled={!availability.available}
          schedules={schedules.data
            .filter((s) => s.isActive)
            .map((s) => ({ id: s.id, label: s.name }))}
        />
      ) : null}
    </HrShell>
  );
}
