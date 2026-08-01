"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";

import Alert from "@/components/hr/alert";
import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import ThaiDateInput from "@/components/hr/thai-date-input";
import { createClientId } from "@/lib/hr/client-id";
import { formatThaiDate } from "@/lib/hr/thai-date";

type OvertimeRequestRow = {
  id: string;
  workDate: string;
  startAt?: string;
  endAt?: string;
  requestedMinutes: number;
  reason: string | null;
  status?: { id: string; code: string; name: string } | null;
};

function todayIsoBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function bangkokDateTime(isoDate: string, timeHm: string): string | null {
  const t = timeHm.trim();
  if (!/^\d{2}:\d{2}$/.test(t) || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null;
  }
  return `${isoDate}T${t}:00+07:00`;
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

function minutesBetween(startHm: string, endHm: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(startHm) || !/^\d{2}:\d{2}$/.test(endHm)) {
    return null;
  }
  const [sh, sm] = startHm.split(":").map(Number);
  const [eh, em] = endHm.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (end <= start) return null;
  return end - start;
}

function addHoursHm(timeHm: string, hours: number): string {
  if (!/^\d{2}:\d{2}$/.test(timeHm)) return timeHm;
  const [h, m] = timeHm.split(":").map(Number);
  const day = 24 * 60;
  const total = (((h * 60 + m + hours * 60) % day) + day) % day;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function statusClass(code: string | undefined): string {
  if (code === "APPROVED") return "badge badge-active";
  if (code === "REJECTED" || code === "CANCELLED") return "badge badge-inactive";
  return "badge";
}

function messageFromErrorBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const raw = body as { message?: string; error?: { message?: string } };
  const detail = raw.error?.message?.trim() || raw.message?.trim();
  return detail || fallback;
}

export default function MeOvertimeWorkspace() {
  const titleId = useId();
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<OvertimeRequestRow[]>([]);
  const [workDate, setWorkDate] = useState(todayIsoBangkok);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [reason, setReason] = useState("");

  const durationMinutes = useMemo(
    () => minutesBetween(startTime, endTime),
    [startTime, endTime],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/hr/overtime/requests?scope=self", {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (response.ok) {
        const body = (await response.json()) as unknown;
        setRows(Array.isArray(body) ? (body as OvertimeRequestRow[]) : []);
      }
    } catch {
      // Keep prior list; submit path surfaces errors.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting]);

  function openForm() {
    setWorkDate(todayIsoBangkok());
    setStartTime("18:00");
    setEndTime("20:00");
    setReason("");
    setOpen(true);
  }

  function onStartTimeChange(next: string) {
    setStartTime(next);
    setEndTime((prev) => {
      if (!/^\d{2}:\d{2}$/.test(next)) return prev;
      if (!prev || prev <= next) return addHoursHm(next, 2);
      return prev;
    });
  }

  async function submitOvertime() {
    if (!isOnline) {
      setFeedback({
        kind: "warning",
        message: "คุณกำลังออฟไลน์ — ไม่สามารถยื่นคำขอ OT ได้",
      });
      return;
    }
    if (!workDate) {
      setFeedback({ kind: "error", message: "กรุณาระบุวันที่ทำ OT" });
      return;
    }
    const startAt = bangkokDateTime(workDate, startTime);
    const endAt = bangkokDateTime(workDate, endTime);
    if (!startAt || !endAt) {
      setFeedback({ kind: "error", message: "กรุณาระบุเวลาเริ่มและสิ้นสุด OT" });
      return;
    }
    if (endAt <= startAt) {
      setFeedback({
        kind: "error",
        message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม",
      });
      return;
    }

    setSubmitting(true);
    setFeedback({ kind: "info", message: "กำลังยื่นคำขอ OT…" });
    try {
      const response = await fetch("/api/hr/overtime/requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          workDate,
          startAt,
          endAt,
          reason: reason.trim() || undefined,
          idempotencyKey: createClientId(),
        }),
      });
      if (!response.ok) {
        let detail = "ไม่สามารถยื่นคำขอ OT ได้";
        try {
          detail = messageFromErrorBody(await response.json(), detail);
        } catch {
          // keep fallback
        }
        setFeedback({ kind: "error", message: detail });
        return;
      }
      setFeedback({ kind: "success", message: "ยื่นคำขอ OT เรียบร้อยแล้ว" });
      setOpen(false);
      setReason("");
      await load();
    } catch (error) {
      const detail =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "เชื่อมต่อบริการไม่ได้ ยังไม่มีการบันทึกข้อมูล";
      setFeedback({
        kind: "error",
        message:
          detail.startsWith("Failed to fetch") || detail.includes("NetworkError")
            ? "เชื่อมต่อบริการไม่ได้ ยังไม่มีการบันทึกข้อมูล"
            : detail,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {!isOnline ? (
        <Alert kind="warning">
          คุณกำลังออฟไลน์ — ไม่สามารถยื่นคำขอ OT ได้ในขณะนี้
        </Alert>
      ) : null}
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      <header className="hr-schedule-hero hr-leave-hero">
        <h1 className="hr-schedule-hero-title">OT ของฉัน</h1>
        <p className="hr-leave-hero-lead">ยื่นคำขอและติดตามการอนุมัติ</p>
      </header>

      {loading ? (
        <p className="muted">กำลังโหลด…</p>
      ) : (
        <section className="hr-ot-requests" aria-label="คำขอ OT">
          <div className="hr-shift-board-head">
            <h2>
              <span aria-hidden="true">⏱</span> คำขอ OT
            </h2>
            <span className="hr-shift-board-count">{rows.length}</span>
          </div>

          {rows.length === 0 ? (
            <div className="hr-shift-empty">
              <p>ยังไม่มีคำขอ OT</p>
              <p>กด + เพื่อยื่นคำขอ</p>
            </div>
          ) : (
            <ul className="hr-leave-request-list">
              {rows.map((row) => (
                <li key={row.id} className="hr-leave-request-row">
                  <div className="hr-leave-request-main">
                    <strong>{formatThaiDate(row.workDate)}</strong>
                    <span>
                      {formatClock(row.startAt)}–{formatClock(row.endAt)} ·{" "}
                      {formatMinutes(row.requestedMinutes)}
                    </span>
                    {row.reason?.trim() ? (
                      <span className="hr-leave-request-reason">
                        {row.reason.trim()}
                      </span>
                    ) : null}
                  </div>
                  <span className={statusClass(row.status?.code)}>
                    {row.status?.name ?? row.status?.code ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {open ? null : (
        <button
          type="button"
          className="hr-fab"
          onClick={openForm}
          disabled={!isOnline || submitting}
          aria-label="ยื่นคำขอ OT"
          title="ยื่นคำขอ OT"
        >
          <span aria-hidden="true">+</span>
        </button>
      )}

      {open ? (
        <div className="hr-overlay" role="presentation">
          <button
            type="button"
            className="hr-overlay-backdrop"
            aria-label="ปิด"
            onClick={() => !submitting && setOpen(false)}
          />
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="hr-overlay-head hr-period-create-overlay-head">
              <div>
                <p className="hr-period-create-overlay-kicker">OT ของฉัน</p>
                <h2 id={titleId}>ยื่นคำขอ OT</h2>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setOpen(false)}
                disabled={submitting}
                aria-label="ปิด"
              >
                ปิด
              </button>
            </div>
            <div className="hr-overlay-body">
              <form
                className="hr-ot-form"
                method="post"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitOvertime();
                }}
              >
                <label className="hr-shift-field">
                  <span>วันที่ทำ OT</span>
                  <ThaiDateInput
                    value={workDate}
                    onChange={setWorkDate}
                    required
                    disabled={submitting}
                  />
                </label>

                <div className="hr-ot-form-times">
                  <label className="hr-shift-field">
                    <span>เวลาเริ่ม</span>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(event) =>
                        onStartTimeChange(event.target.value)
                      }
                      required
                      disabled={submitting}
                    />
                  </label>
                  <div className="hr-ot-form-times-sep" aria-hidden="true">
                    →
                  </div>
                  <label className="hr-shift-field">
                    <span>เวลาสิ้นสุด</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      required
                      disabled={submitting}
                    />
                  </label>
                </div>

                <div className="hr-ot-form-summary" aria-live="polite">
                  <div>
                    <span className="hr-ot-form-summary-label">สรุปคำขอ</span>
                    <strong>
                      {workDate ? formatThaiDate(workDate) : "—"} · {startTime}–
                      {endTime}
                    </strong>
                  </div>
                  <span className="hr-ot-form-summary-duration">
                    {durationMinutes != null
                      ? formatMinutes(durationMinutes)
                      : "ตรวจเวลาอีกครั้ง"}
                  </span>
                </div>

                <label className="hr-shift-field">
                  <span>เหตุผล (ถ้ามี)</span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={2}
                    disabled={submitting}
                    placeholder="เช่น งานเร่งด่วน / ปิดยอด"
                  />
                </label>

                <div className="form-actions hr-ot-form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || durationMinutes == null}
                  >
                    {submitting ? "กำลังยื่น…" : "ยื่นคำขอ"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
