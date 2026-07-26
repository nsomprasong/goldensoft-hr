import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import HrShell from "@/components/hr-shell";
import { loadHrDashboard } from "@/lib/hr/data";
import { HR_ENTITLEMENTS } from "@/lib/hr/entitlements";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

function branchLabel(
  branchId: string,
  current: { id: string; name: string } | null,
): string {
  if (current && current.id === branchId) return current.name;
  return `สาขา ${branchId.slice(0, 8)}`;
}

export default async function HrDashboardPage() {
  const ctx = await requireHrPage();
  const dashboard = await loadHrDashboard(ctx);
  const stats = dashboard.data;
  const employeeLimit =
    ctx.entitlements[HR_ENTITLEMENTS.employeeLimit]?.value ?? "—";

  return (
    <HrShell ctx={ctx} active="dashboard">
      <div className="hr-page-head">
        <div>
          <h1>แดชบอร์ด</h1>
          <p>
            ภาพรวมข้อมูลบุคคลขององค์กร {ctx.organizationName}
            {ctx.branch ? ` · สาขา ${ctx.branch.name}` : ""}
          </p>
        </div>
        {canHr(ctx, HR_PERMISSIONS.employeeCreate) ? (
          <Link className="btn btn-primary" href="/hr/employees/new">
            เพิ่มพนักงาน
          </Link>
        ) : null}
      </div>

      <DatabaseUnavailableNotice message={dashboard.message} />

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">พนักงานที่ใช้งานอยู่</div>
          <div className="stat-value">{stats.activeEmployees}</div>
        </div>
        <div className="stat">
          <div className="stat-label">กะงานที่เปิดใช้งาน</div>
          <div className="stat-value">{stats.activeShifts}</div>
        </div>
        <div className="stat">
          <div className="stat-label">โควตาพนักงานตามแพ็กเกจ</div>
          <div className="stat-value">{employeeLimit}</div>
        </div>
        <div className="stat">
          <div className="stat-label">คำขอลารออนุมัติ</div>
          <div className="stat-value">—</div>
          <p className="muted">ยังไม่มีข้อมูลจากระบบคำขอลา</p>
        </div>
        <div className="stat">
          <div className="stat-label">คำขอ OT รออนุมัติ</div>
          <div className="stat-value">—</div>
          <p className="muted">ยังไม่มีข้อมูลจากระบบ OT</p>
        </div>
        <div className="stat">
          <div className="stat-label">ลืมลงเวลาออก</div>
          <div className="stat-value">—</div>
          <p className="muted">ยังไม่มีข้อมูลจากระบบลงเวลา</p>
        </div>
        <div className="stat">
          <div className="stat-label">คำเตือนงวดเงินเดือน</div>
          <div className="stat-value">—</div>
          <p className="muted">ยังไม่มีข้อมูลตรวจสอบงวด</p>
        </div>
      </div>

      <div className="two-col">
        <section className="card">
          <h2>พนักงานตามสาขา</h2>
          {stats.byBranch.length === 0 ? (
            <p className="empty">ยังไม่มีข้อมูลพนักงาน</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>สาขา</th>
                    <th>จำนวน</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byBranch.map((row) => (
                    <tr key={row.branchId}>
                      <td>{branchLabel(row.branchId, ctx.branch)}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h2>พนักงานตามประเภทการจ้าง</h2>
          {stats.byEmploymentType.length === 0 ? (
            <p className="empty">ยังไม่มีข้อมูลพนักงาน</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ประเภทการจ้าง</th>
                    <th>จำนวน</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byEmploymentType.map((row) => (
                    <tr key={row.code}>
                      <td>{row.nameTh}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <h2>งวดเงินเดือนปัจจุบัน</h2>
        {stats.currentPeriod ? (
          <dl className="dl">
            <dt>รอบจ่าย</dt>
            <dd>{stats.currentPeriod.scheduleName}</dd>
            <dt>ช่วงงวด</dt>
            <dd>
              {stats.currentPeriod.periodStart} ถึง {stats.currentPeriod.periodEnd}
            </dd>
            <dt>วันจ่ายเงิน</dt>
            <dd>{stats.currentPeriod.paymentDate}</dd>
            <dt>สถานะ</dt>
            <dd>
              <span className="badge">{stats.currentPeriod.statusNameTh}</span>
            </dd>
            <dt>รายละเอียด</dt>
            <dd>
              <Link href={`/hr/payroll/periods/${stats.currentPeriod.id}`}>
                เปิดงวดนี้
              </Link>
            </dd>
          </dl>
        ) : (
          <p className="empty">ยังไม่มีงวดเงินเดือนที่ครอบคลุมวันนี้</p>
        )}
      </section>
    </HrShell>
  );
}
