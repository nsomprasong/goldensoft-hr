import OperationsWorkspace from "@/components/hr/operations-workspace";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function MyOvertimePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.overtimeSelf });
  return <HrShell ctx={ctx}><OperationsWorkspace title="OT ของฉัน" description="ยื่นคำขอทำงานล่วงเวลาและติดตามการอนุมัติ" emptyMessage="ยังไม่มีคำขอ OT" endpoint="/api/hr/overtime/requests" actions={[{ label: "ยื่นคำขอ OT", action: "create" }]} /></HrShell>;
}
