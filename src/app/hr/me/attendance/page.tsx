import OperationsWorkspace from "@/components/hr/operations-workspace";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function MyAttendancePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.attendanceSelf });
  return <HrShell ctx={ctx}><OperationsWorkspace title="ลงเวลาของฉัน" description="ลงเวลาพร้อมตรวจสอบตำแหน่ง ณ เวลาที่ส่งรายการ" emptyMessage="ยังไม่มีประวัติลงเวลาวันนี้" endpoint="/api/hr/attendance/clock" /></HrShell>;
}
