"use client";

import { useCallback, useState } from "react";
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
  focusId = null,
  emptyMessage = "ยังไม่มีคำขอลา",
}: {
  rows: LeaveRequestRow[];
  canApprove: boolean;
  focusId?: string | null;
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
  const [coverOpenById, setCoverOpenById] = useState<Record<string, boolean>>(
    {},
  );
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

  function toggleCover(row: LeaveRequestRow) {
    const nextOpen = !coverOpenById[row.id];
    setCoverOpenById((prev) => ({ ...prev, [row.id]: nextOpen }));
    if (nextOpen && candidatesByLeave[row.id] === undefined) {
      void loadCandidates(row.id);
    }
  }

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
    let payload: {
      error?: { message?: string };
      reviewedByName?: string | null;
    } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      // empty body
    }
    if (!response.ok) {
      throw new Error(payload.error?.message?.trim() || "ดำเนินการไม่สำเร็จ");
    }
    const by = payload.reviewedByName?.trim();
    setFeedback({
      kind: "success",
      message: by ? `${successMessage} โดย ${by}` : successMessage,
    });
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
          const showCoverToggle =
            canApprove && (pending || row.statusCode === "APPROVED");
          const coverOpen = Boolean(coverOpenById[row.id]);
          const coverSummary = row.coverEmployeeName
            ? `คนแทน: ${row.coverEmployeeName}`
            : "ยังไม่ระบุคนแทน";

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
                      {row.leaveTypeName} ·{" "}
                      {formatThaiDateRange(row.startDate, row.endDate)} ·{" "}
                      {row.requestedAmount} วัน
                    </span>
                    <span className="hr-leave-request-submitted">
                      ยื่นเมื่อ {formatSubmittedAt(row.submittedAt)}
                    </span>
                    {row.reason?.trim() ? (
                      <span className="hr-leave-request-reason">
                        {row.reason.trim()}
                      </span>
                    ) : null}
                    <span className="hr-leave-request-shift">
                      {shiftSummary(row)}
                    </span>
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

              {showCoverToggle ? (
                <div className="hr-leave-cover-panel">
                  <button
                    type="button"
                    className="hr-leave-cover-toggle"
                    aria-expanded={coverOpen}
                    onClick={() => toggleCover(row)}
                  >
                    <span>
                      คนทำงานแทน
                      <span className="hr-leave-cover-toggle-hint">
                        {coverSummary}
                      </span>
                    </span>
                    <span aria-hidden="true">{coverOpen ? "▾" : "▸"}</span>
                  </button>

                  {coverOpen ? (
                    <div className="hr-leave-cover-block">
                      <label className="field">
                        <select
                          aria-label="เลือกคนทำงานแทนจากกะอื่น"
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
                          ไม่มีพนักงานกะอื่นในสาขาเดียวกับผู้ลา ในวันที่ลา
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
                </div>
              ) : row.coverEmployeeName ? (
                <p className="hr-leave-cover-readonly muted">{coverSummary}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
