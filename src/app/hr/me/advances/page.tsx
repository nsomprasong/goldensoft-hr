import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import MeAdvancesWorkspace from "@/components/hr/me-advances-workspace";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  listAdvancePeriodOptions,
  listMySalaryAdvances,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { resolveSelfEmployee } from "@/lib/hr/services/operations";
import { toHrServiceContext } from "@/lib/hr/services/shared";

export const dynamic = "force-dynamic";

export default async function MeAdvancesPage() {
  const ctx = await requireHrPage({
    permission: HR_PERMISSIONS.advanceSelf,
  });
  const service = toHrServiceContext(ctx);
  const self = await resolveSelfEmployee(service);
  if (!self) {
    return (
      <HrShell ctx={ctx}>
        <div className="hr-page-head">
          <div>
            <h1>เบิกล่วงหน้าของฉัน</h1>
            <p>ยังไม่พบบัญชีพนักงานที่ผูกกับผู้ใช้นี้</p>
          </div>
        </div>
      </HrShell>
    );
  }

  const [advances, periods] = await Promise.all([
    listMySalaryAdvances(ctx, self.id),
    listAdvancePeriodOptions(ctx),
  ]);
  const availability = combineAvailability(advances, periods);

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>เบิกล่วงหน้าของฉัน</h1>
          <p>ส่งคำขอ → รออนุมัติ → รับเงินตามวิธีจ่าย → หักคืนตามงวด</p>
        </div>
      </div>
      <DatabaseUnavailableNotice message={availability.message} />
      <MeAdvancesWorkspace
        advances={advances.data}
        periodOptions={periods.data}
      />
    </HrShell>
  );
}
