import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import EmployeeForm from "@/components/hr/employee-form";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  listDepartments,
  listOrganizationBranches,
  listPositions,
  loadHrMasterData,
  loadOrganizationRoleOptions,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.employeeCreate });

  const [master, departments, positions, branches, roles] = await Promise.all([
    loadHrMasterData(),
    listDepartments(ctx),
    listPositions(ctx),
    listOrganizationBranches(ctx),
    loadOrganizationRoleOptions(ctx),
  ]);
  const availability = combineAvailability(
    master,
    departments,
    positions,
    branches,
    roles,
  );
  const includeCompensation =
    canHr(ctx, HR_PERMISSIONS.compensationManage) ||
    canHr(ctx, HR_PERMISSIONS.employeeCreate);

  return (
    <HrShell ctx={ctx} active="employees">
      <p className="breadcrumb">
        <Link href="/hr/employees">พนักงาน</Link> · เพิ่มพนักงานใหม่
      </p>
      <div className="hr-page-head">
        <div>
          <h1>เพิ่มพนักงานใหม่</h1>
          <p>
            กรอกข้อมูลพนักงาน การจ้าง
            {includeCompensation ? " และค่าตอบแทนเริ่มต้น" : ""}
          </p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      <EmployeeForm
        mode="create"
        disabled={!availability.available}
        includeCompensation={includeCompensation}
        departments={departments.data
          .filter((d) => d.isActive)
          .map((d) => ({ id: d.id, label: d.nameTh }))}
        positions={positions.data
          .filter((p) => p.isActive)
          .map((p) => ({ id: p.id, label: p.nameTh, defaultRoleId: p.defaultRoleId }))}
        roles={roles.data}
        employmentTypes={master.data.employmentTypes.map((t) => ({
          id: t.id,
          label: t.nameTh,
        }))}
        employeeStatuses={master.data.employeeStatuses.map((s) => ({
          id: s.id,
          label: s.nameTh,
        }))}
        branches={branches.data}
        wageTypes={master.data.wageTypes.map((w) => ({
          id: w.id,
          label: w.nameTh,
        }))}
      />
    </HrShell>
  );
}
