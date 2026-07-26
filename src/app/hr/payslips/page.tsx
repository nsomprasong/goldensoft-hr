import OperationsWorkspace from "@/components/hr/operations-workspace"; import HrShell from "@/components/hr-shell"; import { requireHrPage } from "@/lib/hr/guards"; import { HR_PERMISSIONS } from "@/lib/hr/permissions";
export const dynamic = "force-dynamic";
export default async function PayslipsPage() { const ctx = await requireHrPage({ permission: HR_PERMISSIONS.payslipRead }); return <HrShell ctx={ctx}><OperationsWorkspace title="สลิปเงินเดือน" description="สลิปที่ออกให้พนักงานแล้ว" emptyMessage="ยังไม่มีสลิปเงินเดือน" endpoint="/api/hr/payslips" /></HrShell>; }
