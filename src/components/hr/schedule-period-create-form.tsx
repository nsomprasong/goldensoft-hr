"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import { submitHrJson, type FieldErrors } from "@/components/hr/form-utils";
import ThaiDateInput from "@/components/hr/thai-date-input";
import { formatThaiDate, formatThaiDateRange } from "@/lib/hr/thai-date";

type PeriodPreset = "week" | "month" | "custom";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIsoLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function weekBounds(now = new Date()) {
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + mondayOffset,
  );
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toIsoLocal(start), end: toIsoLocal(end) };
}

function monthBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toIsoLocal(start), end: toIsoLocal(end) };
}

function dayCount(startIso: string, endIso: string): number | null {
  if (!startIso || !endIso || endIso < startIso) return null;
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

const week = weekBounds();

const PRESETS: Array<{
  id: PeriodPreset;
  title: string;
  hint: string;
}> = [
  { id: "week", title: "สัปดาห์นี้", hint: "จันทร์–อาทิตย์" },
  { id: "month", title: "เดือนนี้", hint: "ทั้งเดือนปฏิทิน" },
  { id: "custom", title: "กำหนดเอง", hint: "เลือกวันเริ่ม–สิ้นสุด" },
];

export default function SchedulePeriodCreateForm({
  branchId,
  branchLabel,
  disabled = false,
  onDone,
  onCancel,
}: {
  branchId: string;
  branchLabel?: string;
  disabled?: boolean;
  onDone?: (scheduleId: string) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [preset, setPreset] = useState<PeriodPreset>("week");
  const [periodStart, setPeriodStart] = useState(week.start);
  const [periodEnd, setPeriodEnd] = useState(week.end);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const days = useMemo(
    () => dayCount(periodStart, periodEnd),
    [periodStart, periodEnd],
  );

  function applyPreset(next: PeriodPreset) {
    setPreset(next);
    if (next === "week") {
      const b = weekBounds();
      setPeriodStart(b.start);
      setPeriodEnd(b.end);
    } else if (next === "month") {
      const b = monthBounds();
      setPeriodStart(b.start);
      setPeriodEnd(b.end);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    const next: FieldErrors = {};
    if (!branchId) next.branchId = "เลือกสาขา";
    if (!periodStart) next.periodStart = "เลือกวันเริ่ม";
    if (!periodEnd) next.periodEnd = "เลือกวันสิ้นสุด";
    if (periodStart && periodEnd && periodEnd < periodStart) {
      next.periodEnd = "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFeedback({
        kind: "error",
        text: !branchId ? "กรุณาเลือกสาขาก่อน" : "กรุณาเลือกช่วงวันให้ครบ",
      });
      return;
    }

    setSaving(true);
    const created = await submitHrJson(
      "/api/hr/schedules",
      "POST",
      {
        branchId,
        periodStart,
        periodEnd,
        name: `ตาราง ${formatThaiDateRange(periodStart, periodEnd)}`,
      },
      "สร้างช่วงตารางเรียบร้อยแล้ว",
    );
    setSaving(false);
    if (!created.ok) {
      setFeedback({ kind: "error", text: created.message });
      return;
    }
    const id = (created.data as { id?: string } | null)?.id;
    if (!id) {
      setFeedback({ kind: "error", text: "สร้างแล้ว แต่ไม่พบรหัสช่วงตาราง" });
      return;
    }
    if (onDone) {
      onDone(id);
      return;
    }
    router.push(`/hr/schedules/${id}`);
    router.refresh();
  }

  return (
    <form
      className="hr-period-create"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="hr-period-create-branch">
        <span className="hr-period-create-branch-label">สาขา</span>
        <strong>{branchLabel?.trim() || "—"}</strong>
      </div>

      <p className="hr-period-create-lead">
        เลือกช่วงวันของตารางนี้ แล้วค่อยเพิ่มกะและจัดพนักงานเฉพาะสาขานี้
      </p>

      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <div className="hr-period-presets" role="group" aria-label="เลือกช่วงวัน">
        {PRESETS.map((item) => {
          const active = preset === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={
                active
                  ? "hr-period-preset hr-period-preset--active"
                  : "hr-period-preset"
              }
              aria-pressed={active}
              onClick={() => applyPreset(item.id)}
              disabled={saving || disabled}
            >
              <span className="hr-period-preset-title">{item.title}</span>
              <span className="hr-period-preset-hint">{item.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="hr-period-create-dates">
        <Field id="pc-start" label="วันเริ่ม" required error={errors.periodStart}>
          <ThaiDateInput
            {...fieldProps("pc-start", errors.periodStart)}
            value={periodStart}
            onChange={(iso) => {
              setPreset("custom");
              setPeriodStart(iso);
            }}
            disabled={saving || disabled}
          />
        </Field>
        <div className="hr-period-create-dates-sep" aria-hidden="true">
          →
        </div>
        <Field id="pc-end" label="วันสิ้นสุด" required error={errors.periodEnd}>
          <ThaiDateInput
            {...fieldProps("pc-end", errors.periodEnd)}
            value={periodEnd}
            onChange={(iso) => {
              setPreset("custom");
              setPeriodEnd(iso);
            }}
            disabled={saving || disabled}
          />
        </Field>
      </div>

      <div className="hr-period-create-summary" aria-live="polite">
        <div>
          <span className="hr-period-create-summary-label">ช่วงที่เลือก</span>
          <strong>
            {periodStart && periodEnd
              ? formatThaiDateRange(periodStart, periodEnd)
              : "ยังไม่ได้เลือกครบ"}
          </strong>
        </div>
        <div className="hr-period-create-summary-meta">
          <span>
            เริ่ม {periodStart ? formatThaiDate(periodStart) : "—"}
          </span>
          <span>
            สิ้นสุด {periodEnd ? formatThaiDate(periodEnd) : "—"}
          </span>
          <span className="hr-period-create-summary-days">
            {days != null ? `${days} วัน` : "—"}
          </span>
        </div>
      </div>

      <div className="form-actions hr-period-create-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || disabled}
        >
          {saving ? "กำลังสร้าง…" : "สร้างช่วงตาราง"}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={saving}
          >
            ยกเลิก
          </button>
        ) : null}
      </div>
    </form>
  );
}
