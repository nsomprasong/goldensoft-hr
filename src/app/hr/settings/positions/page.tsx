import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import DepartmentPositionTabs from "@/components/hr/department-position-tabs";
import HrPageBackButton from "@/components/hr/hr-page-back-button";
import PositionsWorkspace from "@/components/hr/positions-workspace";
import HrShell from "@/components/hr-shell";
import { combineAvailability, listDepartments, listPositions, loadOrganizationRoleOptions } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.positionRead });
  const { edit } = await searchParams;

  const [positions, departments, roles] = await Promise.all([
    listPositions(ctx),
    listDepartments(ctx),
    loadOrganizationRoleOptions(ctx),
  ]);
  const availability = combineAvailability(positions, departments, roles);
  const canManage = canHr(ctx, HR_PERMISSIONS.positionManage);
  const editing = edit
    ? (positions.data.find((row) => row.id === edit) ?? null)
    : null;

  const departmentOptions = departments.data.map((d) => ({
    id: d.id,
    label: d.nameTh,
  }));

  return (
    <HrShell ctx={ctx} active="positions">
      <div className="hr-page-head">
        <div>
          <h1>แผนก/ตำแหน่ง</h1>
          <p>โครงสร้างแผนกและตำแหน่งขององค์กร</p>
        </div>
        <HrPageBackButton href="/hr/settings" />
      </div>

      <DepartmentPositionTabs active="positions" />

      <DatabaseUnavailableNotice message={availability.message} />

      <PositionsWorkspace
        positions={positions.data}
        departments={departmentOptions}
        roles={roles.data}
        editing={editing}
        available={availability.available}
        canManage={canManage}
      />
    </HrShell>
  );
}
