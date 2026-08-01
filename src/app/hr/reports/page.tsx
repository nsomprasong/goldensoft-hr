import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { formatThb } from "@/lib/hr/money";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { loadReportsHubSummary } from "@/lib/hr/services/report-summaries";
import { toHrServiceContext } from "@/lib/hr/services/shared";

export const dynamic = "force-dynamic";

function hoursLabel(minutes: number): string {
  if (minutes <= 0) return "0 ชม.";
  const h = minutes / 60;
  return `${h.toFixed(h % 1 === 0 ? 0 : 1)} ชม.`;
}

export default async function ReportsPage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.reportRead });
  let summary = null as Awaited<ReturnType<typeof loadReportsHubSummary>> | null;
  let message: string | null = null;
  try {
    summary = await loadReportsHubSummary(toHrServiceContext(ctx));
  } catch (error) {
    message =
      error instanceof Error ? error.message : "โหลดรายงานไม่สำเร็จ";
  }

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>รายงาน</h1>
          <p>
            สรุปเดือนนี้
            {summary ? ` · ${summary.periodLabel}` : ""}
          </p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={message} />

      {!summary ? (
        <p className="empty">ยังไม่มีข้อมูลสรุป</p>
      ) : (
        <div className="hr-report-hub">
          <section className="card hr-entity-card">
            <div className="hr-entity-card-top">
              <div className="hr-entity-card-title-wrap">
                <h2 className="hr-entity-card-title">ลงเวลา</h2>
              </div>
              <Link href="/hr/attendance" className="btn btn-sm">
                เปิดรายการ
              </Link>
            </div>
            <dl className="hr-entity-card-meta">
              <div>
                <dt>เข้างาน</dt>
                <dd>{summary.attendance.present}</dd>
              </div>
              <div>
                <dt>สาย</dt>
                <dd>{summary.attendance.late}</dd>
              </div>
              <div>
                <dt>ขาด</dt>
                <dd>{summary.attendance.absent}</dd>
              </div>
              <div>
                <dt>วันทั้งหมด</dt>
                <dd>{summary.attendance.total}</dd>
              </div>
            </dl>
          </section>

          <section className="card hr-entity-card">
            <div className="hr-entity-card-top">
              <div className="hr-entity-card-title-wrap">
                <h2 className="hr-entity-card-title">การลา</h2>
              </div>
              <Link href="/hr/leave" className="btn btn-sm">
                เปิดรายการ
              </Link>
            </div>
            <dl className="hr-entity-card-meta">
              <div>
                <dt>รออนุมัติ</dt>
                <dd>{summary.leave.submitted}</dd>
              </div>
              <div>
                <dt>อนุมัติแล้ว</dt>
                <dd>{summary.leave.approved}</dd>
              </div>
              <div>
                <dt>ไม่อนุมัติ</dt>
                <dd>{summary.leave.rejected}</dd>
              </div>
            </dl>
          </section>

          <section className="card hr-entity-card">
            <div className="hr-entity-card-top">
              <div className="hr-entity-card-title-wrap">
                <h2 className="hr-entity-card-title">OT</h2>
              </div>
              <Link href="/hr/overtime" className="btn btn-sm">
                เปิดรายการ
              </Link>
            </div>
            <dl className="hr-entity-card-meta">
              <div>
                <dt>รออนุมัติ</dt>
                <dd>{summary.overtime.submitted}</dd>
              </div>
              <div>
                <dt>อนุมัติแล้ว</dt>
                <dd>{summary.overtime.approved}</dd>
              </div>
              <div>
                <dt>ชั่วโมงที่อนุมัติ</dt>
                <dd>{hoursLabel(summary.overtime.approvedMinutes)}</dd>
              </div>
            </dl>
          </section>

          <section className="card hr-entity-card">
            <div className="hr-entity-card-top">
              <div className="hr-entity-card-title-wrap">
                <h2 className="hr-entity-card-title">เบิกล่วงหน้า</h2>
              </div>
              <Link href="/hr/advances" className="btn btn-sm">
                เปิดรายการ
              </Link>
            </div>
            <dl className="hr-entity-card-meta">
              <div>
                <dt>เปิดอยู่</dt>
                <dd>
                  {summary.advances.open} ·{" "}
                  {formatThb(summary.advances.openAmount)}
                </dd>
              </div>
              <div>
                <dt>หักแล้ว</dt>
                <dd>
                  {summary.advances.deducted} ·{" "}
                  {formatThb(summary.advances.deductedAmount)}
                </dd>
              </div>
              <div>
                <dt>ทั้งหมด</dt>
                <dd>{summary.advances.total}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </HrShell>
  );
}
