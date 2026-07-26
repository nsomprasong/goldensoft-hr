import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import PositionForm from "@/components/hr/position-form";
import ToggleActiveButton from "@/components/hr/toggle-active-button";
import HrShell from "@/components/hr-shell";
import { combineAvailability, listDepartments, listPositions } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.positionRead });
  const { edit } = await searchParams;

  const [positions, departments] = await Promise.all([
    listPositions(ctx),
    listDepartments(ctx),
  ]);
  const availability = combineAvailability(positions, departments);
  const canManage = canHr(ctx, HR_PERMISSIONS.positionManage);
  const editing = edit
    ? (positions.data.find((row) => row.id === edit) ?? null)
    : null;

  const departmentOptions = departments.data.map((d) => ({
    id: d.id,
    label: `${d.code} · ${d.nameTh}`,
  }));

  return (
    <HrShell ctx={ctx} active="positions">
      <div className="hr-page-head">
        <div>
          <h1>ตำแหน่ง</h1>
          <p>ตำแหน่งงานทั้งหมดขององค์กร {ctx.organizationName}</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      {positions.data.length === 0 ? (
        <p className="empty">ยังไม่มีตำแหน่งในองค์กรนี้</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ (ไทย)</th>
                <th>ชื่อ (อังกฤษ)</th>
                <th>สังกัดแผนก</th>
                <th>สถานะ</th>
                {canManage ? <th>จัดการ</th> : null}
              </tr>
            </thead>
            <tbody>
              {positions.data.map((row) => (
                <tr key={row.id}>
                  <td className="nowrap">{row.code}</td>
                  <td>{row.nameTh}</td>
                  <td>{row.nameEn}</td>
                  <td>{row.departmentNameTh ?? "—"}</td>
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
                          href={`/settings/positions?edit=${row.id}`}
                        >
                          แก้ไข
                        </Link>
                        <ToggleActiveButton
                          resource="positions"
                          id={row.id}
                          isActive={row.isActive}
                          disabled={!availability.available}
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
          <PositionForm
            key={editing.id}
            mode="edit"
            positionId={editing.id}
            departments={departmentOptions}
            disabled={!availability.available}
            initialValues={{
              code: editing.code,
              nameTh: editing.nameTh,
              nameEn: editing.nameEn,
              departmentId: editing.departmentId ?? "",
              description: editing.description ?? "",
            }}
          />
        ) : (
          <PositionForm
            mode="create"
            departments={departmentOptions}
            disabled={!availability.available}
          />
        )
      ) : null}
    </HrShell>
  );
}
