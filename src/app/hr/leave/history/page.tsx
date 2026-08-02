import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import LeaveApprovalCards from "@/components/hr/leave-approval-cards";
import HrShell from "@/components/hr-shell";
import { showEmployeeBranchLabel } from "@/lib/hr/api";
import { listLeaveHistory } from "@/lib/hr/data";
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
  return page > 1 ? `/hr/leave/history?page=${page}` : "/hr/leave/history";
}

export default async function LeaveHistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.leaveRead });
  const params = await searchParams;
  const page = Number.parseInt(single(params, "page") || "1", 10) || 1;
  const history = await listLeaveHistory(ctx, { page, pageSize: 10 });
  const result = history.data;
  const canApprove = canHr(ctx, HR_PERMISSIONS.leaveApprove);
  const showBranchLabel = showEmployeeBranchLabel(ctx);

  return (
    <HrShell ctx={ctx}>
      <DatabaseUnavailableNotice message={history.message} />

      <header className="hr-schedule-hero hr-leave-hero">
        <h1 className="hr-schedule-hero-title">ประวัติการลา</h1>
        <p className="hr-leave-hero-lead">
          ประวัติที่วันลาผ่านแล้ว · ทั้งหมด {result.total} รายการ · หน้าละ 10
        </p>
        <p>
          <Link className="btn btn-sm" href="/hr/leave">
            กลับหน้ารายการลา
          </Link>
        </p>
      </header>

      <section className="hr-ot-requests" aria-label="ประวัติคำขอลา">
        <LeaveApprovalCards
          rows={result.rows}
          canApprove={canApprove}
          showBranchLabel={showBranchLabel}
          emptyMessage="ยังไม่มีประวัติการลา"
        />
      </section>

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
