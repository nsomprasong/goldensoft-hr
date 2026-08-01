"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import EmployeeAvatar from "@/components/hr/employee-avatar";
import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import type { OvertimeRequestRow } from "@/lib/hr/data";
import { formatThaiDate } from "@/lib/hr/thai-date";

function statusClass(code: string): string {
  if (code === "APPROVED") return "badge badge-active";
  if (code === "REJECTED" || code === "CANCELLED") return "badge badge-inactive";
  return "badge";
}

function formatClock(iso: string | undefined): string {
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

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} นาที`;
  if (m <= 0) return `${h} ชม.`;
  return `${h} ชม. ${m} นาที`;
}

function formatSubmittedAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export default function OvertimeApprovalList({
  rows,
  canApprove,
  emptyMessage = "ยังไม่มีคำขอทำงานล่วงเวลา",
  showHero = true,
  sectionTitle = "คำขอ OT",
  heroLead = "คำขอ OT และการอนุมัติขององค์กร",
  heroAction,
  focusId = null,
}: {
  rows: OvertimeRequestRow[];
  canApprove: boolean;
  emptyMessage?: string;
  /** When false, omit page hero (for embedding in unified approvals). */
  showHero?: boolean;
  sectionTitle?: string;
  heroLead?: string;
  heroAction?: ReactNode;
  focusId?: string | null;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function review(row: OvertimeRequestRow, action: "approve" | "reject") {
    setBusyId(row.id);
    setFeedback({
      kind: "info",
      message: action === "approve" ? "กำลังอนุมัติ…" : "กำลังปฏิเสธ…",
    });
    try {
      const response = await fetch("/api/hr/overtime/requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ action, id: row.id }),
      });
      if (!response.ok) {
        let detail = "ดำเนินการไม่สำเร็จ";
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
        message:
          action === "approve"
            ? "อนุมัติ OT เรียบร้อยแล้ว"
            : "ปฏิเสธคำขอ OT แล้ว",
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ",
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
          <h1 className="hr-schedule-hero-title">ทำงานล่วงเวลา</h1>
          <p className="hr-leave-hero-lead">{heroLead}</p>
          {heroAction ? <p>{heroAction}</p> : null}
        </header>
      ) : null}

      <section className="hr-ot-requests" aria-label={sectionTitle}>
        <div className="hr-shift-board-head">
          <h2>
            <span aria-hidden="true">⏱</span> {sectionTitle}
          </h2>
          <span className="hr-shift-board-count">{rows.length}</span>
        </div>

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
                <li
                  key={row.id}
                  id={`approval-${row.id}`}
                  className={`hr-leave-approval-item${
                    focusId === row.id ? " hr-approval-focus" : ""
                  }`}
                >
                  <div className="hr-leave-approval-head">
                    <div className="hr-ot-approval-person">
                      <EmployeeAvatar
                        displayName={row.employeeName}
                        photoUrl={row.photoUrl}
                        size="sm"
                      />
                      <div className="hr-leave-request-main">
                        <strong>{row.employeeName}</strong>
                        <span>
                          {formatThaiDate(row.workDate)} ·{" "}
                          {formatClock(row.startAt)}–{formatClock(row.endAt)} ·{" "}
                          {formatMinutes(row.requestedMinutes)}
                        </span>
                        <span className="hr-leave-request-submitted">
                          ยื่นเมื่อ {formatSubmittedAt(row.submittedAt)}
                        </span>
                        {row.reason?.trim() ? (
                          <span className="hr-leave-request-reason">
                            {row.reason.trim()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span
                      className={`hr-leave-approval-status ${statusClass(row.statusCode)}`}
                    >
                      {row.statusName}
                    </span>
                  </div>

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
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
