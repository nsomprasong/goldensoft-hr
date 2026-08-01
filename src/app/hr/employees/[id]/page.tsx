import Link from "next/link";
import { notFound } from "next/navigation";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import EmployeeAvatar from "@/components/hr/employee-avatar";
import EmployeeDocumentsPanel from "@/components/hr/employee-documents-panel";
import EmployeeRoleTab from "@/components/hr/employee-role-tab";
import {
  EmployeeBranchTab,
  EmployeeEmploymentTab,
  EmployeeGeneralTab,
} from "@/components/hr/employee-tab-sections";
import ToggleActiveButton from "@/components/hr/toggle-active-button";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  getEmployeeDetail,
  listDepartments,
  listEmployeeCompensations,
  listOrganizationBranches,
  listPositions,
  loadHrMasterData,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import { listEmployeeDocuments } from "@/lib/hr/services/employee-documents";
import {
  getEmployeeRoleState,
  type EmployeeRoleState,
} from "@/lib/hr/services/employee-roles";
import { toHrServiceContext } from "@/lib/hr/services/shared";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "general", label: "ข้อมูลทั่วไป" },
  { key: "branches", label: "สาขา" },
  { key: "employment", label: "การจ้าง" },
  { key: "documents", label: "เอกสารประกอบ" },
  { key: "roles", label: "บทบาท" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

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
  const service = toHrServiceContext(ctx);

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

  const requested = (tab ?? "general") as TabKey;
  const activeTab: TabKey = TABS.some((t) => t.key === requested)
    ? requested
    : "general";

  const branchName =
    branches.data.find((b) => b.id === employee?.branchId)?.label ?? "—";

  let compensations: Awaited<
    ReturnType<typeof listEmployeeCompensations>
  >["data"] = [];
  let compensationMessage: string | null = null;
  let documents: Awaited<ReturnType<typeof listEmployeeDocuments>> = [];
  let documentsMessage: string | null = null;
  let roleState: EmployeeRoleState | null = null;
  let rolesMessage: string | null = null;

  if (
    employee &&
    activeTab === "employment" &&
    (canReadCompensation || canManageCompensation)
  ) {
    const rows = await listEmployeeCompensations(ctx, id);
    compensations = rows.data;
    compensationMessage = rows.message;
  }

  if (employee && activeTab === "documents") {
    try {
      documents = await listEmployeeDocuments(service, id);
    } catch (error) {
      documentsMessage =
        error instanceof Error
          ? error.message
          : "ยังโหลดเอกสารไม่ได้ — ตรวจว่า migration เอกสารพร้อมแล้ว";
    }
  }

  if (employee && activeTab === "roles") {
    try {
      roleState = await getEmployeeRoleState(ctx, service, id);
    } catch (error) {
      rolesMessage =
        error instanceof Error
          ? error.message
          : "โหลดบทบาทไม่สำเร็จ";
    }
  }

  const availability = combineAvailability(detail, branches, master);

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
            <h1>{employee?.displayName ?? "รายละเอียดพนักงาน"}</h1>
            <p>{employee?.statusNameTh ?? "ไม่ทราบสถานะ"}</p>
          </div>
        </div>
        {employee && canDeactivate ? (
          <div className="inline-actions">
            <ToggleActiveButton
              resource="employees"
              id={employee.id}
              isActive={employee.isActive}
              disabled={!detail.available}
            />
          </div>
        ) : null}
      </div>

      <DatabaseUnavailableNotice message={availability.message} />
      <DatabaseUnavailableNotice message={compensationMessage} />
      <DatabaseUnavailableNotice message={documentsMessage} />
      <DatabaseUnavailableNotice message={rolesMessage} />

      {!employee ? (
        <p className="empty">ยังไม่มีข้อมูลพนักงานให้แสดง</p>
      ) : (
        <>
          <nav className="tabs" aria-label="แท็บข้อมูลพนักงาน">
            {TABS.map((item) => (
              <Link
                key={item.key}
                href={`/hr/employees/${employee.id}?tab=${item.key}`}
                aria-current={activeTab === item.key ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {activeTab === "general" ? (
            <EmployeeGeneralTab
              employee={employee}
              canEdit={canEdit}
              disabled={!detail.available}
            />
          ) : null}

          {activeTab === "branches" ? (
            <EmployeeBranchTab
              employee={employee}
              branches={branches.data}
              branchName={branchName}
              canEdit={canEdit}
              disabled={!detail.available}
            />
          ) : null}

          {activeTab === "employment" ? (
            <EmployeeEmploymentTab
              employee={employee}
              departments={departments.data.map((d) => ({
                id: d.id,
                label: d.nameTh,
              }))}
              positions={positions.data.map((p) => ({
                id: p.id,
                label: p.nameTh,
              }))}
              employmentTypes={master.data.employmentTypes.map((t) => ({
                id: t.id,
                label: t.nameTh,
              }))}
              employeeStatuses={master.data.employeeStatuses.map((s) => ({
                id: s.id,
                label: s.nameTh,
              }))}
              compensations={compensations}
              wageTypes={master.data.wageTypes.map((w) => ({
                id: w.id,
                label: w.nameTh,
              }))}
              canEdit={canEdit}
              canReadCompensation={canReadCompensation}
              canManageCompensation={canManageCompensation}
              disabled={!detail.available}
            />
          ) : null}

          {activeTab === "documents" ? (
            <EmployeeDocumentsPanel
              employeeId={employee.id}
              documents={documents}
              canEdit={canEdit}
              disabled={!detail.available}
            />
          ) : null}

          {activeTab === "roles" && roleState ? (
            <EmployeeRoleTab
              key={`${roleState.membershipId ?? "none"}-${roleState.assigned.map((r) => r.membershipRoleId).join(",")}`}
              employeeId={employee.id}
              initial={roleState}
              disabled={!detail.available}
            />
          ) : null}
        </>
      )}
    </HrShell>
  );
}
