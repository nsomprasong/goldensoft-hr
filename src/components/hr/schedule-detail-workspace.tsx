"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

import Alert from "@/components/hr/alert";
import { submitHrJson } from "@/components/hr/form-utils";
import PublishScheduleButton from "@/components/hr/publish-schedule-button";
import type { ScheduleComposerOption } from "@/components/hr/schedule-composer";
import type { SchedulePeriodShiftRow } from "@/lib/hr/data";
import { formatThaiDateRange } from "@/lib/hr/thai-date";

function parseShiftOption(label: string): { name: string; time: string | null } {
  const match = label.match(/^(.*?)\s+\((\d{2}:\d{2}[–-]\d{2}:\d{2})\)$/);
  if (!match) return { name: label, time: null };
  return { name: match[1]!.trim(), time: match[2]! };
}

export default function ScheduleDetailWorkspace({
  scheduleId,
  periodStart,
  periodEnd,
  statusCode,
  locked,
  canManage,
  canPublish,
  periodShifts,
  shifts,
  available,
}: {
  scheduleId: string;
  periodName: string;
  periodStart: string;
  periodEnd: string;
  statusCode: string;
  statusName: string;
  locked: boolean;
  canManage: boolean;
  canPublish: boolean;
  periodShifts: SchedulePeriodShiftRow[];
  shifts: ScheduleComposerOption[];
  available: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const [adding, setAdding] = useState(false);
  const [shiftId, setShiftId] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const usedShiftIds = useMemo(
    () => new Set(periodShifts.map((s) => s.shiftId)),
    [periodShifts],
  );

  const availableShifts = useMemo(
    () => shifts.filter((s) => !usedShiftIds.has(s.id)),
    [shifts, usedShiftIds],
  );

  useEffect(() => {
    if (!adding) return;
    setShiftId(availableShifts[0]?.id ?? "");
  }, [adding, availableShifts]);

  useEffect(() => {
    if (!adding) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [adding]);

  useEffect(() => {
    if (!adding) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setAdding(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adding]);

  async function addShift(event: React.FormEvent) {
    event.preventDefault();
    if (!shiftId) {
      setFeedback({ kind: "error", text: "เลือกกะที่จะใช้ในช่วงนี้" });
      return;
    }
    setSaving(true);
    setFeedback(null);
    const result = await submitHrJson(
      `/api/hr/schedules/${scheduleId}`,
      "POST",
      { action: "addShift", confirm: true, shiftId },
      "เพิ่มกะในช่วงตารางแล้ว",
    );
    setSaving(false);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.message });
      return;
    }
    setAdding(false);
    router.push(`/hr/schedules/${scheduleId}/shifts/${shiftId}`);
    router.refresh();
  }

  async function removeShift(row: SchedulePeriodShiftRow) {
    if (
      !window.confirm(
        `ลบกะ “${row.name}” ออกจากช่วงนี้หรือไม่?\nพนักงานที่อยู่ในกะนี้จะถูกลบออกจากตารางด้วย`,
      )
    ) {
      return;
    }
    setRemovingId(row.shiftId);
    const result = await submitHrJson(
      `/api/hr/schedules/${scheduleId}`,
      "POST",
      { action: "removeShift", confirm: true, shiftId: row.shiftId },
      "ลบกะออกจากช่วงตารางแล้ว",
    );
    setRemovingId(null);
    if (!result.ok) {
      window.alert(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <>
      {canPublish ? (
        <div className="hr-schedule-toolbar">
          <PublishScheduleButton
            scheduleId={scheduleId}
            statusCode={statusCode}
            disabled={!available}
          />
          {locked ? (
            <span className="hr-schedule-toolbar-note" title="ถูกล็อก">
              🔒
            </span>
          ) : null}
        </div>
      ) : null}

      <section className="hr-schedule-shifts" aria-label="กะในช่วงนี้">
        <div className="hr-schedule-shifts-head">
          <h2>
            <span aria-hidden="true">🕒</span> กะ
          </h2>
          <span className="hr-schedule-shifts-count">{periodShifts.length}</span>
        </div>

        {periodShifts.length === 0 ? (
          <div className="hr-schedule-empty">
            {canManage && !locked ? (
              <button
                type="button"
                className="hr-schedule-empty-icon"
                onClick={() => setAdding(true)}
                disabled={!available || availableShifts.length === 0}
                aria-label="เพิ่มกะ"
              >
                ＋
              </button>
            ) : (
              <span className="hr-schedule-empty-icon" aria-hidden="true">
                ＋
              </span>
            )}
            <p>ยังไม่มีกะ</p>
            {canManage && !locked ? (
              <p>
                {availableShifts.length === 0
                  ? "สร้างกะที่ตั้งค่าก่อน"
                  : "แตะ + เพื่อเพิ่มกะแรก"}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="hr-schedule-shift-grid">
            {periodShifts.map((row) => (
              <article key={row.id} className="hr-schedule-shift-card">
                <div className="hr-schedule-shift-card-main">
                  <h3>{row.name}</h3>
                  <p>
                    <span aria-hidden="true">⏱</span> {row.timeLabel}
                  </p>
                  <p>
                    <span aria-hidden="true">👤</span> {row.employeeCount}
                  </p>
                </div>
                <div className="hr-schedule-shift-card-actions">
                  <Link
                    className="btn btn-sm btn-primary"
                    href={`/hr/schedules/${scheduleId}/shifts/${row.shiftId}`}
                  >
                    จัดพนักงาน
                  </Link>
                  {canManage && !locked ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => removeShift(row)}
                      disabled={!available || removingId === row.shiftId}
                    >
                      {removingId === row.shiftId ? "กำลังลบ…" : "ลบ"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {canManage && !locked && !adding ? (
        <button
          type="button"
          className="hr-fab"
          onClick={() => setAdding(true)}
          disabled={!available || availableShifts.length === 0}
          aria-label="เพิ่มกะ"
          title={
            availableShifts.length === 0
              ? "เพิ่มกะครบแล้ว หรือยังไม่มีกะในระบบ"
              : "เพิ่มกะ"
          }
        >
          <span aria-hidden="true">+</span>
        </button>
      ) : null}

      {adding ? (
        <div className="hr-overlay" role="presentation">
          <button
            type="button"
            className="hr-overlay-backdrop"
            aria-label="ปิด"
            onClick={() => setAdding(false)}
          />
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="hr-overlay-head hr-period-create-overlay-head">
              <div>
                <p className="hr-period-create-overlay-kicker">ช่วงตาราง</p>
                <h2 id={titleId}>เพิ่มกะ</h2>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setAdding(false)}
              >
                ปิด
              </button>
            </div>
            <div className="hr-overlay-body">
              <form className="hr-add-shift" onSubmit={addShift} noValidate>
                <div className="hr-add-shift-period" aria-live="polite">
                  <span className="hr-add-shift-period-label">ใช้ในช่วง</span>
                  <strong>{formatThaiDateRange(periodStart, periodEnd)}</strong>
                </div>

                <p className="hr-add-shift-lead">
                  เลือกกะที่จะเปิดในช่วงนี้ แล้วไปจัดพนักงานต่อได้ทันที
                </p>

                {feedback ? (
                  <Alert kind={feedback.kind}>{feedback.text}</Alert>
                ) : null}

                {availableShifts.length === 0 ? (
                  <div className="hr-add-shift-empty">
                    <span aria-hidden="true">🕒</span>
                    <p>ไม่มีกะเหลือให้เพิ่ม</p>
                    <p>
                      <Link href="/hr/settings/shifts">สร้างกะใหม่</Link>
                      {" · "}แล้วกลับมาเพิ่มที่นี่
                    </p>
                  </div>
                ) : (
                  <div
                    className="hr-add-shift-options"
                    role="radiogroup"
                    aria-label="เลือกกะ"
                  >
                    {availableShifts.map((s) => {
                      const parsed = parseShiftOption(s.label);
                      const active = shiftId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={
                            active
                              ? "hr-add-shift-option hr-add-shift-option--active"
                              : "hr-add-shift-option"
                          }
                          onClick={() => setShiftId(s.id)}
                          disabled={saving}
                        >
                          <span className="hr-add-shift-option-mark" aria-hidden="true">
                            {active ? "●" : "○"}
                          </span>
                          <span className="hr-add-shift-option-body">
                            <span className="hr-add-shift-option-name">
                              {parsed.name}
                            </span>
                            {parsed.time ? (
                              <span className="hr-add-shift-option-time">
                                <span aria-hidden="true">⏱</span> {parsed.time}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="form-actions hr-add-shift-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      saving || availableShifts.length === 0 || !shiftId
                    }
                  >
                    {saving ? "กำลังเพิ่ม…" : "เพิ่มแล้วจัดพนักงาน"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setAdding(false)}
                    disabled={saving}
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
