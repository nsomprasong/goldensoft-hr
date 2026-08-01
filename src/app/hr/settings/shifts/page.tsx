import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import ShiftsWorkspace from "@/components/hr/shifts-workspace";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  listOrganizationBranches,
  listShifts,
  loadHrMasterData,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.shiftRead });
  const { edit } = await searchParams;

  const [shifts, master, orgBranches] = await Promise.all([
    listShifts(ctx),
    loadHrMasterData(),
    listOrganizationBranches(ctx),
  ]);
  const availability = combineAvailability(shifts, master);
  const canManage = canHr(ctx, HR_PERMISSIONS.shiftManage);
  const editing = edit
    ? (shifts.data.find((row) => row.id === edit) ?? null)
    : null;

  const shiftTypeOptions = master.data.shiftTypes.map((t) => ({
    id: t.id,
    label: t.nameTh,
  }));
  const branches =
    orgBranches.data.length > 0
      ? orgBranches.data
      : ctx.branch
        ? [{ id: ctx.branch.id, label: ctx.branch.name }]
        : ctx.branchId
          ? [{ id: ctx.branchId, label: "สาขาปัจจุบัน" }]
          : [];

  return (
    <HrShell ctx={ctx} active="shifts">
      <div className="hr-page-head">
        <div>
          <h1>กะงาน</h1>
          <p>แม่แบบเวลาเข้า–ออกงาน สำหรับใช้จัดตารางและลงเวลา</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      <ShiftsWorkspace
        shifts={shifts.data}
        shiftTypes={shiftTypeOptions}
        branches={branches}
        editing={editing}
        available={availability.available}
        canManage={canManage}
      />
    </HrShell>
  );
}
