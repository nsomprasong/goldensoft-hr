import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import DepartmentForm from "@/components/hr/department-form";
import ToggleActiveButton from "@/components/hr/toggle-active-button";
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
          <h1>แผนก</h1>
          <p>โครงสร้างแผนกขององค์กร {ctx.organizationName}</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={departments.message} />

      {departments.data.length === 0 ? (
        <p className="empty">ยังไม่มีแผนกในองค์กรนี้</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ (ไทย)</th>
                <th>ชื่อ (อังกฤษ)</th>
                <th>สถานะ</th>
                {canManage ? <th>จัดการ</th> : null}
              </tr>
            </thead>
            <tbody>
              {departments.data.map((row) => (
                <tr key={row.id}>
                  <td className="nowrap">{row.code}</td>
                  <td>{row.nameTh}</td>
                  <td>{row.nameEn}</td>
                  <td>
                    <span
                      className={
                        row.isActive ? "badge badge-active" : "badge badge-inactive"
                      }
                    >
                      {row.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </td>
                  {canManage ? (
                    <td>
                      <span className="inline-actions">
                        <Link
                          className="btn btn-sm"
                          href={`/hr/settings/departments?edit=${row.id}`}
                        >
                          แก้ไข
                        </Link>
                        <ToggleActiveButton
                          resource="departments"
                          id={row.id}
                          isActive={row.isActive}
                          disabled={!departments.available}
                        />
                      </span>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? (
        editing ? (
          <DepartmentForm
            key={editing.id}
            mode="edit"
            departmentId={editing.id}
            disabled={!departments.available}
            initialValues={{
              code: editing.code,
              nameTh: editing.nameTh,
              nameEn: editing.nameEn,
              description: editing.description ?? "",
            }}
          />
        ) : (
          <DepartmentForm mode="create" disabled={!departments.available} />
        )
      ) : null}
    </HrShell>
  );
}
