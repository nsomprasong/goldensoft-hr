import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import AttendancePaySettingsForm from "@/components/hr/attendance-pay-settings-form";
import HrShell from "@/components/hr-shell";
import { getPayrollDeductionSettings } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function AttendancePaySettingsPage() {
  const ctx = await requireHrPage({
    permission: [
      HR_PERMISSIONS.payrollManage,
      HR_PERMISSIONS.settingsManage,
      HR_PERMISSIONS.payrollRead,
    ],
  });
  const settings = await getPayrollDeductionSettings(ctx);
  const canEdit = canHr(ctx, [
    HR_PERMISSIONS.payrollManage,
    HR_PERMISSIONS.settingsManage,
  ]);

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>หักสาย / ขาดงาน</h1>
          <p>ตั้งค่าการหักเมื่อประมวลผลเงินเดือน (OT ใช้กฎ OT ที่อนุมัติแล้ว)</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={settings.message} />

      {!settings.data ? (
        <p className="empty">ยังโหลดการตั้งค่าไม่ได้</p>
      ) : (
        <AttendancePaySettingsForm
          initial={settings.data}
          canEdit={canEdit && settings.available}
        />
      )}
    </HrShell>
  );
}
