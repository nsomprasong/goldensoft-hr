import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import OvertimeRuleForm from "@/components/hr/overtime-rule-form";
import ToggleActiveButton from "@/components/hr/toggle-active-button";
import HrShell from "@/components/hr-shell";
import {
  combineAvailability,
  listOvertimeRules,
  loadHrMasterData,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import { formatThaiDate } from "@/lib/hr/thai-date";

export const dynamic = "force-dynamic";

export default async function OvertimeRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const ctx = await requireHrPage({
    permission: [
      HR_PERMISSIONS.settingsManage,
      HR_PERMISSIONS.compensationManage,
      HR_PERMISSIONS.shiftManage,
    ],
  });
  const { edit } = await searchParams;

  const [rules, master] = await Promise.all([
    listOvertimeRules(ctx),
    loadHrMasterData(),
  ]);
  const availability = combineAvailability(rules, master);
  const canManage = canHr(ctx, HR_PERMISSIONS.settingsManage);
  const editing = edit
    ? (rules.data.find((row) => row.id === edit) ?? null)
    : null;

  const rateTypeOptions = master.data.overtimeRateTypes.map((t) => ({
    id: t.id,
    label: t.nameTh,
  }));

  return (
    <HrShell ctx={ctx} active="overtime-rules">
      <div className="hr-page-head">
        <div>
          <h1>กฎ OT</h1>
          <p>อัตราค่าล่วงเวลาขององค์กร {ctx.organizationName}</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      {rules.data.length === 0 ? (
        <p className="empty">ยังไม่มีกฎ OT ในองค์กรนี้</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ</th>
                <th>ประเภทอัตรา</th>
                <th>ตัวคูณ</th>
                <th>เงินคงที่</th>
                <th>เริ่มมีผล</th>
                <th>สิ้นสุด</th>
                <th>สถานะ</th>
                {canManage ? <th>จัดการ</th> : null}
              </tr>
            </thead>
            <tbody>
              {rules.data.map((row) => (
                <tr key={row.id}>
                  <td className="nowrap">{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.rateTypeNameTh}</td>
                  <td className="nowrap">{row.multiplier}</td>
                  <td className="nowrap">
                    {row.fixedAmount === null
                      ? "—"
                      : row.fixedAmount.toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                  </td>
                  <td className="nowrap">{formatThaiDate(row.effectiveFrom)}</td>
                  <td className="nowrap">{formatThaiDate(row.effectiveTo)}</td>
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
                          href={`/hr/settings/overtime-rules?edit=${row.id}`}
                        >
                          แก้ไข
                        </Link>
                        <ToggleActiveButton
                          resource="overtime-rules"
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
          <OvertimeRuleForm
            key={editing.id}
            mode="edit"
            overtimeRuleId={editing.id}
            rateTypes={rateTypeOptions}
            disabled={!availability.available}
            initialValues={{
              code: editing.code,
              name: editing.name,
              rateTypeId: editing.rateTypeId,
              multiplier: String(editing.multiplier),
              fixedAmount:
                editing.fixedAmount === null ? "" : String(editing.fixedAmount),
              effectiveFrom: editing.effectiveFrom,
              effectiveTo: editing.effectiveTo ?? "",
            }}
          />
        ) : (
          <OvertimeRuleForm
            mode="create"
            rateTypes={rateTypeOptions}
            disabled={!availability.available}
          />
        )
      ) : null}
    </HrShell>
  );
}
