"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import EmployeeAvatar from "@/components/hr/employee-avatar";
import EmployeeNameLabel from "@/components/hr/employee-name-label";
import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import type { AttendanceAdjustmentRow } from "@/lib/hr/data";
import { formatThaiDateReadable } from "@/lib/hr/thai-date";

function statusClass(code: string): string {
  if (code === "APPROVED") return "badge badge-active";
  if (code === "REJECTED" || code === "CANCELLED") return "badge badge-inactive";
  return "badge";
}

function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export default function AdjustmentApprovalList({
  rows,
  canApprove,
  emptyMessage = "ยังไม่มีคำขอปรับปรุงเวลา",
  showHero = true,
  showSectionHead = true,
  sectionTitle = "ปรับปรุงเวลา",
  showBranchLabel = false,
  onChanged,
}: {
  rows: AttendanceAdjustmentRow[];
  canApprove: boolean;
  emptyMessage?: string;
  showHero?: boolean;
  showSectionHead?: boolean;
  sectionTitle?: string;
  showBranchLabel?: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function review(
    row: AttendanceAdjustmentRow,
    action: "approve" | "reject",
  ) {
    setBusyId(row.id);
    setFeedback({
      kind: "info",
      message: action === "approve" ? "กำลังอนุมัติ…" : "กำลังไม่อนุมัติ…",
    });
    try {
      const response = await fetch("/api/hr/attendance/adjustments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ action, id: row.id }),
      });
      if (!response.ok) {
        let detail = "ทำรายการไม่สำเร็จ";
        try {
          const payload = (await response.json()) as {
            error?: { message?: string };
          };
          if (payload.error?.message?.trim()) {
            detail = payload.error.message.trim();
          }
        } catch {
          // keep fallback
        }
        throw new Error(detail);
      }
      setFeedback({
        kind: "success",
        message: action === "approve" ? "อนุมัติแล้ว" : "ไม่อนุมัติแล้ว",
      });
      onChanged?.();
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      {showHero ? (
        <header className="hr-schedule-hero hr-leave-hero">
          <h1 className="hr-schedule-hero-title">ปรับปรุงเวลา</h1>
          <p className="hr-leave-hero-lead">
            คำขอแก้ไขเวลาเข้า–ออก และการอนุมัติ
          </p>
        </header>
      ) : null}

      <section className="hr-ot-requests" aria-label={sectionTitle}>
        {showSectionHead ? (
          <div className="hr-shift-board-head">
            <h2>
              <span aria-hidden="true">🕒</span> {sectionTitle}
            </h2>
            <span className="hr-shift-board-count">{rows.length}</span>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="hr-shift-empty">
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <ul className="hr-leave-request-list">
            {rows.map((row) => {
              const pending = row.statusCode === "SUBMITTED";
              const busy = busyId === row.id;
              return (
                <li key={row.id} className="hr-leave-approval-item">
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
                          <span className="hr-leave-request-dates">
                            {formatThaiDateReadable(row.workDate)}
                          </span>
                          <span className="hr-leave-request-type">
                            เข้า {formatClock(row.requestedClockInAt)} · ออก{" "}
                            {formatClock(row.requestedClockOutAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="hr-leave-approval-side">
                      <span
                        className={`hr-leave-approval-status ${statusClass(row.statusCode)}`}
                      >
                        {row.statusName}
                      </span>
                      {canApprove && pending ? (
                        <div className="hr-leave-approval-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={busy}
                            onClick={() => void review(row, "approve")}
                          >
                            {busy ? "…" : "อนุมัติ"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            disabled={busy}
                            onClick={() => void review(row, "reject")}
                          >
                            ไม่อนุมัติ
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {row.reason.trim() ? (
                    <div className="hr-leave-approval-body">
                      <span className="hr-leave-request-reason">
                        {row.reason.trim()}
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
