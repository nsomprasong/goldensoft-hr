import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import PayrollRunsWorkspace from "@/components/hr/payroll-runs-workspace";
import HrPageBackButton from "@/components/hr/hr-page-back-button";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  listPayrollPeriods,
  listPayrollRuns,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import { formatThaiDateRange } from "@/lib/hr/thai-date";

export const dynamic = "force-dynamic";

export default async function PayrollRunsPage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.payrollRead });
  const [runs, periods] = await Promise.all([
    listPayrollRuns(ctx),
    listPayrollPeriods(ctx),
  ]);
  const availability = combineAvailability(runs, periods);
  const canManage = canHr(ctx, HR_PERMISSIONS.payrollCalculate);

  const periodOptions = periods.data.map((row) => ({
    id: row.id,
    label: `${row.scheduleName} · ${formatThaiDateRange(row.periodStart, row.periodEnd)}`,
  }));

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>ประมวลผลเงินเดือน</h1>
          <p>รอบการคำนวณเงินเดือนแยกตามงวด</p>
        </div>
        <HrPageBackButton href="/hr" />
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      <PayrollRunsWorkspace
        runs={runs.data}
        periodOptions={periodOptions}
        canManage={canManage}
        available={availability.available}
      />
    </HrShell>
  );
}
