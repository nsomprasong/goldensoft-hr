import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import MePayslipsWorkspace from "@/components/hr/me-payslips-workspace";
import HrShell from "@/components/hr-shell";
import {
  listPayslipPeriodOptions,
  listSelfPayslips,
  resolveDefaultPayslipPeriodId,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { resolveSelfEmployee } from "@/lib/hr/services/operations";
import { toHrServiceContext } from "@/lib/hr/services/shared";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function MyPayslipsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.payslipSelf });
  const params = await searchParams;
  const service = toHrServiceContext(ctx);
  const self = await resolveSelfEmployee(service);
  if (!self) {
    return (
      <HrShell ctx={ctx}>
        <div className="hr-page-head">
          <div>
            <h1>สลิปเงินเดือนของฉัน</h1>
            <p>ยังไม่พบบัญชีพนักงานที่ผูกกับผู้ใช้นี้</p>
          </div>
        </div>
      </HrShell>
    );
  }

  const [payslips, periods] = await Promise.all([
    listSelfPayslips(ctx),
    listPayslipPeriodOptions(ctx, { employeeId: self.id }),
  ]);
  const defaultPeriodId = resolveDefaultPayslipPeriodId(periods.data);
  const requested = single(params, "periodId");
  const selectedPeriodId =
    (requested && periods.data.some((row) => row.id === requested)
      ? requested
      : null) ?? defaultPeriodId;

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>สลิปเงินเดือนของฉัน</h1>
          <p>เลือกงวดจ่ายเพื่อดูสลิป — ค่าเริ่มต้นเป็นงวดปัจจุบัน</p>
        </div>
      </div>

      <DatabaseUnavailableNotice
        message={payslips.message ?? periods.message}
      />
      <MePayslipsWorkspace
        payslips={payslips.data}
        periods={periods.data}
        selectedPeriodId={selectedPeriodId}
      />
    </HrShell>
  );
}
