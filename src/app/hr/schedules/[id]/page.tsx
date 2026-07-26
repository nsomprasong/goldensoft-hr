import OperationsWorkspace from "@/components/hr/operations-workspace";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function ScheduleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.scheduleRead });
  const { id } = await params;
  return (
    <HrShell ctx={ctx}>
      <OperationsWorkspace title="ร่างตารางกะงาน" description={`ช่วงตาราง ${id} · แก้ไขก่อนเผยแพร่`} emptyMessage="ยังไม่มีพนักงานหรือรายการกะในร่างนี้" endpoint={`/api/hr/schedule-periods/${id}/assignments`} actions={[{ label: "กำหนดช่วงเวลา", action: "assign_period", confirm: true }, { label: "คัดลอกแถว", action: "copy_row", confirm: true }, { label: "ลบแถว", action: "delete_row", confirm: true }]}>
        <section className="card"><h2>ตารางร่าง</h2><div className="table-wrap"><table><thead><tr><th>พนักงาน</th><th>วันที่</th><th>กะงาน</th><th>สถานะ</th></tr></thead><tbody><tr><td colSpan={4} className="empty">ยังไม่มีแถวในตาราง</td></tr></tbody></table></div></section>
      </OperationsWorkspace>
    </HrShell>
  );
}
