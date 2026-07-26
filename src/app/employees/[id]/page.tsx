import Link from "next/link";
import { notFound } from "next/navigation";

import Alert, { DatabaseUnavailableNotice } from "@/components/hr/alert";
import CompensationForm from "@/components/hr/compensation-form";
import LinkPlatformUserForm from "@/components/hr/link-platform-user-form";
import ToggleActiveButton from "@/components/hr/toggle-active-button";
import HrShell from "@/components/hr-shell";
import {
  getEmployeeDetail,
  listEmployeeCompensations,
  loadHrMasterData,
  type CompensationRow,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "general", label: "ข้อมูลทั่วไป" },
  { key: "branches", label: "สาขา" },
  { key: "employment", label: "การจ้าง" },
] as const;

const COMPENSATION_TAB = { key: "compensation", label: "ค่าตอบแทน" } as const;

type TabKey = (typeof TABS)[number]["key"] | "compensation";

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

  const detail = await getEmployeeDetail(ctx, id);
  const employee = detail.data;

  if (detail.available && !employee) {
    notFound();
  }

  const canEdit = canHr(ctx, HR_PERMISSIONS.employeeUpdate);
  const canDeactivate = canHr(ctx, HR_PERMISSIONS.employeeDeactivate);
  const canLinkUser = canHr(ctx, HR_PERMISSIONS.employeeLinkUser);
  const canReadCompensation = canHr(ctx, HR_PERMISSIONS.compensationRead);
  const canManageCompensation = canHr(ctx, HR_PERMISSIONS.compensationManage);

  const tabs = canReadCompensation ? [...TABS, COMPENSATION_TAB] : TABS;
  const requested = (tab ?? "general") as TabKey;
  const activeTab: TabKey = tabs.some((t) => t.key === requested)
    ? requested
    : "general";

  let compensations: CompensationRow[] = [];
  let compensationMessage: string | null = null;
  let wageTypes: Array<{ id: string; label: string }> = [];

  if (canReadCompensation && activeTab === "compensation") {
    const [rows, master] = await Promise.all([
      listEmployeeCompensations(ctx, id),
      loadHrMasterData(),
    ]);
    compensations = rows.data;
    compensationMessage = rows.message ?? master.message;
    wageTypes = master.data.wageTypes.map((w) => ({
      id: w.id,
      label: w.nameTh,
    }));
  }

  return (
    <HrShell ctx={ctx} active="employees">
      <p className="breadcrumb">
        <Link href="/employees">พนักงาน</Link> ·{" "}
        {employee?.displayName ?? "รายละเอียด"}
      </p>

      <div className="hr-page-head">
        <div>
          <h1>{employee?.displayName ?? "รายละเอียดพนักงาน"}</h1>
          <p>
            รหัส {employee?.employeeCode ?? "—"} ·{" "}
            {employee?.statusNameTh ?? "ไม่ทราบสถานะ"}
          </p>
        </div>
        {employee && (canEdit || canDeactivate) ? (
          <div className="inline-actions">
            {canEdit ? (
              <Link className="btn" href={`/employees/${employee.id}/edit`}>
                แก้ไขข้อมูล
              </Link>
            ) : null}
            {canDeactivate ? (
              <ToggleActiveButton
                resource="employees"
                id={employee.id}
                isActive={employee.isActive}
                disabled={!detail.available}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <DatabaseUnavailableNotice message={detail.message} />

      {!employee ? (
        <p className="empty">ยังไม่มีข้อมูลพนักงานให้แสดง</p>
      ) : (
        <>
          <nav className="tabs" aria-label="แท็บข้อมูลพนักงาน">
            {tabs.map((item) => (
              <Link
                key={item.key}
                href={`/employees/${employee.id}?tab=${item.key}`}
                aria-current={item.key === activeTab ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {activeTab === "general" ? (
            <section className="card">
              <h2>ข้อมูลทั่วไป</h2>
              <dl className="dl">
                <dt>ชื่อ-นามสกุล (ไทย)</dt>
                <dd>
                  {employee.firstNameTh} {employee.lastNameTh}
                </dd>
                <dt>ชื่อ-นามสกุล (อังกฤษ)</dt>
                <dd>
                  {employee.firstNameEn || employee.lastNameEn
                    ? `${employee.firstNameEn ?? ""} ${employee.lastNameEn ?? ""}`.trim()
                    : "—"}
                </dd>
                <dt>เบอร์โทรศัพท์</dt>
                <dd>{employee.phone}</dd>
                <dt>อีเมล</dt>
                <dd>{employee.email ?? "—"}</dd>
                <dt>หมายเหตุ</dt>
                <dd>{employee.notes ?? "—"}</dd>
              </dl>
            </section>
          ) : null}

          {activeTab === "branches" ? (
            <>
              <section className="card">
                <h2>สาขา</h2>
                <dl className="dl">
                  <dt>สาขาที่สังกัด</dt>
                  <dd>
                    {ctx.branch?.id === employee.branchId
                      ? ctx.branch.name
                      : employee.branchId}
                  </dd>
                  <dt>บัญชีผู้ใช้บนแพลตฟอร์ม</dt>
                  <dd>{employee.platformUserId ?? "ยังไม่ได้เชื่อมบัญชี"}</dd>
                </dl>
                <p className="field-hint">
                  ย้ายสาขาได้จากหน้าแก้ไขข้อมูลพนักงาน
                </p>
              </section>

              {canLinkUser ? (
                <LinkPlatformUserForm
                  employeeId={employee.id}
                  platformUserId={employee.platformUserId}
                  authUserId={employee.authUserId}
                  disabled={!detail.available}
                />
              ) : null}
            </>
          ) : null}

          {activeTab === "employment" ? (
            <section className="card">
              <h2>การจ้าง</h2>
              <dl className="dl">
                <dt>ประเภทการจ้าง</dt>
                <dd>{employee.employmentTypeNameTh}</dd>
                <dt>แผนก</dt>
                <dd>{employee.departmentNameTh ?? "—"}</dd>
                <dt>ตำแหน่ง</dt>
                <dd>{employee.positionNameTh ?? "—"}</dd>
                <dt>วันเริ่มงาน</dt>
                <dd>{employee.hireDate}</dd>
                <dt>วันสิ้นสุดทดลองงาน</dt>
                <dd>{employee.probationEndDate ?? "—"}</dd>
                <dt>วันลาออก</dt>
                <dd>{employee.resignationDate ?? "—"}</dd>
                <dt>สถานะ</dt>
                <dd>
                  <span
                    className={
                      employee.isActive
                        ? "badge badge-active"
                        : "badge badge-inactive"
                    }
                  >
                    {employee.statusNameTh}
                  </span>
                </dd>
              </dl>
            </section>
          ) : null}

          {activeTab === "compensation" && canReadCompensation ? (
            <>
              <DatabaseUnavailableNotice message={compensationMessage} />
              <section className="card">
                <h2>ค่าตอบแทน</h2>
                {compensations.length === 0 ? (
                  <p className="empty">ยังไม่มีประวัติค่าจ้าง</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ประเภท</th>
                          <th>จำนวน</th>
                          <th>สกุลเงิน</th>
                          <th>มีผลตั้งแต่</th>
                          <th>สิ้นสุด</th>
                          <th>OT</th>
                          <th>ปัจจุบัน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compensations.map((row) => (
                          <tr key={row.id}>
                            <td>{row.wageTypeNameTh}</td>
                            <td>{row.amount}</td>
                            <td>{row.currency}</td>
                            <td className="nowrap">{row.effectiveFrom}</td>
                            <td className="nowrap">{row.effectiveTo ?? "—"}</td>
                            <td>{row.overtimeEligible ? "ได้" : "ไม่ได้"}</td>
                            <td>{row.isCurrent ? "ใช่" : "ไม่ใช่"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {canManageCompensation ? (
                <CompensationForm
                  employeeId={employee.id}
                  wageTypes={wageTypes}
                  disabled={compensationMessage !== null}
                />
              ) : (
                <Alert kind="info">
                  คุณมีสิทธิ์ดูค่าตอบแทนเท่านั้น ไม่สามารถเพิ่มรายการได้
                </Alert>
              )}
            </>
          ) : null}
        </>
      )}
    </HrShell>
  );
}
