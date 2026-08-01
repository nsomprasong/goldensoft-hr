import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import EmployeeAvatar from "@/components/hr/employee-avatar";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  listEmployees,
  loadHrMasterData,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import { formatThaiDate } from "@/lib/hr/thai-date";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function pageHref(params: SearchParams, page: number): string {
  const query = new URLSearchParams();
  for (const key of ["q", "employeeStatusId", "employmentTypeId"]) {
    const value = single(params, key);
    if (value) query.set(key, value);
  }
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();
  return qs ? `/hr/employees?${qs}` : "/hr/employees";
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.employeeRead });
  const params = await searchParams;

  const search = single(params, "q");
  // Branch scope comes from the top context switcher — not a page filter.
  const branchId = ctx.branchId ?? "";
  const employeeStatusId = single(params, "employeeStatusId");
  const employmentTypeId = single(params, "employmentTypeId");
  const page = Number.parseInt(single(params, "page") || "1", 10) || 1;

  const [master, list] = await Promise.all([
    loadHrMasterData(),
    listEmployees(ctx, {
      search,
      branchId,
      employeeStatusId,
      employmentTypeId,
      page,
    }),
  ]);

  const availability = combineAvailability(master, list);
  const result = list.data;
  const canCreate = canHr(ctx, HR_PERMISSIONS.employeeCreate);
  const branchLabel = ctx.branch?.name ?? null;

  return (
    <HrShell ctx={ctx} active="employees">
      <div className="hr-page-head">
        <div>
          <h1>พนักงาน</h1>
          <p>
            {branchLabel
              ? `สาขา ${branchLabel} — ${result.total} คน`
              : `ทุกสาขาที่มีสิทธิ์ — ${result.total} คน`}
            {" — กด + เพื่อเพิ่มพนักงาน"}
          </p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      <form className="card" method="get" action="/hr/employees">
        <div className="filters">
          <div className="field">
            <label htmlFor="q">ค้นหา</label>
            <input
              id="q"
              name="q"
              defaultValue={search}
              placeholder="ชื่อ / เบอร์โทร"
            />
          </div>

          <div className="field">
            <label htmlFor="employeeStatusId">สถานะ</label>
            <select
              id="employeeStatusId"
              name="employeeStatusId"
              defaultValue={employeeStatusId}
            >
              <option value="">ทุกสถานะ</option>
              {master.data.employeeStatuses.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.nameTh}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="employmentTypeId">ประเภทการจ้าง</label>
            <select
              id="employmentTypeId"
              name="employmentTypeId"
              defaultValue={employmentTypeId}
            >
              <option value="">ทุกประเภท</option>
              {master.data.employmentTypes.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.nameTh}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <button type="submit" className="btn btn-primary">
              ค้นหา
            </button>
          </div>
        </div>
      </form>

      {result.rows.length === 0 ? (
        <p className="empty">ไม่พบข้อมูลพนักงานตามเงื่อนไขที่เลือก</p>
      ) : (
        <div className="hr-card-grid">
          {result.rows.map((employee) => (
            <article
              key={employee.id}
              className={
                employee.isActive
                  ? "card hr-entity-card"
                  : "card hr-entity-card hr-entity-card--inactive"
              }
            >
              <div className="hr-entity-card-top">
                <div className="hr-employee-card-head">
                  <EmployeeAvatar
                    displayName={employee.displayName}
                    photoUrl={employee.photoUrl}
                    size="md"
                  />
                  <div className="hr-entity-card-title-wrap">
                    <h2 className="hr-entity-card-title">
                      <Link
                        className="hr-employee-card-name"
                        href={`/hr/employees/${employee.id}?tab=general`}
                      >
                        {employee.displayName}
                      </Link>
                    </h2>
                  </div>
                </div>
                <span
                  className={
                    employee.isActive
                      ? "badge badge-active"
                      : "badge badge-inactive"
                  }
                >
                  {employee.statusNameTh}
                </span>
              </div>

              <dl className="hr-entity-card-meta">
                <div>
                  <dt>แผนก</dt>
                  <dd>{employee.departmentNameTh ?? "—"}</dd>
                </div>
                <div>
                  <dt>ตำแหน่ง</dt>
                  <dd>{employee.positionNameTh ?? "—"}</dd>
                </div>
                <div>
                  <dt>ประเภทการจ้าง</dt>
                  <dd>{employee.employmentTypeNameTh}</dd>
                </div>
                <div>
                  <dt>วันเริ่มงาน</dt>
                  <dd>{formatThaiDate(employee.hireDate)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}

      <nav className="pagination" aria-label="แบ่งหน้า">
        {result.page > 1 ? (
          <Link className="btn btn-sm" href={pageHref(params, result.page - 1)}>
            ก่อนหน้า
          </Link>
        ) : null}
        <span>
          หน้า {result.page} จาก {result.pageCount}
        </span>
        {result.page < result.pageCount ? (
          <Link className="btn btn-sm" href={pageHref(params, result.page + 1)}>
            ถัดไป
          </Link>
        ) : null}
      </nav>

      {canCreate ? (
        <Link
          className="hr-fab"
          href="/hr/employees/new"
          aria-label="เพิ่มพนักงาน"
          title="เพิ่มพนักงาน"
        >
          <span aria-hidden="true">+</span>
        </Link>
      ) : null}
    </HrShell>
  );
}
