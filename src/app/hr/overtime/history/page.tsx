import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import OvertimeApprovalList from "@/components/hr/overtime-approval-list";
import HrShell from "@/components/hr-shell";
import { listOvertimeHistory } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function pageHref(page: number): string {
  return page > 1
    ? `/hr/overtime/history?page=${page}`
    : "/hr/overtime/history";
}

export default async function OvertimeHistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.overtimeRead });
  const params = await searchParams;
  const page = Number.parseInt(single(params, "page") || "1", 10) || 1;
  const history = await listOvertimeHistory(ctx, { page, pageSize: 10 });
  const result = history.data;
  const canApprove = canHr(ctx, HR_PERMISSIONS.overtimeApprove);

  return (
    <HrShell ctx={ctx}>
      <DatabaseUnavailableNotice message={history.message} />
      <OvertimeApprovalList
        rows={result.rows}
        canApprove={canApprove}
        heroLead={`ประวัติ OT ที่วันทำงานผ่านแล้ว · ทั้งหมด ${result.total} รายการ · หน้าละ 10`}
        heroAction={
          <Link className="btn btn-sm" href="/hr/overtime">
            กลับหน้ารายการ OT
          </Link>
        }
        emptyMessage="ยังไม่มีประวัติ OT"
      />
      <nav className="pagination" aria-label="แบ่งหน้า">
        {result.page > 1 ? (
          <Link className="btn btn-sm" href={pageHref(result.page - 1)}>
            ก่อนหน้า
          </Link>
        ) : null}
        <span>
          หน้า {result.page} จาก {result.pageCount}
        </span>
        {result.page < result.pageCount ? (
          <Link className="btn btn-sm" href={pageHref(result.page + 1)}>
            ถัดไป
          </Link>
        ) : null}
      </nav>
    </HrShell>
  );
}