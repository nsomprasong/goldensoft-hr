import OperationsWorkspace from "@/components/hr/operations-workspace"; import HrShell from "@/components/hr-shell"; import { requireHrPage } from "@/lib/hr/guards"; import { HR_PERMISSIONS } from "@/lib/hr/permissions";
export const dynamic = "force-dynamic";
export default async function OvertimePage() { const ctx = await requireHrPage({ permission: HR_PERMISSIONS.overtimeRead }); return <HrShell ctx={ctx}><OperationsWorkspace title="ทำงานล่วงเวลา" description="คำขอ OT และการอนุมัติขององค์กร" emptyMessage="ยังไม่มีคำขอทำงานล่วงเวลา" endpoint="/api/hr/overtime-requests" /></HrShell>; }
