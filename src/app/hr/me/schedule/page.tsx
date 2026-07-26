import OperationsWorkspace from "@/components/hr/operations-workspace";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function MySchedulePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.scheduleRead });
  return <HrShell ctx={ctx}><OperationsWorkspace title="ตารางงานของฉัน" description="กะงานและวันหยุดที่ได้รับมอบหมาย" emptyMessage="ยังไม่มีตารางงานที่เผยแพร่สำหรับช่วงเวลานี้" endpoint="/api/hr/me/schedule" /></HrShell>;
}
