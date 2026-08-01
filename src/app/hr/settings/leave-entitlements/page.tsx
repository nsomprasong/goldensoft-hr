import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import LeaveEntitlementsWorkspace from "@/components/hr/leave-entitlements-workspace";
import HrShell from "@/components/hr-shell";
import {
  listOrganizationBranches,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { resolveAllowedBranchIds } from "@/lib/hr/api";
import { listLeaveEntitlementSettings } from "@/lib/hr/services/leave-entitlements";
import { toHrServiceContext } from "@/lib/hr/services/shared";

export const dynamic = "force-dynamic";

export default async function LeaveEntitlementsSettingsPage() {
  const ctx = await requireHrPage({
    permission: [HR_PERMISSIONS.leaveManage, HR_PERMISSIONS.settingsManage],
  });
  const service = toHrServiceContext(ctx, {
    allowedBranchIds: resolveAllowedBranchIds(ctx),
  });

  let settings: Awaited<ReturnType<typeof listLeaveEntitlementSettings>> | null =
    null;
  let settingsError: string | null = null;
  try {
    settings = await listLeaveEntitlementSettings(service);
  } catch {
    settingsError = "ยังโหลดสิทธิ์วันลาไม่ได้ — ตรวจ migration หรือสิทธิ์ผู้ใช้";
  }

  const branches = await listOrganizationBranches(ctx);

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>สิทธิ์วันลา</h1>
          <p>
            ตั้งจำนวนวันลาขององค์กร และให้สาขาดึงไปใช้หรือกำหนดเองได้
          </p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={settingsError ?? branches.message} />

      {settings ? (
        <LeaveEntitlementsWorkspace
          leaveTypes={settings.leaveTypes}
          policies={settings.policies}
          branches={branches.data}
        />
      ) : null}
    </HrShell>
  );
}
