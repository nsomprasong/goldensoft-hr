import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import PayslipsWorkspace from "@/components/hr/payslips-workspace";
import HrShell from "@/components/hr-shell";
import { showEmployeeBranchLabel } from "@/lib/hr/api";
import {
  listOrgPayslips,
  listPayslipPeriodOptions,
  resolveDefaultPayslipPeriodId,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function PayslipsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.payslipRead });
  const params = await searchParams;
  const [payslips, periods] = await Promise.all([
    listOrgPayslips(ctx),
    listPayslipPeriodOptions(ctx),
  ]);
  const defaultPeriodId = resolveDefaultPayslipPeriodId(periods.data);
  const requested = single(params, "periodId");
  const selectedPeriodId =
    (requested && periods.data.some((row) => row.id === requested)
      ? requested
      : null) ?? defaultPeriodId;
  const showBranchLabel = showEmployeeBranchLabel(ctx);

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>สลิปเงินเดือน</h1>
          <p>เลือกงวดจ่ายเพื่อดูสลิป — ค่าเริ่มต้นเป็นงวดปัจจุบัน</p>
        </div>
      </div>

      <DatabaseUnavailableNotice
        message={payslips.message ?? periods.message}
      />
      <PayslipsWorkspace
        payslips={payslips.data}
        periods={periods.data}
        selectedPeriodId={selectedPeriodId}
        basePath="/hr/payslips"
        detailBasePath="/hr/payslips"
        showBranchLabel={showBranchLabel}
      />
    </HrShell>
  );
}
