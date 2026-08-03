import AttendanceDayWorkspace from "@/components/hr/attendance-day-workspace";
import HrShell from "@/components/hr-shell";
import { showEmployeeBranchLabel } from "@/lib/hr/api";
import { listEmployees, listOrganizationBranches } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.attendanceRead });
  const showBranchLabel = showEmployeeBranchLabel(ctx);
  const canManage = canHr(ctx, HR_PERMISSIONS.attendanceManage);

  const [employees, branches] = await Promise.all([
    listEmployees(ctx, {
      page: 1,
      pageSize: 200,
      branchId: ctx.branchId ?? undefined,
      isActive: true,
    }),
    listOrganizationBranches(ctx),
  ]);

  const branchLabel = ctx.branchId
    ? (branches.data.find((b) => b.id === ctx.branchId)?.label ?? "สาขาที่เลือก")
    : "ทุกสาขา";

  const employeeOptions = (employees.data.rows ?? [])
    .filter((row) => row.isActive)
    .map((row) => ({ id: row.id, label: row.displayName }));

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>เวลาทำงาน</h1>
          <p>
            ดูและแก้ไขเวลาเข้า–ออกตามสาขาที่เลือก เลือกพนักงานและช่วงวันที่ได้
          </p>
        </div>
      </div>
      <AttendanceDayWorkspace
        showBranchLabel={showBranchLabel}
        branchLabel={branchLabel}
        employees={employeeOptions}
        canManage={canManage}
      />
    </HrShell>
  );
}
