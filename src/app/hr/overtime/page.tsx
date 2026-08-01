import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import OvertimeApprovalList from "@/components/hr/overtime-approval-list";
import HrShell from "@/components/hr-shell";
import { listOvertimeRequests } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function OvertimePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.overtimeRead });
  const list = await listOvertimeRequests(ctx, null, { view: "inbox" });
  const canApprove = canHr(ctx, HR_PERMISSIONS.overtimeApprove);
  const pendingCount = list.data.filter(
    (row) => row.statusCode === "SUBMITTED",
  ).length;

  return (
    <HrShell ctx={ctx}>
      <DatabaseUnavailableNotice message={list.message} />
      <OvertimeApprovalList
        rows={list.data}
        canApprove={canApprove}
        heroLead={`รออนุมัติ ${pendingCount} รายการ · แสดงผลจนถึงวันทำงาน OT`}
        heroAction={
          <Link className="btn btn-sm" href="/hr/overtime/history">
            ดูประวัติย้อนหลัง
          </Link>
        }
        emptyMessage="ไม่มีคำขอรออนุมัติ หรือผลอนุมัติที่วัน OT ยังไม่ผ่าน"
      />
    </HrShell>
  );
}
