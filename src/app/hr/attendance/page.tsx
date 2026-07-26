import OperationsWorkspace from "@/components/hr/operations-workspace"; import HrShell from "@/components/hr-shell"; import { requireHrPage } from "@/lib/hr/guards"; import { HR_PERMISSIONS } from "@/lib/hr/permissions";
export const dynamic = "force-dynamic";
export default async function AttendancePage() { const ctx = await requireHrPage({ permission: HR_PERMISSIONS.attendanceRead }); return <HrShell ctx={ctx}><OperationsWorkspace title="เวลาทำงาน" description="สรุปการลงเวลาของพนักงาน" emptyMessage="ยังไม่มีข้อมูลเวลาทำงานตามเงื่อนไข" endpoint="/api/hr/attendance" /></HrShell>; }
