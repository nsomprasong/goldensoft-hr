import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import PayrollDeductionSettingsForm from "@/components/hr/payroll-deduction-settings-form";
import HrShell from "@/components/hr-shell";
import { getPayrollDeductionSettings } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function PayrollDeductionsSettingsPage() {
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
          <h1>ภาษีและประกันสังคม</h1>
          <p>อัตราหักที่ใช้ประมาณการตอนประมวลผลเงินเดือน</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={settings.message} />

      {!settings.data ? (
        <p className="empty">ยังโหลดการตั้งค่าไม่ได้</p>
      ) : (
        <PayrollDeductionSettingsForm
          initial={settings.data}
          canEdit={canEdit && settings.available}
        />
      )}
    </HrShell>
  );
}
