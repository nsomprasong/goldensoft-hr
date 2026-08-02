import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import SalaryAdvancesWorkspace from "@/components/hr/salary-advances-workspace";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  listAdvancePeriodOptions,
  listEmployees,
  listOrganizationBranches,
  listSalaryAdvances,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function SalaryAdvancesPage() {
  const ctx = await requireHrPage({
    permission: [
      HR_PERMISSIONS.payrollRead,
      HR_PERMISSIONS.payrollManage,
      HR_PERMISSIONS.advanceApprove,
    ],
  });
  const [advances, employees, branches, periods] = await Promise.all([
    listSalaryAdvances(ctx),
    listEmployees(ctx, {
      page: 1,
      branchId: ctx.branchId ?? undefined,
    }),
    listOrganizationBranches(ctx),
    listAdvancePeriodOptions(ctx),
  ]);
  const availability = combineAvailability(advances, employees, periods);
  const canManage = canHr(ctx, HR_PERMISSIONS.payrollManage);
  const canApprove = canHr(ctx, [
    HR_PERMISSIONS.advanceApprove,
    HR_PERMISSIONS.payrollManage,
  ]);
  const branchLabel = ctx.branchId
    ? (branches.data.find((b) => b.id === ctx.branchId)?.label ?? "สาขาที่เลือก")
    : null;

  const employeeOptions = employees.data.rows
    .filter((row) => row.isActive)
    .map((row) => ({ id: row.id, label: row.displayName }));

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>เบิกล่วงหน้า</h1>
          <p>
            คำขอ → อนุมัติ (เงินสด / โอนพร้อมเงินเดือน) → หักคืนตามงวดที่เลือก
          </p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      <SalaryAdvancesWorkspace
        advances={advances.data}
        employees={employeeOptions}
        periodOptions={periods.data}
        canManage={canManage}
        canApprove={canApprove}
        available={availability.available}
        branchLabel={branchLabel}
      />
    </HrShell>
  );
}
