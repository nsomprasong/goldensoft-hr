import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import AutoSubmitSelect from "@/components/hr/auto-submit-select";
import EmployeeAvatar from "@/components/hr/employee-avatar";
import EmployeeNameLabel from "@/components/hr/employee-name-label";
import HrPageBackButton from "@/components/hr/hr-page-back-button";
import HrShell from "@/components/hr-shell";
import { showEmployeeBranchLabel } from "@/lib/hr/api";
import {
  listApprovalHistory,
  listOrganizationBranches,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { formatThaiDateReadable } from "@/lib/hr/thai-date";

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

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return formatThaiDateReadable(iso.slice(0, 10));
  } catch {
    return "—";
  }
}

function statusClass(decision: "APPROVED" | "REJECTED"): string {
  if (decision === "APPROVED") return "badge badge-active";
  return "badge badge-inactive";
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
  const showBranchLabel = showEmployeeBranchLabel(ctx);

  return (
    <HrShell ctx={ctx}>
      <DatabaseUnavailableNotice message={history.message} />

      <div className="hr-page-head">
        <div>
          <h1>ประวัติอนุมัติ</h1>
          <p>
            รายการที่วันลา/วันทำงานผ่านแล้ว · เรียงตามวันที่ แล้วสาขา และชื่อ ·
            ทั้งหมด {result.total} รายการ · หน้าละ 10
          </p>
        </div>
        <HrPageBackButton href="/hr/approvals" />
      </div>

      <form className="hr-history-filters" method="get" action="/hr/approvals/history">
        <div className="filters">
          <label htmlFor="history-branchId">
            สาขา
            <AutoSubmitSelect
              id="history-branchId"
              name="branchId"
              defaultValue={branchId ?? ""}
              aria-label="กรองตามสาขา"
            >
              <option value="">ทุกสาขาที่มีสิทธิ์</option>
              {branchOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </AutoSubmitSelect>
          </label>
        </div>
      </form>

      {result.rows.length === 0 ? (
        <p className="empty">ยังไม่มีประวัติอนุมัติ</p>
      ) : (
        <section className="hr-ot-requests" aria-label="ประวัติอนุมัติ">
          <ul className="hr-leave-request-list">
            {result.rows.map((row) => {
              const eventLabel = formatWhen(row.eventDate ?? row.reviewedAt);
              const decisionLabel =
                row.decision === "APPROVED" ? "อนุมัติ" : "ปฏิเสธ";

              return (
                <li
                  key={`${row.kind}:${row.id}`}
                  className="hr-leave-approval-item"
                >
                  <div className="hr-leave-approval-head">
                    <div className="hr-ot-approval-person">
                      <EmployeeAvatar
                        displayName={row.employeeName}
                        photoUrl={row.photoUrl}
                        size="lg"
                      />
                      <div className="hr-leave-request-main">
                        <EmployeeNameLabel
                          name={row.employeeName}
                          branchName={row.branchName}
                          showBranch={showBranchLabel}
                          className="hr-approval-employee-name"
                        />
                        <div className="hr-leave-request-headline">
                          <span className="hr-leave-request-type">
                            {row.label}
                          </span>
                          <span className="hr-leave-request-dates">
                            {eventLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="hr-leave-approval-side">
                      <span
                        className={`hr-leave-approval-status ${statusClass(row.decision)}`}
                      >
                        {decisionLabel}
                      </span>
                    </div>
                  </div>

                  <div className="hr-leave-approval-body">
                    <span className="hr-leave-request-submitted">
                      {row.decision === "APPROVED" ? "อนุมัติโดย" : "ปฏิเสธโดย"}{" "}
                      {row.reviewedByName}
                    </span>
                    <span className="hr-leave-request-shift">
                      ตัดสินเมื่อ {formatWhen(row.reviewedAt)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
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
