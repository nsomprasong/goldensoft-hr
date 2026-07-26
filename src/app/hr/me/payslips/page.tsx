import OperationsWorkspace from "@/components/hr/operations-workspace";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function MyPayslipsPage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.payslipSelf });
  return <HrShell ctx={ctx}><OperationsWorkspace title="สลิปเงินเดือนของฉัน" description="รายการสลิปที่ออกให้แล้ว" emptyMessage="ยังไม่มีสลิปเงินเดือนที่ออกให้" endpoint="/api/hr/payslips/self" /></HrShell>;
}
