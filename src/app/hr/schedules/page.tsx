import OperationsWorkspace from "@/components/hr/operations-workspace";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function SchedulesPage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.scheduleRead });
  return <HrShell ctx={ctx}><OperationsWorkspace title="ตารางกะงาน" description="สร้างช่วงตารางและกำหนดกะให้พนักงาน" emptyMessage="ยังไม่มีช่วงตารางกะงาน" endpoint="/api/hr/schedule-periods" actions={[{ label: "สร้างช่วงตาราง", action: "create" }]} /></HrShell>;
}
