import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import HrPageBackButton from "@/components/hr/hr-page-back-button";
import OvertimeRulesWorkspace from "@/components/hr/overtime-rules-workspace";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  listOvertimeRules,
  loadHrMasterData,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function OvertimeRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const ctx = await requireHrPage({
    permission: [
      HR_PERMISSIONS.settingsManage,
      HR_PERMISSIONS.compensationManage,
      HR_PERMISSIONS.shiftManage,
    ],
  });
  const { edit } = await searchParams;

  const [rules, master] = await Promise.all([
    listOvertimeRules(ctx),
    loadHrMasterData(),
  ]);
  const availability = combineAvailability(rules, master);
  const canManage = canHr(ctx, HR_PERMISSIONS.settingsManage);
  const editing = edit
    ? (rules.data.find((row) => row.id === edit) ?? null)
    : null;

  const rateTypeOptions = master.data.overtimeRateTypes.map((t) => ({
    id: t.id,
    label: t.nameTh,
  }));

  return (
    <HrShell ctx={ctx} active="overtime-rules">
      <div className="hr-page-head">
        <div>
          <h1>กฎ OT</h1>
          <p>อัตราค่าล่วงเวลาสำหรับคำนวณเงินเดือน</p>
        </div>
        <HrPageBackButton href="/hr/settings" />
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      <OvertimeRulesWorkspace
        rules={rules.data}
        rateTypes={rateTypeOptions}
        editing={editing}
        available={availability.available}
        canManage={canManage}
      />
    </HrShell>
  );
}
