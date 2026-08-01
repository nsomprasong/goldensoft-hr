import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import HrShell from "@/components/hr-shell";
import { listSalaryAdvances } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { formatThb } from "@/lib/hr/money";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.reportRead });
  const advances = await listSalaryAdvances(ctx);
  const rows = advances.data;
  const open = rows.filter(
    (r) => r.status === "APPROVED" || r.status === "RECORDED",
  );
  const deducted = rows.filter((r) => r.status === "DEDUCTED");
  const openAmount = open.reduce((s, r) => s + r.amount, 0);
  const deductedAmount = deducted.reduce((s, r) => s + r.amount, 0);

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>รายงาน</h1>
          <p>สรุปเบิกล่วงหน้าและรายการที่เกี่ยวข้อง</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={advances.message} />

      <section className="card hr-entity-card" style={{ marginBottom: "1rem" }}>
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
            <dt>รอหัก</dt>
            <dd>
              {open.length} รายการ · {formatThb(openAmount)}
            </dd>
          </div>
          <div>
            <dt>หักแล้ว</dt>
            <dd>
              {deducted.length} รายการ · {formatThb(deductedAmount)}
            </dd>
          </div>
          <div>
            <dt>ทั้งหมด</dt>
            <dd>{rows.length} รายการ</dd>
          </div>
        </dl>
      </section>

      {rows.length === 0 ? (
        <p className="empty">ยังไม่มีข้อมูลเบิกล่วงหน้าสำหรับรายงาน</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>พนักงาน</th>
                <th>วันที่</th>
                <th className="num">จำนวน</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.displayName}</td>
                  <td className="nowrap">{row.advanceDateLabel}</td>
                  <td className="num nowrap">{formatThb(row.amount)}</td>
                  <td>
                    <span className="badge">{row.statusLabel}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HrShell>
  );
}
