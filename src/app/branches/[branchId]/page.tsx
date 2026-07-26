import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import HrShell from "@/components/hr-shell";
import { listEmployees } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";

export const dynamic = "force-dynamic";

export default async function BranchPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const ctx = await requireHrPage({ branchId });
  const employees = await listEmployees(ctx, { branchId });

  return (
    <HrShell ctx={ctx} active="dashboard">
      <div className="hr-page-head">
        <div>
          <h1>สาขา {ctx.branch?.name ?? branchId}</h1>
          <p>องค์กร {ctx.organizationName}</p>
        </div>
        <Link className="btn" href="/employees">
          ดูพนักงานทั้งหมด
        </Link>
      </div>

      <DatabaseUnavailableNotice message={employees.message} />

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">พนักงานในสาขานี้</div>
          <div className="stat-value">{employees.data.total}</div>
        </div>
      </div>

      {employees.data.rows.length === 0 ? (
        <p className="empty">ยังไม่มีพนักงานในสาขานี้</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ</th>
                <th>ตำแหน่ง</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {employees.data.rows.map((employee) => (
                <tr key={employee.id}>
                  <td className="nowrap">{employee.employeeCode}</td>
                  <td>
                    <Link href={`/employees/${employee.id}`}>
                      {employee.displayName}
                    </Link>
                  </td>
                  <td>{employee.positionNameTh ?? "—"}</td>
                  <td>{employee.statusNameTh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HrShell>
  );
}
