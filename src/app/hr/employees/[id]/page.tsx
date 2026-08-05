import Link from "next/link";
import { notFound } from "next/navigation";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import EmployeeAvatar from "@/components/hr/employee-avatar";
import EmployeeDetailWorkspace from "@/components/hr/employee-detail-workspace";
import EmployeeNameLabel from "@/components/hr/employee-name-label";
import ToggleActiveButton from "@/components/hr/toggle-active-button";
import HrShell from "@/components/hr-shell";
import { showEmployeeBranchLabel } from "@/lib/hr/api";
import {
  combineAvailability,
  getEmployeeDetail,
  listDepartments,
  listOrganizationBranches,
  listPositions,
  loadHrMasterData,
} from "@/lib/hr/data";
import {
  isEmployeeDetailTabKey,
  type EmployeeDetailTabKey,
} from "@/lib/hr/employee-detail-tabs";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import { toHrServiceContext } from "@/lib/hr/services/shared";
import { canToggleEmployeeActive } from "@/lib/hr/services/employees";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.employeeRead });
  const { id } = await params;
  const { tab } = await searchParams;

  const [detail, branches, master, departments, positions] = await Promise.all([
    getEmployeeDetail(ctx, id),
    listOrganizationBranches(ctx),
    loadHrMasterData(),
    listDepartments(ctx),
    listPositions(ctx),
  ]);
  const employee = detail.data;

  if (detail.available && !employee) {
    notFound();
  }

  const canEdit = canHr(ctx, HR_PERMISSIONS.employeeUpdate);
  const canDeactivate = canHr(ctx, HR_PERMISSIONS.employeeDeactivate);
  const canReadCompensation = canHr(ctx, HR_PERMISSIONS.compensationRead);
  const canManageCompensation = canHr(ctx, HR_PERMISSIONS.compensationManage);

  const service = toHrServiceContext(ctx);
  const canToggleActive =
    employee && canDeactivate
      ? await canToggleEmployeeActive(service, employee)
      : false;

  const requested = tab ?? "general";
  const activeTab: EmployeeDetailTabKey = isEmployeeDetailTabKey(requested)
    ? requested
    : "general";

  const branchName =
    branches.data.find((b) => b.id === employee?.branchId)?.label ?? "—";
  const availability = combineAvailability(detail, branches, master);
  const showBranchLabel = showEmployeeBranchLabel(ctx);

  return (
    <HrShell ctx={ctx} active="employees">
      <p className="breadcrumb">
        <Link href="/hr/employees">พนักงาน</Link> ·{" "}
        {employee?.displayName ?? "รายละเอียด"}
      </p>

      <div className="hr-page-head">
        <div className="employee-name-cell">
          {employee ? (
            <EmployeeAvatar
              displayName={employee.displayName}
              photoUrl={employee.photoUrl}
              size="lg"
            />
          ) : null}
          <div>
            {employee ? (
              <EmployeeNameLabel
                name={employee.displayName}
                branchName={employee.branchName ?? branchName}
                showBranch={showBranchLabel}
                as="h1"
                className="hr-approval-employee-name"
              />
            ) : (
              <h1>รายละเอียดพนักงาน</h1>
            )}
            <p>{employee?.statusNameTh ?? "ไม่ทราบสถานะ"}</p>
          </div>
        </div>
        {employee && canToggleActive ? (
          <div className="inline-actions">
            <ToggleActiveButton
              resource="employees"
              id={employee.id}
              isActive={employee.isActive}
              disabled={!detail.available}
            />
          </div>
        ) : employee && canDeactivate && employee.isActive ? (
          <p className="muted" style={{ margin: 0 }}>
            เจ้าขององค์กร — ปิดใช้งานได้เฉพาะพนักงาน GoldenSoft Platform
          </p>
        ) : null}
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      {!employee ? (
        <p className="empty">ยังไม่มีข้อมูลพนักงานให้แสดง</p>
      ) : (
        <EmployeeDetailWorkspace
          employeeId={employee.id}
          initialTab={activeTab}
          employee={{
            id: employee.id,
            displayName: employee.displayName,
            firstNameTh: employee.firstNameTh,
            lastNameTh: employee.lastNameTh,
            photoUrl: employee.photoUrl,
            phone: employee.phone,
            email: employee.email,
            notes: employee.notes,
            branchId: employee.branchId,
            departmentId: employee.departmentId,
            positionId: employee.positionId,
            employmentTypeId: employee.employmentTypeId,
            employeeStatusId: employee.employeeStatusId,
            hireDate: employee.hireDate,
            probationEndDate: employee.probationEndDate,
            resignationDate: employee.resignationDate,
            departmentNameTh: employee.departmentNameTh,
            positionNameTh: employee.positionNameTh,
            employmentTypeNameTh: employee.employmentTypeNameTh,
            statusNameTh: employee.statusNameTh,
            isActive: employee.isActive,
          }}
          branches={branches.data}
          branchName={branchName}
          departments={departments.data.map((d) => ({
            id: d.id,
            label: d.nameTh,
          }))}
          positions={positions.data.map((p) => ({
            id: p.id,
            label: p.nameTh,
            defaultRoleId: p.defaultRoleId,
          }))}
          employmentTypes={master.data.employmentTypes.map((t) => ({
            id: t.id,
            label: t.nameTh,
          }))}
          employeeStatuses={master.data.employeeStatuses.map((s) => ({
            id: s.id,
            label: s.nameTh,
          }))}
          wageTypes={master.data.wageTypes.map((w) => ({
            id: w.id,
            label: w.nameTh,
          }))}
          canEdit={canEdit}
          canReadCompensation={canReadCompensation}
          canManageCompensation={canManageCompensation}
          dataAvailable={detail.available}
        />
      )}
    </HrShell>
  );
}
