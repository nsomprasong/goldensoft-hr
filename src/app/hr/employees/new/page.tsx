import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import EmployeeForm from "@/components/hr/employee-form";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  listDepartments,
  listPositions,
  loadHrMasterData,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.employeeCreate });

  const [master, departments, positions] = await Promise.all([
    loadHrMasterData(),
    listDepartments(ctx),
    listPositions(ctx),
  ]);
  const availability = combineAvailability(master, departments, positions);

  return (
    <HrShell ctx={ctx} active="employees">
      <p className="breadcrumb">
        <Link href="/hr/employees">พนักงาน</Link> · เพิ่มพนักงานใหม่
      </p>
      <div className="hr-page-head">
        <div>
          <h1>เพิ่มพนักงานใหม่</h1>
          <p>กรอกข้อมูลพื้นฐานของพนักงาน ระบบจะบันทึกผ่าน API ขององค์กรนี้</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      <EmployeeForm
        mode="create"
        disabled={!availability.available}
        departments={departments.data
          .filter((d) => d.isActive)
          .map((d) => ({ id: d.id, label: `${d.code} · ${d.nameTh}` }))}
        positions={positions.data
          .filter((p) => p.isActive)
          .map((p) => ({ id: p.id, label: `${p.code} · ${p.nameTh}` }))}
        employmentTypes={master.data.employmentTypes.map((t) => ({
          id: t.id,
          label: t.nameTh,
        }))}
        employeeStatuses={master.data.employeeStatuses.map((s) => ({
          id: s.id,
          label: s.nameTh,
        }))}
        branches={ctx.branch ? [{ id: ctx.branch.id, label: ctx.branch.name }] : []}
      />
    </HrShell>
  );
}
