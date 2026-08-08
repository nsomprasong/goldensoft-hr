import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import MeAdvancesWorkspace from "@/components/hr/me-advances-workspace";
import HrPageBackButton from "@/components/hr/hr-page-back-button";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  listAdvancePeriodOptions,
  listMySalaryAdvances,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { markNotifyFromQuery } from "@/lib/hr/mark-notify-from-query";
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

export default async function MeAdvancesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const ctx = await requireHrPage({
    permission: HR_PERMISSIONS.advanceSelf,
  });
  const params = searchParams ? await searchParams : {};
  await markNotifyFromQuery(toHrServiceContext(ctx), single(params, "notify"));
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
          <HrPageBackButton href="/hr" />
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
        <HrPageBackButton href="/hr" />
      </div>
      <DatabaseUnavailableNotice message={availability.message} />
      <MeAdvancesWorkspace
        advances={advances.data}
        periodOptions={periods.data}
      />
    </HrShell>
  );
}
