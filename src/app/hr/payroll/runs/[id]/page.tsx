import { notFound } from "next/navigation";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import PayrollRunDetailWorkspace from "@/components/hr/payroll-run-detail-workspace";
import HrShell from "@/components/hr-shell";
import { getPayrollRun } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.payrollRead });
  const { id } = await params;
  const run = await getPayrollRun(ctx, id);

  if (run.available && !run.data) {
    notFound();
  }

  return (
    <HrShell ctx={ctx}>
      <DatabaseUnavailableNotice message={run.message} />

      {!run.data ? (
        <p className="empty">ยังไม่มีผลลัพธ์การคำนวณ</p>
      ) : (
        <PayrollRunDetailWorkspace
          run={run.data}
          canCalculate={canHr(ctx, HR_PERMISSIONS.payrollCalculate)}
          canApprove={canHr(ctx, HR_PERMISSIONS.payrollApprove)}
          canMarkPaid={canHr(ctx, HR_PERMISSIONS.payrollMarkPaid)}
          canIssue={canHr(ctx, [
            HR_PERMISSIONS.payslipRead,
            HR_PERMISSIONS.payrollApprove,
          ])}
          available={run.available}
        />
      )}
    </HrShell>
  );
}
