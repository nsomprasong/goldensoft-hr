import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import DepartmentPositionTabs from "@/components/hr/department-position-tabs";
import DepartmentsWorkspace from "@/components/hr/departments-workspace";
import HrPageBackButton from "@/components/hr/hr-page-back-button";
import HrShell from "@/components/hr-shell";
import { listDepartments } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const ctx = await requireHrPage({
    permission: HR_PERMISSIONS.departmentRead,
  });
  const { edit } = await searchParams;

  const departments = await listDepartments(ctx);
  const canManage = canHr(ctx, HR_PERMISSIONS.departmentManage);
  const editing = edit
    ? (departments.data.find((row) => row.id === edit) ?? null)
    : null;

  return (
    <HrShell ctx={ctx} active="departments">
      <div className="hr-page-head">
        <div>
          <h1>แผนก/ตำแหน่ง</h1>
          <p>โครงสร้างแผนกและตำแหน่งขององค์กร</p>
        </div>
        <HrPageBackButton href="/hr/settings" />
      </div>

      <DepartmentPositionTabs active="departments" />

      <DatabaseUnavailableNotice message={departments.message} />

      <DepartmentsWorkspace
        departments={departments.data}
        editing={editing}
        available={departments.available}
        canManage={canManage}
      />
    </HrShell>
  );
}
