import MeLeaveWorkspace from "@/components/hr/me-leave-workspace";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function MyLeavePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.leaveSelf });
  return (
    <HrShell ctx={ctx}>
      <MeLeaveWorkspace />
    </HrShell>
  );
}
