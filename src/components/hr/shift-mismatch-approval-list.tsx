"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import EmployeeAvatar from "@/components/hr/employee-avatar";
import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import type { ShiftMismatchRow } from "@/lib/hr/data";
import { formatThaiDate } from "@/lib/hr/thai-date";

function statusClass(code: string): string {
  if (code === "APPROVED") return "badge badge-active";
  if (code === "REJECTED" || code === "CANCELLED") return "badge badge-inactive";
  return "badge";
}

export default function ShiftMismatchApprovalList({
  rows,
  canApprove,
  emptyMessage = "ยังไม่มีคำขอย้ายกะจากลงผิดกะ",
  sectionTitle = "ย้ายกะ (ผิดกะ)",
}: {
  rows: ShiftMismatchRow[];
  canApprove: boolean;
  emptyMessage?: string;
  sectionTitle?: string;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function review(
    row: ShiftMismatchRow,
    action: "approve" | "reject",
  ) {
    setBusyId(row.id);
    setFeedback({
      kind: "info",
      message: action === "approve" ? "กำลังอนุมัติ…" : "กำลังปฏิเสธ…",
    });
    try {
      const response = await fetch("/api/hr/attendance/shift-mismatches", {
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
            ? "อนุมัติย้ายกะวันนี้แล้ว"
            : "ปฏิเสธแล้ว — ติดป้ายลงผิดกะ",
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

      <section className="hr-ot-requests" aria-label={sectionTitle}>
        <div className="hr-shift-board-head">
          <h2>
            <span aria-hidden="true">⇄</span> {sectionTitle}
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
                <li key={row.id} className="hr-ot-approval-row">
                  <div className="hr-ot-approval-main">
                    <div className="hr-ot-approval-person">
                      <EmployeeAvatar
                        displayName={row.employeeName}
                        photoUrl={row.photoUrl}
                        size="sm"
                      />
                      <div className="hr-leave-request-main">
                        <strong>{row.employeeName}</strong>
                      </div>
                    </div>
                    <div className="hr-leave-request-main">
                      <strong>{formatThaiDate(row.workDate)}</strong>
                      <span>
                        {row.fromShiftName} ({row.fromTimeLabel}) →{" "}
                        {row.toShiftName} ({row.toTimeLabel})
                      </span>
                      {row.reason.trim() ? (
                        <span className="hr-leave-request-reason">
                          {row.reason.trim()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="hr-ot-approval-side">
                    <span className={statusClass(row.statusCode)}>
                      {row.statusName}
                    </span>
                    {canApprove && pending ? (
                      <div className="hr-ot-approval-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={busy}
                          onClick={() => void review(row, "approve")}
                        >
                          {busy ? "…" : "อนุมัติย้ายกะ"}
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
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
