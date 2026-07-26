import OperationsWorkspace from "@/components/hr/operations-workspace"; import HrShell from "@/components/hr-shell"; import { requireHrPage } from "@/lib/hr/guards"; import { HR_PERMISSIONS } from "@/lib/hr/permissions";
export const dynamic = "force-dynamic";
export default async function ReportsPage() { const ctx = await requireHrPage({ permission: HR_PERMISSIONS.reportRead }); return <HrShell ctx={ctx}><OperationsWorkspace title="รายงาน" description="รายงานการลงเวลา การลา OT และเงินเดือนตามสิทธิ์" emptyMessage="ยังไม่มีรายงานที่พร้อมแสดง" endpoint="/api/hr/reports" /></HrShell>; }
