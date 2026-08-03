import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import LeaveEntitlementsWorkspace from "@/components/hr/leave-entitlements-workspace";
import HrPageBackButton from "@/components/hr/hr-page-back-button";
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
  const selectedBranchId = ctx.branchId ?? null;

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>สิทธิ์วันลา</h1>
          <p>
            {selectedBranchId
              ? "สิทธิ์ของสาขาที่เลือก"
              : "ค่าเริ่มต้นองค์กร · เลือกสาขาที่หัวเว็บเพื่อแก้รายสาขา"}
          </p>
        </div>
        <HrPageBackButton href="/hr/settings" />
      </div>

      <DatabaseUnavailableNotice message={settingsError ?? branches.message} />

      {settings ? (
        <LeaveEntitlementsWorkspace
          leaveTypes={settings.leaveTypes}
          policies={settings.policies}
          branches={branches.data}
          selectedBranchId={selectedBranchId}
        />
      ) : null}
    </HrShell>
  );
}
