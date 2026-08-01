"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

import DeleteCalendarButton from "@/components/hr/delete-calendar-button";
import DeleteHolidayButton from "@/components/hr/delete-holiday-button";
import HolidayForm from "@/components/hr/holiday-form";
import SeedThaiHolidaysButton from "@/components/hr/seed-thai-holidays-button";
import WorkCalendarForm from "@/components/hr/work-calendar-form";
import type { HolidayTypeOption, WorkCalendarRow } from "@/lib/hr/data";
import { formatThaiDate } from "@/lib/hr/thai-date";
import { formatWorkDaysCompact } from "@/lib/hr/work-days";

type OverlayMode = "create-calendar" | "edit-calendar" | "add-holiday" | null;

export default function CalendarsWorkspace({
  calendars,
  holidayTypes,
  selected,
  available,
}: {
  calendars: WorkCalendarRow[];
  holidayTypes: HolidayTypeOption[];
  selected: WorkCalendarRow | null;
  available: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const [overlay, setOverlay] = useState<OverlayMode>(null);

  const holidays = useMemo(() => {
    if (!selected) return [];
    return [...selected.holidays].sort((a, b) =>
      a.holidayDate.localeCompare(b.holidayDate),
    );
  }, [selected]);

  useEffect(() => {
    if (!overlay) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlay]);

  useEffect(() => {
    if (!overlay) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOverlay(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay]);

  function closeOverlay() {
    setOverlay(null);
  }

  function handleCalendarDone(calendarId?: string) {
    setOverlay(null);
    if (calendarId) {
      router.push(`/hr/calendars?id=${encodeURIComponent(calendarId)}`);
    }
    router.refresh();
  }

  function handleHolidayDone() {
    setOverlay(null);
    router.refresh();
  }

  const overlayTitle =
    overlay === "create-calendar"
      ? "สร้างปฏิทิน"
      : overlay === "edit-calendar"
        ? "แก้ไขปฏิทิน"
        : overlay === "add-holiday"
          ? "เพิ่มวันหยุด"
          : "";

  return (
    <>
      {!selected ? (
        <>
          {calendars.length === 0 ? (
            <p className="empty">ยังไม่มีปฏิทิน — กด + เพื่อสร้าง</p>
          ) : (
            <div className="hr-card-grid">
              {calendars.map((row) => (
                <article key={row.id} className="card hr-entity-card">
                  <div className="hr-entity-card-top">
                    <div className="hr-entity-card-title-wrap">
                      <h2 className="hr-entity-card-title">
                        <Link href={`/hr/calendars?id=${row.id}`}>{row.name}</Link>
                      </h2>
                    </div>
                    <span className="badge">{row.holidays.length} วันหยุด</span>
                  </div>
                  <dl className="hr-entity-card-meta">
                    <div>
                      <dt>วันทำงาน</dt>
                      <dd>{formatWorkDaysCompact(row.workDays)}</dd>
                    </div>
                  </dl>
                  <div className="hr-entity-card-actions">
                    <Link className="btn btn-sm" href={`/hr/calendars?id=${row.id}`}>
                      เปิด
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!overlay ? (
            <button
              type="button"
              className="hr-fab"
              onClick={() => setOverlay("create-calendar")}
              disabled={!available}
              aria-label="สร้างปฏิทิน"
              title="สร้างปฏิทิน"
            >
              <span aria-hidden="true">+</span>
            </button>
          ) : null}
        </>
      ) : (
        <div className="hr-calendar-detail">
          <div className="hr-calendar-detail-head">
            <div>
              <Link className="hr-calendar-back" href="/hr/calendars">
                ← ปฏิทินทั้งหมด
              </Link>
              <h2 className="hr-calendar-detail-title">{selected.name}</h2>
              <p className="hr-calendar-detail-meta">
                ทำงาน {formatWorkDaysCompact(selected.workDays)}
              </p>
            </div>
            <div className="hr-calendar-detail-actions">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setOverlay("edit-calendar")}
                disabled={!available}
              >
                แก้ไข
              </button>
              <DeleteCalendarButton
                calendarId={selected.id}
                name={selected.name}
                disabled={!available}
              />
            </div>
          </div>

          <section className="hr-calendar-holidays" aria-label="วันหยุด">
            <div className="hr-calendar-holidays-head">
              <h3>วันหยุด ({holidays.length})</h3>
            </div>

            <details className="hr-calendar-seed">
              <summary>ใส่วันหยุดราชการทั้งปี</summary>
              <SeedThaiHolidaysButton
                calendarId={selected.id}
                disabled={!available}
              />
            </details>

            {holidays.length === 0 ? (
              <p className="empty">ยังไม่มีวันหยุด — กด + เพื่อเพิ่ม</p>
            ) : (
              <ul className="hr-calendar-holiday-list">
                {holidays.map((h) => (
                  <li key={h.id} className="hr-calendar-holiday-row">
                    <div className="hr-calendar-holiday-main">
                      <strong>{h.name}</strong>
                      <span className="hr-calendar-holiday-date">
                        {formatThaiDate(h.holidayDate)}
                      </span>
                      <span className="hr-calendar-holiday-tags">
                        <span className="badge">{h.holidayTypeName}</span>
                        <span
                          className={
                            h.isPaid ? "badge badge-active" : "badge badge-inactive"
                          }
                        >
                          {h.isPaid ? "มีค่าจ้าง" : "ไม่มีค่าจ้าง"}
                        </span>
                      </span>
                    </div>
                    <DeleteHolidayButton
                      holidayId={h.id}
                      name={h.name}
                      disabled={!available}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!overlay ? (
            <button
              type="button"
              className="hr-fab"
              onClick={() => setOverlay("add-holiday")}
              disabled={!available || holidayTypes.length === 0}
              aria-label="เพิ่มวันหยุด"
              title="เพิ่มวันหยุด"
            >
              <span aria-hidden="true">+</span>
            </button>
          ) : null}
        </div>
      )}

      {overlay ? (
        <div className="hr-overlay" role="presentation">
          <button
            type="button"
            className="hr-overlay-backdrop"
            aria-label="ปิด"
            onClick={closeOverlay}
          />
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="hr-overlay-head">
              <h2 id={titleId}>{overlayTitle}</h2>
              <button
                type="button"
                className="btn btn-sm"
                onClick={closeOverlay}
                aria-label="ปิด"
              >
                ปิด
              </button>
            </div>
            <div className="hr-overlay-body">
              {overlay === "create-calendar" ? (
                <WorkCalendarForm
                  mode="create"
                  disabled={!available}
                  embedded
                  onDone={handleCalendarDone}
                  onCancel={closeOverlay}
                />
              ) : null}
              {overlay === "edit-calendar" && selected ? (
                <WorkCalendarForm
                  key={selected.id}
                  mode="edit"
                  calendarId={selected.id}
                  initialName={selected.name}
                  initialWorkDays={selected.workDays}
                  disabled={!available}
                  embedded
                  onDone={handleCalendarDone}
                  onCancel={closeOverlay}
                />
              ) : null}
              {overlay === "add-holiday" && selected ? (
                <HolidayForm
                  key={selected.id}
                  calendarId={selected.id}
                  holidayTypes={holidayTypes}
                  disabled={!available}
                  embedded
                  onDone={handleHolidayDone}
                  onCancel={closeOverlay}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
