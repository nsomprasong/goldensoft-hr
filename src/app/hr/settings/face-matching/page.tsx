import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import FaceMatchingSettingsForm from "@/components/hr/face-matching-settings-form";
import HrShell from "@/components/hr-shell";
import { getAttendanceFaceSettings } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function FaceMatchingSettingsPage() {
  const ctx = await requireHrPage({
    permission: [
      HR_PERMISSIONS.settingsManage,
      HR_PERMISSIONS.attendanceManage,
      HR_PERMISSIONS.attendanceRead,
    ],
  });
  const settings = await getAttendanceFaceSettings(ctx);
  const canEdit = canHr(ctx, [
    HR_PERMISSIONS.settingsManage,
    HR_PERMISSIONS.attendanceManage,
  ]);

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>ตรวจใบหน้าตอนลงเวลา</h1>
          <p>ตั้งค่าโหมดจับคู่ใบหน้าขององค์กร (Phase 8)</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={settings.message} />

      {!settings.data ? (
        <p className="empty">ยังโหลดการตั้งค่าไม่ได้</p>
      ) : (
        <FaceMatchingSettingsForm
          initial={settings.data}
          canEdit={canEdit && settings.available}
        />
      )}
    </HrShell>
  );
}
