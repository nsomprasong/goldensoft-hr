import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import PayrollScheduleForm from "@/components/hr/payroll-schedule-form";
import ToggleActiveButton from "@/components/hr/toggle-active-button";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  listPayrollSchedules,
  loadHrMasterData,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function PayrollSchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const ctx = await requireHrPage({
    permission: HR_PERMISSIONS.payrollScheduleRead,
  });
  const { edit } = await searchParams;

  const [schedules, master] = await Promise.all([
    listPayrollSchedules(ctx),
    loadHrMasterData(),
  ]);
  const availability = combineAvailability(schedules, master);
  const canManage = canHr(ctx, HR_PERMISSIONS.payrollScheduleManage);
  const editing = edit
    ? (schedules.data.find((row) => row.id === edit) ?? null)
    : null;

  const frequencyOptions = master.data.payFrequencies.map((f) => ({
    id: f.id,
    label: f.nameTh,
  }));

  return (
    <HrShell ctx={ctx} active="payroll-schedules">
      <div className="hr-page-head">
        <div>
          <h1>รอบจ่าย</h1>
          <p>กติกาการสร้างงวดเงินเดือนขององค์กร {ctx.organizationName}</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      {schedules.data.length === 0 ? (
        <p className="empty">ยังไม่มีรอบจ่ายในองค์กรนี้</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ</th>
                <th>ความถี่</th>
                <th>เริ่มงวด</th>
                <th>สิ้นงวด</th>
                <th>วันจ่าย</th>
                <th>สถานะ</th>
                {canManage ? <th>จัดการ</th> : null}
              </tr>
            </thead>
            <tbody>
              {schedules.data.map((row) => (
                <tr key={row.id}>
                  <td className="nowrap">{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.payFrequencyNameTh}</td>
                  <td className="nowrap">{row.periodStartRule}</td>
                  <td className="nowrap">{row.periodEndRule}</td>
                  <td className="nowrap">{row.paymentDayRule}</td>
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
                          href={`/hr/settings/payroll-schedules?edit=${row.id}`}
                        >
                          แก้ไข
                        </Link>
                        <ToggleActiveButton
                          resource="payroll-schedules"
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
          <PayrollScheduleForm
            key={editing.id}
            mode="edit"
            scheduleId={editing.id}
            payFrequencies={frequencyOptions}
            disabled={!availability.available}
            initialValues={{
              code: editing.code,
              name: editing.name,
              payFrequencyId: editing.payFrequencyId,
              periodStartRule: editing.periodStartRule,
              periodEndRule: editing.periodEndRule,
              paymentDayRule: editing.paymentDayRule,
              timezone: editing.timezone,
            }}
          />
        ) : (
          <PayrollScheduleForm
            mode="create"
            payFrequencies={frequencyOptions}
            disabled={!availability.available}
          />
        )
      ) : null}
    </HrShell>
  );
}
