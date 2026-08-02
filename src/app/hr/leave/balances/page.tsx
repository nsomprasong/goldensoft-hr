import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import EmployeeAvatar from "@/components/hr/employee-avatar";
import EmployeeNameLabel from "@/components/hr/employee-name-label";
import HrShell from "@/components/hr-shell";
import { showEmployeeBranchLabel } from "@/lib/hr/api";
import { listLeaveBalances } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function LeaveBalancesPage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.leaveRead });
  const list = await listLeaveBalances(ctx);
  const showBranchLabel = showEmployeeBranchLabel(ctx);

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>ยอดคงเหลือการลา</h1>
          <p>ยอดสิทธิและรายการเคลื่อนไหวของพนักงาน — {list.data.length} รายการ</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={list.message} />

      {list.data.length === 0 ? (
        <section className="card">
          <p className="empty">ยังไม่มีข้อมูลยอดคงเหลือการลา</p>
        </section>
      ) : (
        <div className="table-wrap card">
          <table className="data-table">
            <thead>
              <tr>
                <th>พนักงาน</th>
                <th>ประเภทลา</th>
                <th>ปี</th>
                <th>ยกมา</th>
                <th>ใช้ไป</th>
                <th>คงเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="employee-name-cell">
                      <EmployeeAvatar
                        displayName={row.employeeName}
                        photoUrl={row.photoUrl}
                        size="sm"
                      />
                      <EmployeeNameLabel
                        name={row.employeeName}
                        branchName={row.branchName}
                        showBranch={showBranchLabel}
                        className="hr-approval-employee-name"
                      >
                        <span className="muted">{row.employeeCode}</span>
                      </EmployeeNameLabel>
                    </span>
                  </td>
                  <td>{row.leaveTypeName}</td>
                  <td>{row.balanceYear + 543}</td>
                  <td>{row.openingBalance}</td>
                  <td>{row.usedBalance}</td>
                  <td>
                    <strong>{row.availableBalance}</strong>
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
