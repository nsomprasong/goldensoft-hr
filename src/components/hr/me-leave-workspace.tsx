"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";

import Alert from "@/components/hr/alert";
import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import ThaiDateInput from "@/components/hr/thai-date-input";
import { createClientId } from "@/lib/hr/client-id";
import { formatThaiDateRangeReadable } from "@/lib/hr/thai-date";

type LeaveTypeOption = {
  id: string;
  code: string;
  name: string;
  unitId: string;
};

type LeaveRequestRow = {
  id: string;
  startDate: string;
  endDate: string;
  requestedAmount: number | string;
  reason: string | null;
  leaveType?: { id: string; code: string; name: string } | null;
  status?: { id: string; code: string; name: string } | null;
};

type LeaveBalanceRow = {
  leaveTypeId: string;
  leaveTypeName: string;
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
};

function todayIsoBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function leaveDayCount(startIso: string, endIso: string): number | null {
  if (!startIso || !endIso || endIso < startIso) return null;
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
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

export default function MeLeaveWorkspace() {
  const titleId = useId();
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LeaveRequestRow[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceRow[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState(todayIsoBangkok);
  const [endDate, setEndDate] = useState(todayIsoBangkok);
  const [reason, setReason] = useState("");

  const days = useMemo(
    () => leaveDayCount(startDate, endDate),
    [startDate, endDate],
  );

  const selectedBalance = useMemo(
    () => balances.find((row) => row.leaveTypeId === leaveTypeId) ?? null,
    [balances, leaveTypeId],
  );

  function openForm() {
    const today = todayIsoBangkok();
    setStartDate(today);
    setEndDate(today);
    setReason("");
    setOpen(true);
  }

  function onStartDateChange(iso: string) {
    setStartDate(iso);
    setEndDate((prev) => (!prev || prev < iso ? iso : prev));
  }

  function onEndDateChange(iso: string) {
    setEndDate(!startDate || iso < startDate ? startDate : iso);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [requestsRes, typesRes, balancesRes] = await Promise.all([
        fetch("/api/hr/leave/requests?scope=self", {
          headers: { accept: "application/json" },
          cache: "no-store",
        }),
        fetch("/api/hr/leave/types", {
          headers: { accept: "application/json" },
          cache: "no-store",
        }),
        fetch("/api/hr/leave/balances/self", {
          headers: { accept: "application/json" },
          cache: "no-store",
        }),
      ]);
      if (requestsRes.ok) {
        const body = (await requestsRes.json()) as unknown;
        setRows(Array.isArray(body) ? (body as LeaveRequestRow[]) : []);
      }
      if (typesRes.ok) {
        const body = (await typesRes.json()) as unknown;
        const types = Array.isArray(body) ? (body as LeaveTypeOption[]) : [];
        setLeaveTypes(types);
        setLeaveTypeId((current) => current || types[0]?.id || "");
      }
      if (balancesRes.ok) {
        const body = (await balancesRes.json()) as {
          rows?: LeaveBalanceRow[];
        };
        setBalances(Array.isArray(body.rows) ? body.rows : []);
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
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function submitLeave() {
    if (!isOnline) {
      setFeedback({
        kind: "warning",
        message: "คุณกำลังออฟไลน์ — ไม่สามารถยื่นคำขอลาได้",
      });
      return;
    }
    if (!leaveTypeId) {
      setFeedback({ kind: "error", message: "กรุณาเลือกประเภทการลา" });
      return;
    }
    if (!startDate || !endDate) {
      setFeedback({ kind: "error", message: "กรุณาระบุวันเริ่มและวันสิ้นสุดลา" });
      return;
    }
    if (endDate < startDate) {
      setFeedback({
        kind: "error",
        message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มลา",
      });
      return;
    }

    setSubmitting(true);
    setFeedback({ kind: "info", message: "กำลังยื่นคำขอลา…" });
    try {
      const selected = leaveTypes.find((row) => row.id === leaveTypeId);
      const response = await fetch("/api/hr/leave/requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          leaveTypeId,
          startDate,
          endDate,
          startUnitId: selected?.unitId,
          endUnitId: selected?.unitId,
          reason: reason.trim() || undefined,
          idempotencyKey: createClientId(),
        }),
      });
      if (!response.ok) {
        let detail = "ไม่สามารถยื่นคำขอลาได้";
        try {
          detail = messageFromErrorBody(await response.json(), detail);
        } catch {
          // keep fallback
        }
        setFeedback({ kind: "error", message: detail });
        return;
      }
      setFeedback({ kind: "success", message: "ยื่นคำขอลาเรียบร้อยแล้ว" });
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
          คุณกำลังออฟไลน์ — ไม่สามารถยื่นคำขอลาได้ในขณะนี้
        </Alert>
      ) : null}
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      <header className="hr-schedule-hero hr-leave-hero">
        <h1 className="hr-schedule-hero-title">การลาของฉัน</h1>
        <p className="hr-leave-hero-lead">ยอดคงเหลือและคำขอลา</p>
      </header>

      {loading ? (
        <p className="muted">กำลังโหลด…</p>
      ) : (
        <>
          <section className="hr-leave-balance-grid" aria-label="ยอดวันลา">
            {balances.length === 0 ? (
              <div className="card">
                <p className="empty">ยังไม่มีข้อมูลสิทธิ์วันลา</p>
              </div>
            ) : (
              balances.map((balance) => (
                <article
                  key={balance.leaveTypeId}
                  className="card hr-leave-balance-card"
                >
                  <h2>{balance.leaveTypeName}</h2>
                  <dl>
                    <div>
                      <dt>สิทธิ์</dt>
                      <dd>{balance.entitled} วัน</dd>
                    </div>
                    <div>
                      <dt>ใช้ไป</dt>
                      <dd>{balance.used} วัน</dd>
                    </div>
                    <div>
                      <dt>รออนุมัติ</dt>
                      <dd>{balance.pending} วัน</dd>
                    </div>
                    <div>
                      <dt>คงเหลือ</dt>
                      <dd className="hr-leave-balance-remaining">
                        {balance.remaining} วัน
                      </dd>
                    </div>
                  </dl>
                </article>
              ))
            )}
          </section>

          <section className="hr-leave-requests" aria-label="คำขอลา">
            <div className="hr-shift-board-head">
              <h2>
                <span aria-hidden="true">🗓</span> คำขอลา
              </h2>
              <span className="hr-shift-board-count">{rows.length}</span>
            </div>
            {rows.length === 0 ? (
              <div className="hr-shift-empty">
                <p>ยังไม่มีคำขอลา</p>
                <p>กด + เพื่อยื่นคำขอ</p>
              </div>
            ) : (
              <ul className="hr-leave-request-list">
                {rows.map((row) => (
                  <li key={row.id} className="hr-leave-request-row">
                    <div className="hr-leave-request-main">
                      <strong>{row.leaveType?.name ?? "การลา"}</strong>
                      <span className="hr-leave-request-dates">
                        {formatThaiDateRangeReadable(
                          row.startDate,
                          row.endDate,
                        )}
                        <span className="hr-leave-request-days">
                          {" "}
                          · {Number(row.requestedAmount)} วัน
                        </span>
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
        </>
      )}

      {open ? null : (
        <button
          type="button"
          className="hr-fab"
          onClick={openForm}
          disabled={!isOnline || submitting}
          aria-label="ยื่นคำขอลา"
          title="ยื่นคำขอลา"
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
                <p className="hr-period-create-overlay-kicker">การลาของฉัน</p>
                <h2 id={titleId}>ยื่นคำขอลา</h2>
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
                className="hr-leave-form"
                method="post"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitLeave();
                }}
              >
                <label className="hr-shift-field">
                  <span>ประเภทการลา</span>
                  <select
                    value={leaveTypeId}
                    onChange={(event) => setLeaveTypeId(event.target.value)}
                    required
                    disabled={submitting || leaveTypes.length === 0}
                  >
                    {leaveTypes.length === 0 ? (
                      <option value="">ไม่มีประเภทการลา</option>
                    ) : (
                      leaveTypes.map((type) => {
                        const bal = balances.find(
                          (row) => row.leaveTypeId === type.id,
                        );
                        const remain =
                          bal != null ? ` (เหลือ ${bal.remaining} วัน)` : "";
                        return (
                          <option key={type.id} value={type.id}>
                            {type.name}
                            {remain}
                          </option>
                        );
                      })
                    )}
                  </select>
                </label>

                <div className="hr-leave-form-dates">
                  <label className="hr-shift-field">
                    <span>วันเริ่มลา</span>
                    <ThaiDateInput
                      value={startDate}
                      onChange={onStartDateChange}
                      required
                      disabled={submitting}
                    />
                  </label>
                  <div className="hr-leave-form-dates-sep" aria-hidden="true">
                    →
                  </div>
                  <label className="hr-shift-field">
                    <span>วันสิ้นสุดลา</span>
                    <ThaiDateInput
                      value={endDate}
                      onChange={onEndDateChange}
                      required
                      disabled={submitting}
                    />
                  </label>
                </div>

                <div className="hr-leave-form-summary" aria-live="polite">
                  <div>
                    <span className="hr-leave-form-summary-label">ช่วงลา</span>
                    <strong>
                      {startDate && endDate
                        ? formatThaiDateRangeReadable(startDate, endDate)
                        : "ยังไม่ได้เลือก"}
                    </strong>
                  </div>
                  <div className="hr-leave-form-summary-meta">
                    <span className="hr-leave-form-summary-days">
                      {days != null ? `${days} วัน` : "—"}
                    </span>
                    {selectedBalance ? (
                      <span>เหลือ {selectedBalance.remaining} วัน</span>
                    ) : null}
                  </div>
                </div>

                <label className="hr-shift-field">
                  <span>เหตุผล (ถ้ามี)</span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={2}
                    disabled={submitting}
                    placeholder="เช่น นัดพบแพทย์"
                  />
                </label>

                <div className="form-actions hr-leave-form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || leaveTypes.length === 0}
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
