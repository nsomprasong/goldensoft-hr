import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import ShiftForm from "@/components/hr/shift-form";
import ToggleActiveButton from "@/components/hr/toggle-active-button";
import HrShell from "@/components/hr-shell";
import { combineAvailability, listShifts, loadHrMasterData } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.shiftRead });
  const { edit } = await searchParams;

  const [shifts, master] = await Promise.all([
    listShifts(ctx),
    loadHrMasterData(),
  ]);
  const availability = combineAvailability(shifts, master);
  const canManage = canHr(ctx, HR_PERMISSIONS.shiftManage);
  const editing = edit
    ? (shifts.data.find((row) => row.id === edit) ?? null)
    : null;

  const shiftTypeOptions = master.data.shiftTypes.map((t) => ({
    id: t.id,
    label: t.nameTh,
  }));
  const branchOptions = ctx.branch
    ? [{ id: ctx.branch.id, label: ctx.branch.name }]
    : [];

  return (
    <HrShell ctx={ctx} active="shifts">
      <div className="hr-page-head">
        <div>
          <h1>กะงาน</h1>
          <p>แม่แบบกะงานสำหรับใช้กับการลงเวลาในเฟสถัดไป</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      {shifts.data.length === 0 ? (
        <p className="empty">ยังไม่มีกะงานในองค์กรนี้</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อกะ</th>
                <th>ประเภท</th>
                <th>เวลา</th>
                <th>พัก (นาที)</th>
                <th>ข้ามวัน</th>
                <th>สถานะ</th>
                {canManage ? <th>จัดการ</th> : null}
              </tr>
            </thead>
            <tbody>
              {shifts.data.map((row) => (
                <tr key={row.id}>
                  <td className="nowrap">{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.shiftTypeNameTh}</td>
                  <td className="nowrap">
                    {row.startTime} – {row.endTime}
                  </td>
                  <td>{row.breakMinutes}</td>
                  <td>{row.crossesMidnight ? "ใช่" : "ไม่ใช่"}</td>
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
                          href={`/hr/settings/shifts?edit=${row.id}`}
                        >
                          แก้ไข
                        </Link>
                        <ToggleActiveButton
                          resource="shifts"
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
          <ShiftForm
            key={editing.id}
            mode="edit"
            shiftId={editing.id}
            shiftTypes={shiftTypeOptions}
            branches={branchOptions}
            disabled={!availability.available}
            initialValues={{
              code: editing.code,
              name: editing.name,
              shiftTypeId: editing.shiftTypeId,
              branchId: editing.branchId ?? "",
              startTime: editing.startTime,
              endTime: editing.endTime,
              breakMinutes: String(editing.breakMinutes),
              graceLateMinutes: String(editing.graceLateMinutes),
              graceEarlyLeaveMinutes: String(editing.graceEarlyLeaveMinutes),
              overtimeAfterMinutes:
                editing.overtimeAfterMinutes === null
                  ? ""
                  : String(editing.overtimeAfterMinutes),
              crossesMidnight: editing.crossesMidnight,
            }}
          />
        ) : (
          <ShiftForm
            mode="create"
            shiftTypes={shiftTypeOptions}
            branches={branchOptions}
            disabled={!availability.available}
          />
        )
      ) : null}
    </HrShell>
  );
}
