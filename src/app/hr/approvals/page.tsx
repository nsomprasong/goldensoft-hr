import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import AdjustmentApprovalList from "@/components/hr/adjustment-approval-list";
import AdvanceApprovalList from "@/components/hr/advance-approval-list";
import LeaveApprovalCards from "@/components/hr/leave-approval-cards";
import OvertimeApprovalList from "@/components/hr/overtime-approval-list";
import ShiftMismatchApprovalList from "@/components/hr/shift-mismatch-approval-list";
import HrShell from "@/components/hr-shell";
import { getApprovalInbox } from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type ApprovalTab = "leave" | "ot" | "adjust" | "mismatch" | "advance";

type TabCounts = {
  pending: number;
  total: number;
};

function single(params: SearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function countPending(rows: Array<{ statusCode: string }>): number {
  return rows.filter((row) => row.statusCode === "SUBMITTED").length;
}

function summarize(
  rows: Array<{ statusCode: string }>,
): TabCounts {
  return { pending: countPending(rows), total: rows.length };
}

function summarizeAdvances(
  rows: Array<{ status: string }>,
): TabCounts {
  const pending = rows.filter((row) => row.status === "SUBMITTED").length;
  return { pending, total: rows.length };
}

function resolveTab(
  raw: string,
  counts: Record<ApprovalTab, TabCounts>,
): ApprovalTab {
  if (
    raw === "leave" ||
    raw === "ot" ||
    raw === "adjust" ||
    raw === "mismatch" ||
    raw === "advance"
  ) {
    return raw;
  }
  const order: ApprovalTab[] = ["leave", "ot", "advance", "adjust", "mismatch"];
  return (
    order.find((key) => counts[key].pending > 0) ??
    order.find((key) => counts[key].total > 0) ??
    "leave"
  );
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireHrPage({
    permission: [
      HR_PERMISSIONS.approvalRead,
      HR_PERMISSIONS.leaveApprove,
      HR_PERMISSIONS.overtimeApprove,
      HR_PERMISSIONS.advanceApprove,
      HR_PERMISSIONS.attendanceManage,
    ],
  });
  const params = await searchParams;
  const canLeave = canHr(ctx, HR_PERMISSIONS.leaveApprove);
  const canOt = canHr(ctx, HR_PERMISSIONS.overtimeApprove);
  const canAdvance = canHr(ctx, [
    HR_PERMISSIONS.advanceApprove,
    HR_PERMISSIONS.payrollManage,
  ]);
  const canAdjust = canHr(ctx, [
    HR_PERMISSIONS.attendanceManage,
    HR_PERMISSIONS.approvalManage,
  ]);
  const inbox = await getApprovalInbox(ctx);
  const counts: Record<ApprovalTab, TabCounts> = {
    leave: summarize(inbox.data.leave),
    ot: summarize(inbox.data.overtime),
    advance: summarizeAdvances(inbox.data.advances),
    adjust: summarize(inbox.data.attendanceAdjustments),
    mismatch: summarize(inbox.data.shiftMismatches),
  };
  const pendingTotal =
    counts.leave.pending +
    counts.ot.pending +
    counts.advance.pending +
    counts.adjust.pending +
    counts.mismatch.pending;
  const requestTotal =
    counts.leave.total +
    counts.ot.total +
    counts.advance.total +
    counts.adjust.total +
    counts.mismatch.total;
  const tab = resolveTab(single(params, "tab"), counts);

  const tabs: Array<{
    id: ApprovalTab;
    label: string;
    pending: number;
    total: number;
  }> = [
    {
      id: "leave",
      label: "ลา",
      pending: counts.leave.pending,
      total: counts.leave.total,
    },
    {
      id: "ot",
      label: "OT",
      pending: counts.ot.pending,
      total: counts.ot.total,
    },
    {
      id: "advance",
      label: "เบิก",
      pending: counts.advance.pending,
      total: counts.advance.total,
    },
    {
      id: "adjust",
      label: "ปรับเวลา",
      pending: counts.adjust.pending,
      total: counts.adjust.total,
    },
    {
      id: "mismatch",
      label: "ย้ายกะ",
      pending: counts.mismatch.pending,
      total: counts.mismatch.total,
    },
  ];

  return (
    <HrShell ctx={ctx}>
      <DatabaseUnavailableNotice message={inbox.message} />

      <header className="hr-schedule-hero hr-leave-hero">
        <h1 className="hr-schedule-hero-title">รายการอนุมัติ</h1>
        <p className="hr-leave-hero-lead">
          ยังไม่อนุมัติ {pendingTotal} / คำขอทั้งหมด {requestTotal}
        </p>
        <p>
          <Link className="btn btn-sm" href="/hr/approvals/history">
            ดูประวัติย้อนหลัง
          </Link>
        </p>
      </header>

      <nav className="tabs hr-approvals-tabs" aria-label="ประเภทคำขออนุมัติ">
        {tabs.map((item) => {
          const href =
            item.id === "leave"
              ? "/hr/approvals"
              : `/hr/approvals?tab=${item.id}`;
          const current = tab === item.id;
          return (
            <Link
              key={item.id}
              href={href}
              aria-current={current ? "page" : undefined}
              title={`${item.label}: ยังไม่อนุมัติ ${item.pending} จากทั้งหมด ${item.total}`}
            >
              <span className="hr-approvals-tab-label">{item.label}</span>
              <span
                className={`hr-approvals-tab-count${
                  item.pending > 0 ? " hr-approvals-tab-count--pending" : ""
                }`}
              >
                {item.pending}/{item.total}
              </span>
            </Link>
          );
        })}
      </nav>
      <p className="hr-approvals-tab-legend muted">
        ตัวเลขแท็บ = ยังไม่อนุมัติ / คำขอทั้งหมด
      </p>

      {tab === "leave" ? (
        <section className="hr-ot-requests" aria-label="คำขอลา">
          <LeaveApprovalCards
            rows={inbox.data.leave}
            canApprove={canLeave}
            emptyMessage="ไม่มีคำขอลารออนุมัติ หรือผลที่วันลายังไม่ผ่าน"
          />
        </section>
      ) : null}

      {tab === "ot" ? (
        <OvertimeApprovalList
          rows={inbox.data.overtime}
          canApprove={canOt}
          showHero={false}
          sectionTitle="คำขอ OT"
          emptyMessage="ไม่มีคำขอ OT รออนุมัติ หรือผลที่วัน OT ยังไม่ผ่าน"
        />
      ) : null}

      {tab === "advance" ? (
        <section aria-label="คำขอเบิกล่วงหน้า">
          <AdvanceApprovalList
            rows={inbox.data.advances}
            canApprove={canAdvance}
          />
        </section>
      ) : null}

      {tab === "adjust" ? (
        <AdjustmentApprovalList
          rows={inbox.data.attendanceAdjustments}
          canApprove={canAdjust}
          showHero={false}
          sectionTitle="ปรับปรุงเวลา"
          emptyMessage="ไม่มีคำขอปรับปรุงเวลารออนุมัติ หรือผลที่วันทำงานยังไม่ผ่าน"
        />
      ) : null}

      {tab === "mismatch" ? (
        <ShiftMismatchApprovalList
          rows={inbox.data.shiftMismatches}
          canApprove={canAdjust}
          sectionTitle="ย้ายกะ (ผิดกะ)"
          emptyMessage="ไม่มีคำขอย้ายกะ หรือผลที่วันทำงานยังไม่ผ่าน"
        />
      ) : null}
    </HrShell>
  );
}
