import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import HrShell from "@/components/hr-shell";
import {
  listApprovalHistory,
  listOrganizationBranches,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { formatThaiDate } from "@/lib/hr/thai-date";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function pageHref(params: SearchParams, page: number): string {
  const query = new URLSearchParams();
  const branchId = single(params, "branchId");
  if (branchId) query.set("branchId", branchId);
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();
  return qs ? `/hr/approvals/history?${qs}` : "/hr/approvals/history";
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatThaiDate(iso.slice(0, 10));
  } catch {
    return "—";
  }
}

export default async function ApprovalHistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireHrPage({
    permission: [
      HR_PERMISSIONS.approvalRead,
      HR_PERMISSIONS.leaveApprove,
      HR_PERMISSIONS.overtimeApprove,
    ],
  });
  const params = await searchParams;
  const branchId = single(params, "branchId") || null;
  const page = Number.parseInt(single(params, "page") || "1", 10) || 1;

  const [history, branches] = await Promise.all([
    listApprovalHistory(ctx, { page, pageSize: 10, branchId }),
    listOrganizationBranches(ctx),
  ]);
  const result = history.data;
  const branchOptions = branches.data;

  return (
    <HrShell ctx={ctx}>
      <DatabaseUnavailableNotice message={history.message} />

      <header className="hr-schedule-hero hr-leave-hero">
        <h1 className="hr-schedule-hero-title">ประวัติอนุมัติ</h1>
        <p className="hr-leave-hero-lead">
          รายการที่วันลา/วันทำงานผ่านแล้ว · เรียงตามสาขา · ทั้งหมด{" "}
          {result.total} รายการ · หน้าละ 10
        </p>
        <p>
          <Link className="btn btn-sm" href="/hr/approvals">
            กลับคิวรออนุมัติ
          </Link>
        </p>
      </header>

      <form className="card" method="get" action="/hr/approvals/history">
        <div className="filters">
          <label>
            สาขา
            <select name="branchId" defaultValue={branchId ?? ""}>
              <option value="">ทุกสาขาที่มีสิทธิ์</option>
              {branchOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-actions">
            <button className="btn" type="submit">
              กรอง
            </button>
            {branchId ? (
              <Link className="btn btn-sm" href="/hr/approvals/history">
                ล้างตัวกรอง
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      {result.rows.length === 0 ? (
        <p className="empty">ยังไม่มีประวัติอนุมัติ</p>
      ) : (
        <ul className="hr-dash-inbox" aria-label="ประวัติอนุมัติ">
          {result.rows.map((row) => (
            <li key={`${row.kind}:${row.id}`}>
              <div>
                <strong>{row.employeeName}</strong>
                <span className="hr-dash-inbox-branch">{row.branchName}</span>
                <span>
                  {row.label} ·{" "}
                  {row.decision === "APPROVED" ? "อนุมัติ" : "ปฏิเสธ"}
                </span>
                <span className="muted">โดย {row.reviewedByName}</span>
              </div>
              <div className="hr-dash-inbox-meta">
                <time>{formatWhen(row.reviewedAt)}</time>
              </div>
            </li>
          ))}
        </ul>
      )}

      <nav className="pagination" aria-label="แบ่งหน้า">
        {result.page > 1 ? (
          <Link className="btn btn-sm" href={pageHref(params, result.page - 1)}>
            ก่อนหน้า
          </Link>
        ) : null}
        <span>
          หน้า {result.page} จาก {result.pageCount}
        </span>
        {result.page < result.pageCount ? (
          <Link className="btn btn-sm" href={pageHref(params, result.page + 1)}>
            ถัดไป
          </Link>
        ) : null}
      </nav>
    </HrShell>
  );
}
