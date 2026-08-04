"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  formatThaiDate,
  formatThaiDateReadable,
  parseDateParts,
  toIsoDate,
} from "@/lib/hr/thai-date";

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] as const;

const THAI_WEEKDAY_FULL = [
  "วันอาทิตย์",
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์",
] as const;

/** Styles ship with the JS bundle so Customer App /__hr_assets CSS HMR gaps cannot break the grid. */
const CALENDAR_CSS = `
.tdp-overlay{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box}
.tdp-backdrop{position:absolute;inset:0;border:0;margin:0;padding:0;background:rgba(15,23,42,.45);cursor:pointer}
.tdp-panel{position:relative;z-index:1;width:min(22.5rem,100%);max-height:min(92vh,100%);overflow:auto;border-radius:1.15rem;background:#fff;box-shadow:0 18px 48px rgba(15,23,42,.28);font-family:inherit;color:#1f2937;-webkit-overflow-scrolling:touch}
.tdp-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;padding:1.1rem 1.1rem 1rem;background:linear-gradient(135deg,#b45309 0%,#c2410c 48%,#9a3412 100%);color:#fff7ed}
.tdp-kicker{margin:0 0 .2rem;font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.78}
.tdp-weekday{margin:0 0 .35rem;font-size:.92rem;font-weight:500;opacity:.92}
.tdp-hero-date{display:flex;align-items:flex-end;gap:.65rem;margin:0}
.tdp-hero-day{font-size:2.75rem;font-weight:700;line-height:.9;letter-spacing:-.03em}
.tdp-hero-meta{display:flex;flex-direction:column;gap:.05rem;padding-bottom:.2rem;font-size:1.05rem;font-weight:600;line-height:1.2}
.tdp-hero-meta small{font-size:.82rem;font-weight:500;opacity:.85}
.tdp-close{display:inline-flex;align-items:center;justify-content:center;width:2.25rem;height:2.25rem;margin:0;padding:0;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(255,255,255,.12);color:#fff7ed;font-size:.95rem;line-height:1;cursor:pointer;flex-shrink:0}
.tdp-body{padding:.9rem 1rem calc(1rem + env(safe-area-inset-bottom,0px))}
.tdp-nav{display:flex;align-items:center;justify-content:space-between;gap:.35rem;margin-bottom:.85rem}
.tdp-title{margin:0;flex:1;text-align:center;font-size:1.05rem;font-weight:700;color:#1f2937}
.tdp-nav-btn{display:inline-flex;align-items:center;justify-content:center;width:2.4rem;height:2.4rem;margin:0;padding:0;border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#64748b;cursor:pointer}
.tdp-table{width:100%;border-collapse:collapse;table-layout:fixed}
.tdp-table th,.tdp-table td{padding:.15rem 0;text-align:center;vertical-align:middle;border:0}
.tdp-table th{font-size:.72rem;font-weight:700;color:#64748b;height:1.6rem}
.tdp-table th.is-sun,.tdp-day.is-sun:not(.is-selected){color:#c2410c}
.tdp-table th.is-sat,.tdp-day.is-sat:not(.is-selected){color:#0369a1}
.tdp-day{display:inline-flex;align-items:center;justify-content:center;width:2.35rem;height:2.35rem;margin:0;padding:0;border:0;border-radius:999px;background:transparent;color:#1f2937;font:inherit;font-size:.95rem;font-weight:600;cursor:pointer}
.tdp-day.is-today:not(.is-selected){box-shadow:inset 0 0 0 1.5px #d97706;color:#92400e}
.tdp-day.is-selected{background:linear-gradient(145deg,#d97706 0%,#b45309 100%);color:#fff;box-shadow:0 4px 12px rgba(180,83,9,.35)}
.tdp-day:disabled{visibility:hidden;pointer-events:none}
.tdp-footer{display:flex;justify-content:center;margin-top:.85rem;padding-top:.75rem;border-top:1px solid #e8e0d6}
.tdp-today{margin:0;padding:.45rem 1rem;border:0;border-radius:999px;background:#fff7ed;color:#92400e;font:inherit;font-size:.9rem;font-weight:700;cursor:pointer}
@media (max-width:719px){
  .tdp-overlay{align-items:flex-end;padding:0}
  .tdp-panel{width:100%;border-radius:1.15rem 1.15rem 0 0;max-height:min(88vh,100%)}
}
`;

function daysInMonth(yearCe: number, month: number): number {
  return new Date(Date.UTC(yearCe, month, 0)).getUTCDate();
}

function bangkokTodayParts(): { year: number; month: number; day: number } {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y!, month: m!, day: d! };
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function usePreferCalendarTap(): boolean {
  const [preferTap, setPreferTap] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const noHover = window.matchMedia("(hover: none)");
    const sync = () => {
      const iOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setPreferTap(coarse.matches || noHover.matches || iOS);
    };
    sync();
    coarse.addEventListener("change", sync);
    noHover.addEventListener("change", sync);
    return () => {
      coarse.removeEventListener("change", sync);
      noHover.removeEventListener("change", sync);
    };
  }, []);

  return preferTap;
}

function CalendarIcon() {
  return (
    <svg
      className="thai-date-picker-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      focusable="false"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm12 8H5v10h14V10ZM6 8h12V6H6v2Z"
      />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" focusable="false" aria-hidden="true">
      <path
        fill="currentColor"
        d={
          direction === "prev"
            ? "M14.7 5.3a1 1 0 0 1 0 1.4L10.4 11l4.3 4.3a1 1 0 1 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z"
            : "M9.3 5.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 1 1-1.4-1.4l4.3-4.3-4.3-4.3a1 1 0 0 1 0-1.4Z"
        }
      />
    </svg>
  );
}

/**
 * Date field that shows/accepts Thai พ.ศ. (`DD/MM/BBBB`) while emitting ISO
 * (`YYYY-MM-DD`) to the parent.
 *
 * Calendar UI uses an HTML table + in-component CSS so iPad / Customer App
 * proxy cannot leave the month grid unstyled.
 */
export default function ThaiDateInput({
  id,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  required = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
}) {
  const autoId = useId();
  const textId = id ?? autoId;
  const preferCalendarTap = usePreferCalendarTap();
  const [text, setText] = useState(() =>
    value ? formatThaiDate(value, "") : "",
  );
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const selected = parseDateParts(value);
  const today = bangkokTodayParts();
  const [viewYear, setViewYear] = useState(selected?.year ?? today.year);
  const [viewMonth, setViewMonth] = useState(selected?.month ?? today.month);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    setText(value ? formatThaiDate(value, "") : "");
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const parts = parseDateParts(value) ?? bangkokTodayParts();
    setViewYear(parts.year);
    setViewMonth(parts.month);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const weeks = useMemo(() => {
    const firstDow = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
    const dim = daysInMonth(viewYear, viewMonth);
    const flat: Array<{
      key: string;
      day: number | null;
      iso: string | null;
      weekday: number;
    }> = [];
    for (let i = 0; i < firstDow; i += 1) {
      flat.push({ key: `pad-${i}`, day: null, iso: null, weekday: i });
    }
    for (let d = 1; d <= dim; d += 1) {
      const weekday = (firstDow + d - 1) % 7;
      flat.push({
        key: `d-${d}`,
        day: d,
        iso: toIso(viewYear, viewMonth, d),
        weekday,
      });
    }
    while (flat.length % 7 !== 0) {
      const weekday = flat.length % 7;
      flat.push({
        key: `tail-${flat.length}`,
        day: null,
        iso: null,
        weekday,
      });
    }
    const rows: (typeof flat)[] = [];
    for (let i = 0; i < flat.length; i += 7) {
      rows.push(flat.slice(i, i + 7));
    }
    return rows;
  }, [viewYear, viewMonth]);

  const todayIso = toIso(today.year, today.month, today.day);
  const selectedIso = value || "";
  const previewParts = selected ?? today;
  const previewWeekday = new Date(
    Date.UTC(previewParts.year, previewParts.month - 1, previewParts.day),
  ).getUTCDay();
  const textReadOnly = readOnly || preferCalendarTap;
  const canOpen = !disabled && !readOnly;

  function commitText(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setText("");
      onChange("");
      return;
    }
    const iso = toIsoDate(trimmed);
    if (!iso) {
      setText(raw);
      return;
    }
    setText(formatThaiDate(iso, ""));
    onChange(iso);
  }

  function applyIso(iso: string) {
    setText(iso ? formatThaiDate(iso, "") : "");
    onChange(iso);
    setOpen(false);
  }

  function openCalendar() {
    if (!canOpen) return;
    setOpen(true);
  }

  return (
    <div className="thai-date-input">
      <input
        id={textId}
        type="text"
        inputMode={preferCalendarTap ? "none" : "numeric"}
        autoComplete="off"
        placeholder="วว/ดด/ปปปป"
        value={text}
        onChange={(e) => {
          if (textReadOnly) return;
          setText(e.target.value);
        }}
        onBlur={() => {
          if (!textReadOnly) commitText(text);
        }}
        onKeyDown={(e) => {
          if (textReadOnly) return;
          if (e.key === "Enter") {
            e.preventDefault();
            commitText(text);
          }
        }}
        onClick={() => {
          if (preferCalendarTap) openCalendar();
        }}
        disabled={disabled}
        readOnly={textReadOnly}
        required={required}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-haspopup={canOpen ? "dialog" : undefined}
        aria-expanded={canOpen ? open : undefined}
      />
      {canOpen ? (
        <button
          type="button"
          className="thai-date-picker-hit"
          aria-label="เปิดปฏิทินเลือกวันที่"
          title="เลือกวันที่จากปฏิทิน"
          disabled={disabled}
          onClick={openCalendar}
        >
          <span className="thai-date-picker-btn" aria-hidden="true">
            <CalendarIcon />
          </span>
        </button>
      ) : null}

      {portalReady && open
        ? createPortal(
            <div className="tdp-overlay" role="presentation">
              <style>{CALENDAR_CSS}</style>
              <button
                type="button"
                className="tdp-backdrop"
                aria-label="ปิด"
                onClick={() => setOpen(false)}
              />
              <div
                className="tdp-panel"
                role="dialog"
                aria-modal="true"
                aria-label="เลือกวันที่"
              >
                <header className="tdp-hero">
                  <div>
                    <p className="tdp-kicker">เลือกวันที่</p>
                    <p className="tdp-weekday">
                      {THAI_WEEKDAY_FULL[previewWeekday]}
                    </p>
                    <p className="tdp-hero-date">
                      <span className="tdp-hero-day">{previewParts.day}</span>
                      <span className="tdp-hero-meta">
                        {THAI_MONTHS[previewParts.month - 1]}
                        <small>พ.ศ. {previewParts.year + 543}</small>
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="tdp-close"
                    aria-label="ปิด"
                    onClick={() => setOpen(false)}
                  >
                    ✕
                  </button>
                </header>

                <div className="tdp-body">
                  <div className="tdp-nav">
                    <button
                      type="button"
                      className="tdp-nav-btn"
                      aria-label="เดือนก่อน"
                      onClick={() => {
                        const next = shiftMonth(viewYear, viewMonth, -1);
                        setViewYear(next.year);
                        setViewMonth(next.month);
                      }}
                    >
                      <ChevronIcon direction="prev" />
                    </button>
                    <strong className="tdp-title">
                      {THAI_MONTHS[viewMonth - 1]} {viewYear + 543}
                    </strong>
                    <button
                      type="button"
                      className="tdp-nav-btn"
                      aria-label="เดือนถัดไป"
                      onClick={() => {
                        const next = shiftMonth(viewYear, viewMonth, 1);
                        setViewYear(next.year);
                        setViewMonth(next.month);
                      }}
                    >
                      <ChevronIcon direction="next" />
                    </button>
                  </div>

                  <table className="tdp-table">
                    <thead>
                      <tr>
                        {WEEKDAYS.map((label, index) => (
                          <th
                            key={label}
                            scope="col"
                            className={
                              index === 0
                                ? "is-sun"
                                : index === 6
                                  ? "is-sat"
                                  : undefined
                            }
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weeks.map((week, weekIndex) => (
                        <tr key={`w-${weekIndex}`}>
                          {week.map((cell) => {
                            if (cell.day == null || !cell.iso) {
                              return (
                                <td key={cell.key}>
                                  <button
                                    type="button"
                                    className="tdp-day"
                                    disabled
                                    tabIndex={-1}
                                    aria-hidden="true"
                                  >
                                    ·
                                  </button>
                                </td>
                              );
                            }
                            const isSelected = cell.iso === selectedIso;
                            const isToday = cell.iso === todayIso;
                            const weekendClass =
                              cell.weekday === 0
                                ? "is-sun"
                                : cell.weekday === 6
                                  ? "is-sat"
                                  : "";
                            return (
                              <td key={cell.key}>
                                <button
                                  type="button"
                                  className={[
                                    "tdp-day",
                                    weekendClass,
                                    isSelected ? "is-selected" : "",
                                    isToday ? "is-today" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  aria-label={formatThaiDateReadable(
                                    cell.iso,
                                    cell.iso,
                                  )}
                                  aria-current={
                                    isSelected ? "date" : undefined
                                  }
                                  onClick={() => applyIso(cell.iso!)}
                                >
                                  {cell.day}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="tdp-footer">
                    <button
                      type="button"
                      className="tdp-today"
                      onClick={() => applyIso(todayIso)}
                    >
                      ไปวันนี้
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
