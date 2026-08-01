"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import EmployeeAvatar from "@/components/hr/employee-avatar";
import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import type {
  LeaveCoverCandidate,
  LeaveRequestRow,
} from "@/lib/hr/data";
import { formatThaiDateRange } from "@/lib/hr/thai-date";

function statusClass(code: string): string {
  if (code === "APPROVED") return "badge badge-active";
  if (code === "REJECTED" || code === "CANCELLED") return "badge badge-inactive";
  return "badge";
}

function shiftSummary(row: LeaveRequestRow): string {
  if (row.scheduledShifts.length === 0) return "ไม่มีกะในช่วงลา";
  return row.scheduledShifts
    .map((shift) => {
      const days = shift.workDates.length;
      const time = shift.timeLabel ? ` · ${shift.timeLabel}` : "";
      return `${shift.shiftName}${time} (${days} วัน)`;
    })
    .join(" · ");
}

function candidateLabel(candidate: LeaveCoverCandidate): string {
  const shift = candidate.shiftName?.trim() || "ไม่ระบุกะ";
  const time = candidate.timeLabel ? ` · ${candidate.timeLabel}` : "";
  return `${candidate.displayName} — ${shift}${time}`;
}

export default function LeaveApprovalCards({
  rows,
  canApprove,
  emptyMessage = "ยังไม่มีคำขอลา",
}: {
  rows: LeaveRequestRow[];
  canApprove: boolean;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [coverById, setCoverById] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const row of rows) {
      initial[row.id] = row.coverEmployeeId ?? "";
    }
    return initial;
  });
  const [candidatesByLeave, setCandidatesByLeave] = useState<
    Record<string, LeaveCoverCandidate[]>
  >({});
  const [loadingCandidates, setLoadingCandidates] = useState<
    Record<string, boolean>
  >({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadCandidates = useCallback(async (leaveRequestId: string) => {
    setLoadingCandidates((prev) => ({ ...prev, [leaveRequestId]: true }));
    try {
      const response = await fetch(
        `/api/hr/leave/cover-candidates?leaveRequestId=${encodeURIComponent(leaveRequestId)}`,
        { headers: { accept: "application/json" }, cache: "no-store" },
      );
      if (!response.ok) {
        setCandidatesByLeave((prev) => ({ ...prev, [leaveRequestId]: [] }));
        return;
      }
      const body = (await response.json()) as unknown;
      setCandidatesByLeave((prev) => ({
        ...prev,
        [leaveRequestId]: Array.isArray(body)
          ? (body as LeaveCoverCandidate[])
          : [],
      }));
    } catch {
      setCandidatesByLeave((prev) => ({ ...prev, [leaveRequestId]: [] }));
    } finally {
      setLoadingCandidates((prev) => ({ ...prev, [leaveRequestId]: false }));
    }
  }, []);

  useEffect(() => {
    if (!canApprove) return;
    for (const row of rows) {
      if (row.statusCode === "SUBMITTED" || row.statusCode === "APPROVED") {
        void loadCandidates(row.id);
      }
    }
  }, [canApprove, rows, loadCandidates]);

  async function postAction(
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    const response = await fetch("/api/hr/leave/requests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let detail = "ดำเนินการไม่สำเร็จ";
      try {
        const payload = (await response.json()) as {
          error?: { message?: string };
        };
        if (payload.error?.message?.trim()) detail = payload.error.message.trim();
      } catch {
        // keep fallback
      }
      throw new Error(detail);
    }
    setFeedback({ kind: "success", message: successMessage });
    router.refresh();
  }

  async function saveCover(row: LeaveRequestRow) {
    const coverEmployeeId = coverById[row.id]?.trim() || null;
    setBusyId(row.id);
    setFeedback({ kind: "info", message: "กำลังบันทึกคนทำงานแทน…" });
    try {
      await postAction(
        {
          action: "assignCover",
          id: row.id,
          coverEmployeeId,
        },
        coverEmployeeId
          ? "กำหนดคนทำงานแทนและย้ายกะแล้ว"
          : "ล้างคนทำงานแทนแล้ว",
      );
      await loadCandidates(row.id);
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error ? error.message : "บันทึกคนทำงานแทนไม่สำเร็จ",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function review(row: LeaveRequestRow, action: "approve" | "reject") {
    const coverEmployeeId = coverById[row.id]?.trim() || null;
    setBusyId(row.id);
    setFeedback({
      kind: "info",
      message: action === "approve" ? "กำลังอนุมัติ…" : "กำลังปฏิเสธ…",
    });
    try {
      await postAction(
        {
          action,
          id: row.id,
          coverEmployeeId:
            action === "approve" ? coverEmployeeId : undefined,
        },
        action === "approve" ? "อนุมัติการลาเรียบร้อยแล้ว" : "ปฏิเสธคำขอลาแล้ว",
      );
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

  if (rows.length === 0) {
    return (
      <div className="hr-shift-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />
      <ul className="hr-leave-request-list">
        {rows.map((row) => {
          const busy = busyId === row.id;
          const candidates = candidatesByLeave[row.id] ?? [];
          const loading = loadingCandidates[row.id];
          const pending = row.statusCode === "SUBMITTED";
          const showCover =
            canApprove && (pending || row.statusCode === "APPROVED");
          return (
            <li key={row.id} className="hr-leave-approval-item">
              <div className="hr-ot-approval-row">
                <div className="hr-ot-approval-main">
                  <div className="hr-ot-approval-person">
                    <EmployeeAvatar
                      displayName={row.employeeName}
                      photoUrl={row.photoUrl}
                      size="sm"
                    />
                    <div className="hr-leave-request-main">
                      <strong>{row.employeeName}</strong>
                      <span>
                        {row.leaveTypeName} ·{" "}
                        {formatThaiDateRange(row.startDate, row.endDate)} ·{" "}
                        {row.requestedAmount} วัน
                      </span>
                      {row.reason?.trim() ? (
                        <span className="hr-leave-request-reason">
                          {row.reason.trim()}
                        </span>
                      ) : null}
                      <span>{shiftSummary(row)}</span>
                      {row.coverEmployeeName ? (
                        <span>คนแทน: {row.coverEmployeeName}</span>
                      ) : null}
                    </div>
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
                        อนุมัติ
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

              {showCover ? (
                <div className="hr-leave-cover-block">
                  <label className="field">
                    <span>คนทำงานแทน (จากกะอื่น)</span>
                    <select
                      value={coverById[row.id] ?? ""}
                      disabled={busy || loading}
                      onChange={(event) =>
                        setCoverById((prev) => ({
                          ...prev,
                          [row.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">— ไม่ระบุ —</option>
                      {candidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidateLabel(candidate)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {loading ? (
                    <p className="muted" style={{ margin: 0 }}>
                      กำลังโหลดคนจากกะอื่น…
                    </p>
                  ) : candidates.length === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>
                      ไม่มีพนักงานกะอื่นในวันที่ลา
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy || loading}
                    onClick={() => void saveCover(row)}
                  >
                    {busy ? "กำลังบันทึก…" : "บันทึกคนแทน / ย้ายกะ"}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
