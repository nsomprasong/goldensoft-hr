import OperationsWorkspace from "@/components/hr/operations-workspace";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function MyLeavePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.leaveSelf });
  return <HrShell ctx={ctx}><OperationsWorkspace title="การลาของฉัน" description="ยื่นคำขอลาและติดตามการอนุมัติ" emptyMessage="ยังไม่มีคำขอลา" endpoint="/api/hr/leave/requests" actions={[{ label: "ยื่นคำขอลา", action: "create" }]} /></HrShell>;
}
