import Link from "next/link";
import { notFound } from "next/navigation";

import Alert, { DatabaseUnavailableNotice } from "@/components/hr/alert";
import PayrollPeriodStatusForm from "@/components/hr/payroll-period-status-form";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  getPayrollPeriod,
  loadHrMasterData,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import { formatThaiDate, formatThaiDateRange } from "@/lib/hr/thai-date";

export const dynamic = "force-dynamic";

export default async function PayrollPeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireHrPage({
    permission: HR_PERMISSIONS.payrollPeriodRead,
  });
  const { id } = await params;

  const [period, master] = await Promise.all([
    getPayrollPeriod(ctx, id),
    loadHrMasterData(),
  ]);

  if (period.available && !period.data) {
    notFound();
  }

  const availability = combineAvailability(period, master);
  const row = period.data;
  const canManage = canHr(ctx, HR_PERMISSIONS.payrollPeriodManage);
  const isLocked = row?.statusCode === "LOCKED";

  return (
    <HrShell ctx={ctx} active="payroll-periods">
      <p className="breadcrumb">
        <Link href="/hr/payroll/periods">งวดเงินเดือน</Link> ·{" "}
        {row
          ? formatThaiDateRange(row.periodStart, row.periodEnd)
          : "รายละเอียด"}
      </p>

      <div className="hr-page-head">
        <div>
          <h1>รายละเอียดงวดเงินเดือน</h1>
          <p>{row?.scheduleName ?? "—"}</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      {!row ? (
        <p className="empty">ยังไม่มีข้อมูลงวดเงินเดือนให้แสดง</p>
      ) : (
        <>
          <section className="card">
            <h2>ข้อมูลงวด</h2>
            <dl className="dl">
              <dt>รอบจ่าย</dt>
              <dd>{row.scheduleName}</dd>
              <dt>วันเริ่มงวด</dt>
              <dd>{formatThaiDate(row.periodStart)}</dd>
              <dt>วันสิ้นงวด</dt>
              <dd>{formatThaiDate(row.periodEnd)}</dd>
              <dt>วันจ่ายเงิน</dt>
              <dd>{formatThaiDate(row.paymentDate)}</dd>
              <dt>สถานะ</dt>
              <dd>
                <span className="badge">{row.statusNameTh}</span>
              </dd>
              <dt>ล็อกเมื่อ</dt>
              <dd>{formatThaiDate(row.lockedAt)}</dd>
            </dl>
          </section>

          {canManage ? (
            isLocked ? (
              <Alert kind="info">
                งวดนี้ถูกล็อกแล้ว ไม่สามารถเปลี่ยนสถานะได้
              </Alert>
            ) : (
              <PayrollPeriodStatusForm
                periodId={row.id}
                currentStatusCode={row.statusCode}
                disabled={!availability.available}
                statuses={master.data.payrollPeriodStatuses.map((s) => ({
                  code: s.code,
                  label: s.nameTh,
                }))}
              />
            )
          ) : (
            <Alert kind="info">คุณมีสิทธิ์ดูข้อมูลงวดเงินเดือนเท่านั้น</Alert>
          )}
        </>
      )}
    </HrShell>
  );
}
