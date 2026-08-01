import { notFound } from "next/navigation";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import PayslipDetailView from "@/components/hr/payslip-detail-view";
import HrShell from "@/components/hr-shell";
import { getPayslip } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function MyPayslipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.payslipSelf });
  const { id } = await params;
  const payslip = await getPayslip(ctx, id);

  if (payslip.available && !payslip.data) {
    notFound();
  }

  return (
    <HrShell ctx={ctx}>
      <DatabaseUnavailableNotice message={payslip.message} />

      {!payslip.data ? (
        <p className="empty">ยังไม่พบข้อมูลสลิป หรือฐานข้อมูล HR ยังไม่พร้อม</p>
      ) : (
        <PayslipDetailView
          payslip={payslip.data}
          backHref="/hr/me/payslips"
          backLabel="สลิปเงินเดือนของฉัน"
        />
      )}
    </HrShell>
  );
}
