import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function MyPayslipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.payslipSelf });
  const { id } = await params;
  return (
    <HrShell ctx={ctx}>
      <article className="card payslip-print">
        <h1>สลิปเงินเดือน</h1><p>เลขที่เอกสาร: {id}</p>
        <p className="empty">ยังไม่พบข้อมูลสลิป หรือฐานข้อมูล HR ยังไม่พร้อม</p>
        <p>หน้านี้จัดรูปแบบสำหรับการพิมพ์จากเบราว์เซอร์ โดยไม่มีปุ่มดาวน์โหลด PDF ที่ไม่พร้อมใช้งาน</p>
      </article>
    </HrShell>
  );
}
