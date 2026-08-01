"use client";

import Link from "next/link";

import type { ScheduleConflictPeriodSummary } from "@/lib/hr/schedule-period-overlap";
import { formatThaiDateRange } from "@/lib/hr/thai-date";

export default function ScheduleAssignConflictDialog({
  message,
  periods,
  busy = false,
  onCancel,
  onSkip,
  onReassign,
}: {
  message: string;
  periods: ScheduleConflictPeriodSummary[];
  busy?: boolean;
  onCancel: () => void;
  onSkip: () => void;
  onReassign: () => void;
}) {
  return (
    <div className="hr-feedback-popup" role="presentation">
      <div
        className="hr-feedback-popup-card hr-feedback-popup-card--warning hr-schedule-conflict-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="hr-schedule-conflict-title"
      >
        <div className="hr-feedback-popup-copy">
          <h3 id="hr-schedule-conflict-title">วันทำงานทับช่วงตารางอื่น</h3>
          <p>{message}</p>
        </div>

        {periods.length > 0 ? (
          <ul className="hr-schedule-conflict-list">
            {periods.map((period) => (
              <li key={period.id}>
                <div>
                  <strong>{period.name}</strong>
                  <span>
                    {formatThaiDateRange(period.periodStart, period.periodEnd)} ·{" "}
                    {period.conflictCount} วัน
                  </span>
                </div>
                <Link
                  className="btn btn-sm"
                  href={`/hr/schedules/${period.id}`}
                  onClick={onCancel}
                >
                  จัดการ
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="hr-schedule-conflict-hint">
          เลือกได้: ข้ามวันที่ชน · ย้ายวันเหล่านั้นมาช่วงนี้ · หรือเปิดช่วงเก่าเพื่อลบ/แก้
        </p>

        <div className="hr-feedback-popup-actions hr-schedule-conflict-actions">
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={busy}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="btn"
            onClick={onSkip}
            disabled={busy}
          >
            {busy ? "กำลังบันทึก…" : "ข้ามวันที่ชน"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onReassign}
            disabled={busy}
          >
            {busy ? "กำลังย้าย…" : "ย้ายมาช่วงนี้"}
          </button>
        </div>
      </div>
    </div>
  );
}
