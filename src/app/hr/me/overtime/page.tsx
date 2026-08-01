import MeOvertimeWorkspace from "@/components/hr/me-overtime-workspace";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function MyOvertimePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.overtimeSelf });
  return (
    <HrShell ctx={ctx}>
      <MeOvertimeWorkspace />
    </HrShell>
  );
}
