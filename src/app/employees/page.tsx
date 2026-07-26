import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  listEmployeeBranchIds,
  listEmployees,
  loadHrMasterData,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function pageHref(params: SearchParams, page: number): string {
  const query = new URLSearchParams();
  for (const key of ["q", "branchId", "employeeStatusId", "employmentTypeId"]) {
    const value = single(params, key);
    if (value) query.set(key, value);
  }
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();
  return qs ? `/employees?${qs}` : "/employees";
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.employeeRead });
  const params = await searchParams;

  const search = single(params, "q");
  const branchId = single(params, "branchId");
  const employeeStatusId = single(params, "employeeStatusId");
  const employmentTypeId = single(params, "employmentTypeId");
  const page = Number.parseInt(single(params, "page") || "1", 10) || 1;

  const [master, list, branchIds] = await Promise.all([
    loadHrMasterData(),
    listEmployees(ctx, {
      search,
      branchId,
      employeeStatusId,
      employmentTypeId,
      page,
    }),
    listEmployeeBranchIds(ctx),
  ]);

  const availability = combineAvailability(master, list, branchIds);
  const result = list.data;
  const canCreate = canHr(ctx, HR_PERMISSIONS.employeeCreate);

  const branchOptions = [
    ...(ctx.branch ? [{ id: ctx.branch.id, label: ctx.branch.name }] : []),
    ...branchIds.data
      .filter((id) => id !== ctx.branch?.id)
      .map((id) => ({ id, label: `สาขา ${id.slice(0, 8)}` })),
  ];

  return (
    <HrShell ctx={ctx} active="employees">
      <div className="hr-page-head">
        <div>
          <h1>พนักงาน</h1>
          <p>ทั้งหมด {result.total} คน</p>
        </div>
        {canCreate ? (
          <Link className="btn btn-primary" href="/employees/new">
            เพิ่มพนักงาน
          </Link>
        ) : null}
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      <form className="card" method="get" action="/employees">
        <div className="filters">
          <div className="field">
            <label htmlFor="q">ค้นหา</label>
            <input
              id="q"
              name="q"
              defaultValue={search}
              placeholder="ชื่อ / รหัสพนักงาน / เบอร์โทร"
            />
          </div>

          <div className="field">
            <label htmlFor="branchId">สาขา</label>
            <select id="branchId" name="branchId" defaultValue={branchId}>
              <option value="">ทุกสาขา</option>
              {branchOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ</th>
                <th>แผนก</th>
                <th>ตำแหน่ง</th>
                <th>ประเภทการจ้าง</th>
                <th>สถานะ</th>
                <th>วันเริ่มงาน</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((employee) => (
                <tr key={employee.id}>
                  <td className="nowrap">{employee.employeeCode}</td>
                  <td>
                    <Link href={`/employees/${employee.id}`}>
                      {employee.displayName}
                    </Link>
                  </td>
                  <td>{employee.departmentNameTh ?? "—"}</td>
                  <td>{employee.positionNameTh ?? "—"}</td>
                  <td>{employee.employmentTypeNameTh}</td>
                  <td>
                    <span
                      className={
                        employee.isActive ? "badge badge-active" : "badge badge-inactive"
                      }
                    >
                      {employee.statusNameTh}
                    </span>
                  </td>
                  <td className="nowrap">{employee.hireDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </HrShell>
  );
}
