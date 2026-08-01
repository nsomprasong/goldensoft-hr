"use client";

import { useCallback, useEffect, useState } from "react";

import Alert from "@/components/hr/alert";
import EmployeeAvatar from "@/components/hr/employee-avatar";
import ThaiDateInput from "@/components/hr/thai-date-input";
import { formatThaiDate, toIsoDate } from "@/lib/hr/thai-date";

type AttendanceRow = {
  id: string;
  employeeId: string;
  displayName: string;
  photoUrl: string | null;
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

export default function AttendanceDayWorkspace() {
  const [workDate, setWorkDate] = useState(() => bangkokTodayIso());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (iso: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/hr/attendance/days?workDate=${encodeURIComponent(iso)}`,
        {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
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
      const body = (await response.json()) as {
        workDate?: string;
        rows?: AttendanceRow[];
      };
      setRows(Array.isArray(body.rows) ? body.rows : []);
    } catch {
      setError("เชื่อมต่อบริการไม่ได้");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(workDate);
  }, [workDate, load]);

  return (
    <>
      <section className="card">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="attendance-day">วันที่</label>
            <ThaiDateInput
              id="attendance-day"
              value={workDate}
              onChange={(iso) => {
                const next = toIsoDate(iso) || bangkokTodayIso();
                setWorkDate(next);
              }}
            />
          </div>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          สรุปการลงเวลาวันที่ {formatThaiDate(workDate)} · {rows.length} คน
        </p>
      </section>

      {error ? <Alert kind="error">{error}</Alert> : null}

      {loading ? (
        <p className="muted" style={{ marginTop: "1rem" }}>
          กำลังโหลด…
        </p>
      ) : rows.length === 0 ? (
        <section className="card" style={{ marginTop: "1rem" }}>
          <p className="empty">ยังไม่มีข้อมูลเวลาทำงานในวันนี้</p>
        </section>
      ) : (
        <div className="hr-card-grid hr-attendance-day-grid" style={{ marginTop: "1rem" }}>
          {rows.map((row) => (
            <article key={row.id} className="card hr-entity-card hr-attendance-day-card">
              <div className="hr-entity-card-top">
                <div className="hr-employee-card-head">
                  <EmployeeAvatar
                    displayName={row.displayName}
                    photoUrl={row.photoUrl}
                    size="sm"
                  />
                  <div className="hr-entity-card-title-wrap">
                    <h2 className="hr-entity-card-title">{row.displayName}</h2>
                  </div>
                </div>
                <div className="hr-me-clock-day-flags">
                  <span
                    className={
                      row.statusCode === "PRESENT" ||
                      row.statusCode === "INCOMPLETE"
                        ? "badge badge-active"
                        : "badge"
                    }
                  >
                    {row.statusName}
                  </span>
                  {row.shiftMismatchStatus === "PENDING" ? (
                    <span className="badge">รออนุมัติย้ายกะ</span>
                  ) : null}
                  {row.shiftMismatchStatus === "REJECTED" ||
                  row.statusCode === "WRONG_SHIFT" ? (
                    <span className="badge badge-inactive">ลงผิดกะ</span>
                  ) : null}
                </div>
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

              {(row.clockInPhotoUrl || row.clockOutPhotoUrl) && (
                <div className="hr-attendance-evidence">
                  {row.clockInPhotoUrl ? (
                    <a
                      className="hr-attendance-evidence-link"
                      href={row.clockInPhotoUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={row.clockInPhotoUrl} alt="" />
                      <span>เข้า</span>
                    </a>
                  ) : null}
                  {row.clockOutPhotoUrl ? (
                    <a
                      className="hr-attendance-evidence-link"
                      href={row.clockOutPhotoUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={row.clockOutPhotoUrl} alt="" />
                      <span>ออก</span>
                    </a>
                  ) : null}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
