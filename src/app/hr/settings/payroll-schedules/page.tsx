import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import HrPageBackButton from "@/components/hr/hr-page-back-button";
import PayrollSchedulesWorkspace from "@/components/hr/payroll-schedules-workspace";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  listPayrollSchedules,
  loadHrMasterData,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function PayrollSchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const ctx = await requireHrPage({
    permission: HR_PERMISSIONS.payrollScheduleRead,
  });
  const { edit } = await searchParams;

  const [schedules, master] = await Promise.all([
    listPayrollSchedules(ctx),
    loadHrMasterData(),
  ]);
  const availability = combineAvailability(schedules, master);
  const canManage = canHr(ctx, HR_PERMISSIONS.payrollScheduleManage);
  const editing = edit
    ? (schedules.data.find((row) => row.id === edit) ?? null)
    : null;

  const frequencyOptions = master.data.payFrequencies.map((f) => ({
    id: f.id,
    label: f.nameTh,
  }));

  return (
    <HrShell ctx={ctx} active="payroll-schedules">
      <div className="hr-page-head">
        <div>
          <h1>รอบจ่าย</h1>
          <p>กติกาการสร้างงวดเงินเดือน</p>
        </div>
        <HrPageBackButton href="/hr/settings" />
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      <PayrollSchedulesWorkspace
        schedules={schedules.data}
        payFrequencies={frequencyOptions}
        editing={editing}
        available={availability.available}
        canManage={canManage}
      />
    </HrShell>
  );
}
