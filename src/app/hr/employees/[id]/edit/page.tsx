import Link from "next/link";
import { notFound } from "next/navigation";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import EmployeeForm from "@/components/hr/employee-form";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  getEmployeeDetail,
  listDepartments,
  listPositions,
  loadHrMasterData,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.employeeUpdate });
  const { id } = await params;

  const [detail, master, departments, positions] = await Promise.all([
    getEmployeeDetail(ctx, id),
    loadHrMasterData(),
    listDepartments(ctx),
    listPositions(ctx),
  ]);

  if (detail.available && !detail.data) {
    notFound();
  }

  const availability = combineAvailability(
    detail,
    master,
    departments,
    positions,
  );
  const employee = detail.data;

  const branches = [
    ...(ctx.branch ? [{ id: ctx.branch.id, label: ctx.branch.name }] : []),
    ...(employee && employee.branchId !== ctx.branch?.id
      ? [{ id: employee.branchId, label: `สาขา ${employee.branchId.slice(0, 8)}` }]
      : []),
  ];

  return (
    <HrShell ctx={ctx} active="employees">
      <p className="breadcrumb">
        <Link href="/hr/employees">พนักงาน</Link> ·{" "}
        <Link href={`/hr/employees/${id}`}>{employee?.displayName ?? id}</Link> ·
        แก้ไข
      </p>

      <div className="hr-page-head">
        <div>
          <h1>แก้ไขข้อมูลพนักงาน</h1>
          <p>รหัสพนักงาน {employee?.employeeCode ?? "—"}</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      {!employee ? (
        <p className="empty">ยังไม่มีข้อมูลพนักงานให้แก้ไข</p>
      ) : (
        <EmployeeForm
          mode="edit"
          employeeId={employee.id}
          disabled={!availability.available}
          initialValues={{
            employeeCode: employee.employeeCode,
            firstNameTh: employee.firstNameTh,
            lastNameTh: employee.lastNameTh,
            firstNameEn: employee.firstNameEn ?? "",
            lastNameEn: employee.lastNameEn ?? "",
            displayName: employee.displayName,
            phone: employee.phone,
            email: employee.email ?? "",
            branchId: employee.branchId,
            departmentId: employee.departmentId ?? "",
            positionId: employee.positionId ?? "",
            employmentTypeId: employee.employmentTypeId,
            employeeStatusId: employee.employeeStatusId,
            hireDate: employee.hireDate,
            probationEndDate: employee.probationEndDate ?? "",
            notes: employee.notes ?? "",
          }}
          departments={departments.data.map((d) => ({
            id: d.id,
            label: `${d.code} · ${d.nameTh}`,
          }))}
          positions={positions.data.map((p) => ({
            id: p.id,
            label: `${p.code} · ${p.nameTh}`,
          }))}
          employmentTypes={master.data.employmentTypes.map((t) => ({
            id: t.id,
            label: t.nameTh,
          }))}
          employeeStatuses={master.data.employeeStatuses.map((s) => ({
            id: s.id,
            label: s.nameTh,
          }))}
          branches={branches}
        />
      )}
    </HrShell>
  );
}
