import OperationsWorkspace from "@/components/hr/operations-workspace"; import HrShell from "@/components/hr-shell"; import { requireHrPage } from "@/lib/hr/guards"; import { HR_PERMISSIONS } from "@/lib/hr/permissions";
export const dynamic = "force-dynamic";
export default async function LeavePage() { const ctx = await requireHrPage({ permission: HR_PERMISSIONS.leaveRead }); return <HrShell ctx={ctx}><OperationsWorkspace title="การลา" description="คำขอลาของพนักงานและสถานะการอนุมัติ" emptyMessage="ยังไม่มีคำขอลา" endpoint="/api/hr/leave-requests" /></HrShell>; }
