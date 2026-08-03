"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Alert from "@/components/hr/alert";
import EmployeeAvatar from "@/components/hr/employee-avatar";
import EmployeeNameLabel from "@/components/hr/employee-name-label";
import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import ThaiDateInput from "@/components/hr/thai-date-input";
import { IconViewCards, IconViewRows } from "@/components/ui/icons";
import HrButton from "@/components/ui/hr-button";
import { formatThaiDateReadable, toIsoDate } from "@/lib/hr/thai-date";

type EmployeeOption = { id: string; label: string };
type ViewMode = "cards" | "rows";

const VIEW_MODE_STORAGE_KEY = "hr.attendance.viewMode";

type AttendanceRow = {
  id: string | null;
  employeeId: string;
  workDate: string;
  displayName: string;
  photoUrl: string | null;
  branchName?: string | null;
  statusName: string;
  statusCode: string;
  shiftMismatchStatus?: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  lateLabel: string;
  earlyLeaveLabel: string;
  clockInPhotoUrl: string | null;
  clockOutPhotoUrl: string | null;
};

function bangkokTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Add calendar days in Asia/Bangkok; returns YYYY-MM-DD. */
function addIsoDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00+07:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatClockTime(iso: string | null): string {
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

function statusBadgeClass(statusCode: string): string {
  if (statusCode === "PRESENT" || statusCode === "INCOMPLETE") {
    return "badge badge-active";
  }
  if (statusCode === "LATE") return "badge badge-late";
  if (statusCode === "ABSENT") return "badge badge-absent";
  if (statusCode === "REST_DAY" || statusCode === "HOLIDAY") {
    return "badge badge-off-day";
  }
  return "badge";
}

function StatusBadges({ row }: { row: AttendanceRow }) {
  return (
    <div className="hr-me-clock-day-flags">
      <span className={statusBadgeClass(row.statusCode)}>{row.statusName}</span>
      {row.shiftMismatchStatus === "PENDING" ? (
        <span className="badge">รออนุมัติย้ายกะ</span>
      ) : null}
      {row.shiftMismatchStatus === "REJECTED" ||
      row.statusCode === "WRONG_SHIFT" ? (
        <span className="badge badge-inactive">ลงผิดกะ</span>
      ) : null}
    </div>
  );
}

/** Holiday / weekly rest — status cell spans across clock columns. */
function isOffDayStatus(statusCode: string): boolean {
  return statusCode === "REST_DAY" || statusCode === "HOLIDAY";
}

/** Columns from สถานะ through หลักฐาน (inclusive). */
const ATTENDANCE_STATUS_SPAN_COLS = 6;

function EvidenceLinks({
  row,
  compact = false,
}: {
  row: AttendanceRow;
  compact?: boolean;
}) {
  if (!row.clockInPhotoUrl && !row.clockOutPhotoUrl) return null;
  return (
    <div
      className={
        compact
          ? "hr-attendance-evidence hr-attendance-evidence--compact"
          : "hr-attendance-evidence"
      }
    >
      {row.clockInPhotoUrl ? (
        <a
          className="hr-attendance-evidence-link"
          href={row.clockInPhotoUrl}
          target="_blank"
          rel="noreferrer"
          title="รูปเข้า"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.clockInPhotoUrl} alt="เข้า" />
          {compact ? null : <span>เข้า</span>}
        </a>
      ) : null}
      {row.clockOutPhotoUrl ? (
        <a
          className="hr-attendance-evidence-link"
          href={row.clockOutPhotoUrl}
          target="_blank"
          rel="noreferrer"
          title="รูปออก"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.clockOutPhotoUrl} alt="ออก" />
          {compact ? null : <span>ออก</span>}
        </a>
      ) : null}
    </div>
  );
}

export default function AttendanceDayWorkspace({
  showBranchLabel = false,
  branchLabel = null,
  employees = [],
  canManage = false,
}: {
  showBranchLabel?: boolean;
  branchLabel?: string | null;
  employees?: EmployeeOption[];
  canManage?: boolean;
}) {
  const today = bangkokTodayIso();
  const [employeeId, setEmployeeId] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);

  const [editRow, setEditRow] = useState<AttendanceRow | null>(null);
  const [editIn, setEditIn] = useState("08:00");
  const [editOut, setEditOut] = useState("17:00");
  const [editReason, setEditReason] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (saved === "cards" || saved === "rows") setViewMode(saved);
    } catch {
      // ignore
    }
  }, []);

  function changeViewMode(next: ViewMode) {
    setViewMode(next);
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  const selectedEmployeeLabel = useMemo(() => {
    if (!employeeId) return "ทุกคน";
    return employees.find((e) => e.id === employeeId)?.label ?? "พนักงาน";
  }, [employeeId, employees]);

  const rowGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        employeeId: string;
        displayName: string;
        photoUrl: string | null;
        branchName: string | null;
        days: AttendanceRow[];
      }
    >();
    for (const row of rows) {
      const existing = map.get(row.employeeId);
      if (existing) {
        existing.days.push(row);
        continue;
      }
      map.set(row.employeeId, {
        employeeId: row.employeeId,
        displayName: row.displayName,
        photoUrl: row.photoUrl,
        branchName: row.branchName ?? null,
        days: [row],
      });
    }
    return [...map.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "th"),
    );
  }, [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
      });
      if (employeeId) params.set("employeeId", employeeId);
      const response = await fetch(
        `/api/hr/attendance/days?${params.toString()}`,
        {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
          credentials: "same-origin",
        },
      );
      if (!response.ok) {
        let detail = "โหลดข้อมูลไม่ได้";
        try {
          const body = (await response.json()) as {
            error?: { message?: string };
          };
          if (body.error?.message) detail = body.error.message;
        } catch {
          // keep
        }
        setError(detail);
        setRows([]);
        return;
      }
      const body = (await response.json()) as { rows?: AttendanceRow[] };
      setRows(Array.isArray(body.rows) ? body.rows : []);
    } catch {
      setError("เชื่อมต่อบริการไม่ได้");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit(row: AttendanceRow) {
    setEditRow(row);
    setEditIn(
      formatClockTime(row.clockInAt) === "—"
        ? "08:00"
        : formatClockTime(row.clockInAt),
    );
    setEditOut(
      formatClockTime(row.clockOutAt) === "—"
        ? "17:00"
        : formatClockTime(row.clockOutAt),
    );
    setEditReason("");
    setFeedback(null);
  }

  async function submitEdit() {
    if (!editRow || !canManage) return;
    const reason = editReason.trim();
    if (reason.length < 2) {
      setFeedback({
        kind: "warning",
        message: "กรุณาระบุเหตุผลอย่างน้อย 2 ตัวอักษร",
      });
      return;
    }
    setEditSubmitting(true);
    setFeedback({
      kind: "info",
      message: "กำลังบันทึกเวลา…",
    });
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    try {
      const outDate =
        editOut <= editIn
          ? (() => {
              const d = new Date(`${editRow.workDate}T12:00:00+07:00`);
              d.setDate(d.getDate() + 1);
              return d.toISOString().slice(0, 10);
            })()
          : editRow.workDate;
      const response = await fetch("/api/hr/attendance/days", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "updateClocks",
          employeeId: editRow.employeeId,
          attendanceDayId: editRow.id,
          workDate: editRow.workDate,
          requestedClockInAt: `${editRow.workDate}T${editIn}:00+07:00`,
          requestedClockOutAt: `${outDate}T${editOut}:00+07:00`,
          reason,
        }),
      });
      if (!response.ok) {
        let detail = "บันทึกไม่สำเร็จ";
        try {
          const body = (await response.json()) as {
            error?: { message?: string };
          };
          if (body.error?.message) detail = body.error.message;
        } catch {
          // keep
        }
        setFeedback({ kind: "error", message: detail });
        return;
      }
      const body = (await response.json()) as {
        row?: Partial<AttendanceRow> & {
          id: string;
          employeeId: string;
          workDate: string;
        };
      };
      if (body.row) {
        const patch = body.row;
        setRows((prev) =>
          prev.map((row) =>
            row.employeeId === editRow.employeeId &&
            row.workDate === editRow.workDate
              ? {
                  ...row,
                  ...patch,
                  displayName: row.displayName,
                  photoUrl: row.photoUrl,
                  branchName: row.branchName,
                  clockInPhotoUrl: row.clockInPhotoUrl,
                  clockOutPhotoUrl: row.clockOutPhotoUrl,
                }
              : row,
          ),
        );
      }
      setEditRow(null);
      setFeedback({
        kind: "success",
        title: "บันทึกแล้ว",
        message: "อัปเดตเวลาเข้า–ออกเรียบร้อย",
      });
      // Keep viewport where it was — only the edited row changes, no full reload.
      requestAnimationFrame(() => {
        window.scrollTo(scrollX, scrollY);
      });
    } catch {
      setFeedback({ kind: "error", message: "เชื่อมต่อบริการไม่ได้" });
    } finally {
      setEditSubmitting(false);
    }
  }

  const rangeLabel =
    fromDate === toDate
      ? formatThaiDateReadable(fromDate)
      : `${formatThaiDateReadable(fromDate)} – ${formatThaiDateReadable(toDate)}`;

  return (
    <>
      <section className="card">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="attendance-employee">พนักงาน</label>
            <select
              id="attendance-employee"
              value={employeeId}
              onChange={(event) => {
                const next = event.target.value;
                setEmployeeId(next);
                if (next && fromDate === toDate) {
                  const end = new Date(`${toDate}T12:00:00+07:00`);
                  const start = new Date(end);
                  start.setDate(start.getDate() - 13);
                  setFromDate(start.toISOString().slice(0, 10));
                }
                if (!next) {
                  setFromDate(today);
                  setToDate(today);
                }
              }}
            >
              <option value="">ทุกคน</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="attendance-from">จากวันที่</label>
            <ThaiDateInput
              id="attendance-from"
              value={fromDate}
              onChange={(iso) => {
                const next = toIsoDate(iso) || today;
                setFromDate(next);
                setToDate(addIsoDays(next, 10));
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="attendance-to">ถึงวันที่</label>
            <ThaiDateInput
              id="attendance-to"
              value={toDate}
              onChange={(iso) => {
                const next = toIsoDate(iso) || today;
                setToDate(next);
                if (next < fromDate) setFromDate(next);
              }}
            />
          </div>
          <div className="field">
            <span className="field-label">การแสดงผล</span>
            <div
              className="hr-view-toggle"
              role="group"
              aria-label="รูปแบบการแสดงผล"
            >
              <button
                type="button"
                className={
                  viewMode === "cards" ? "btn btn-sm btn-primary" : "btn btn-sm"
                }
                aria-pressed={viewMode === "cards"}
                onClick={() => changeViewMode("cards")}
              >
                <span className="btn-icon" aria-hidden="true">
                  <IconViewCards size={14} />
                </span>
                <span className="btn-label">การ์ด</span>
              </button>
              <button
                type="button"
                className={
                  viewMode === "rows" ? "btn btn-sm btn-primary" : "btn btn-sm"
                }
                aria-pressed={viewMode === "rows"}
                onClick={() => changeViewMode("rows")}
              >
                <span className="btn-icon" aria-hidden="true">
                  <IconViewRows size={14} />
                </span>
                <span className="btn-label">แถว</span>
              </button>
            </div>
          </div>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {branchLabel ? `สาขา: ${branchLabel} · ` : null}
          {selectedEmployeeLabel} · {rangeLabel} · {rows.length} รายการ
          {!employeeId && fromDate !== toDate
            ? " (ดูทุกคนจำกัดไม่เกิน 14 วัน)"
            : null}
        </p>
      </section>

      {error ? <Alert kind="error">{error}</Alert> : null}

      {loading ? (
        <p className="muted" style={{ marginTop: "1rem" }}>
          กำลังโหลด…
        </p>
      ) : rows.length === 0 ? (
        <section className="card" style={{ marginTop: "1rem" }}>
          <p className="empty">ยังไม่มีข้อมูลเวลาทำงานในช่วงที่เลือก</p>
        </section>
      ) : viewMode === "rows" ? (
        <div className="hr-attendance-row-groups">
          {rowGroups.map((group) => (
            <section
              key={group.employeeId}
              className="card hr-attendance-person-group"
            >
              <header className="hr-attendance-person-group-head">
                <EmployeeAvatar
                  displayName={group.displayName}
                  photoUrl={group.photoUrl}
                  size="md"
                />
                <div className="hr-attendance-person-group-title">
                  <strong>{group.displayName}</strong>
                  {group.branchName || showBranchLabel ? (
                    <span className="muted">
                      {group.branchName ?? "—"}
                    </span>
                  ) : null}
                  <span className="muted">
                    {group.days.length} วันในช่วงที่เลือก
                  </span>
                </div>
              </header>
              <div className="table-wrap">
                <table className="data-table hr-attendance-person-table">
                  <thead>
                    <tr>
                      <th className="col-sticky-date">วันที่</th>
                      <th>สถานะ</th>
                      <th>เข้า</th>
                      <th>ออก</th>
                      <th>สาย</th>
                      <th>ออกก่อน</th>
                      <th>หลักฐาน</th>
                      {canManage ? <th></th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {group.days.map((row) => {
                      const offDay = isOffDayStatus(row.statusCode);
                      return (
                        <tr
                          key={`${row.employeeId}:${row.workDate}:${row.id ?? "new"}`}
                        >
                          <td className="col-sticky-date">
                            {formatThaiDateReadable(row.workDate)}
                          </td>
                          {offDay ? (
                            <td
                              className="col-status-span"
                              colSpan={ATTENDANCE_STATUS_SPAN_COLS}
                            >
                              <StatusBadges row={row} />
                            </td>
                          ) : (
                            <>
                              <td className="col-status">
                                <StatusBadges row={row} />
                              </td>
                              <td>{formatClockTime(row.clockInAt)}</td>
                              <td>{formatClockTime(row.clockOutAt)}</td>
                              <td>{row.lateLabel}</td>
                              <td>{row.earlyLeaveLabel}</td>
                              <td>
                                <EvidenceLinks row={row} compact />
                              </td>
                            </>
                          )}
                          {canManage ? (
                            <td className="col-actions">
                              <HrButton
                                className="btn btn-sm"
                                action="edit"
                                onClick={() => openEdit(row)}
                              >
                                แก้ไข
                              </HrButton>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div
          className="hr-card-grid hr-attendance-day-grid"
          style={{ marginTop: "1rem" }}
        >
          {rows.map((row) => (
            <article
              key={`${row.employeeId}:${row.workDate}:${row.id ?? "new"}`}
              className="card hr-entity-card hr-attendance-day-card"
            >
              <div className="hr-entity-card-top">
                <div className="hr-employee-card-head">
                  <EmployeeAvatar
                    displayName={row.displayName}
                    photoUrl={row.photoUrl}
                    size="lg"
                  />
                  <div className="hr-entity-card-title-wrap">
                    <EmployeeNameLabel
                      name={row.displayName}
                      branchName={row.branchName}
                      showBranch={showBranchLabel}
                      as="h2"
                      className="hr-entity-card-title hr-approval-employee-name"
                    />
                    <p className="muted" style={{ margin: 0 }}>
                      {formatThaiDateReadable(row.workDate)}
                    </p>
                  </div>
                </div>
                <StatusBadges row={row} />
              </div>

              <dl className="hr-entity-card-meta hr-attendance-day-meta">
                <div>
                  <dt>เข้า</dt>
                  <dd>{formatClockTime(row.clockInAt)}</dd>
                </div>
                <div>
                  <dt>ออก</dt>
                  <dd>{formatClockTime(row.clockOutAt)}</dd>
                </div>
                <div>
                  <dt>สาย</dt>
                  <dd>{row.lateLabel}</dd>
                </div>
                <div>
                  <dt>ออกก่อน</dt>
                  <dd>{row.earlyLeaveLabel}</dd>
                </div>
              </dl>

              <EvidenceLinks row={row} />

              {canManage ? (
                <div className="form-actions" style={{ marginTop: "0.75rem" }}>
                  <HrButton
                    className="btn btn-sm"
                    action="edit"
                    onClick={() => openEdit(row)}
                  >
                    แก้ไขเวลา
                  </HrButton>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {editRow ? (
        <div className="hr-overlay" role="presentation">
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-label="แก้ไขเวลาทำงาน"
          >
            <div className="hr-overlay-head">
              <div>
                <strong>แก้ไขเวลาทำงาน</strong>
                <p className="muted" style={{ margin: 0 }}>
                  {editRow.displayName} ·{" "}
                  {formatThaiDateReadable(editRow.workDate)}
                </p>
              </div>
              <HrButton
                className="btn btn-sm"
                action="close"
                onClick={() => setEditRow(null)}
                disabled={editSubmitting}
                aria-label="ปิด"
              >
                ปิด
              </HrButton>
            </div>
            <div className="hr-overlay-body">
              <form
                className="hr-ot-form"
                method="post"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitEdit();
                }}
              >
                <div className="hr-ot-form-times">
                  <label className="hr-shift-field">
                    <span>เวลาเข้า</span>
                    <input
                      type="time"
                      value={editIn}
                      onChange={(event) => setEditIn(event.target.value)}
                      required
                      disabled={editSubmitting}
                    />
                  </label>
                  <div className="hr-ot-form-times-sep" aria-hidden="true">
                    →
                  </div>
                  <label className="hr-shift-field">
                    <span>เวลาออก</span>
                    <input
                      type="time"
                      value={editOut}
                      onChange={(event) => setEditOut(event.target.value)}
                      required
                      disabled={editSubmitting}
                    />
                  </label>
                </div>
                <label className="hr-shift-field">
                  <span>เหตุผล</span>
                  <textarea
                    value={editReason}
                    onChange={(event) => setEditReason(event.target.value)}
                    rows={2}
                    required
                    disabled={editSubmitting}
                    placeholder="เช่น ลืมลงออก / ลงผิดเวลา"
                  />
                </label>
                <div className="form-actions hr-ot-form-actions">
                  <HrButton
                    type="submit"
                    className="btn btn-primary"
                    action="save"
                    disabled={editSubmitting}
                  >
                    {editSubmitting ? "กำลังบันทึก…" : "บันทึกเวลา"}
                  </HrButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <FeedbackPopup
        feedback={feedback}
        onClose={() => setFeedback(null)}
      />
    </>
  );
}
