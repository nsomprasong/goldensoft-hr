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
import { formatThaiDate } from "@/lib/hr/thai-date";

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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รอบจ่าย</th>
                <th>เริ่มงวด</th>
                <th>สิ้นงวด</th>
                <th>วันจ่ายเงิน</th>
                <th>สถานะ</th>
                <th>รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {periods.data.map((row) => (
                <tr key={row.id}>
                  <td>{row.scheduleName}</td>
                  <td className="nowrap">{formatThaiDate(row.periodStart)}</td>
                  <td className="nowrap">{formatThaiDate(row.periodEnd)}</td>
                  <td className="nowrap">{formatThaiDate(row.paymentDate)}</td>
                  <td>
                    <span className="badge">{row.statusNameTh}</span>
                  </td>
                  <td>
                    <Link href={`/hr/payroll/periods/${row.id}`}>เปิดดู</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? (
        <PayrollPeriodForm
          disabled={!availability.available}
          schedules={schedules.data
            .filter((s) => s.isActive)
            .map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }))}
        />
      ) : null}
    </HrShell>
  );
}
