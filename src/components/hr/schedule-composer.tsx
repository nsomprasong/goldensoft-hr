"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import {
  submitHrJson,
  type FieldErrors,
} from "@/components/hr/form-utils";
import ThaiDateInput from "@/components/hr/thai-date-input";
import {
  expandWorkDates,
  type ScheduleDayMode,
} from "@/lib/hr/schedule-dates";
import { formatThaiDateRange } from "@/lib/hr/thai-date";

export type ScheduleComposerOption = {
  id: string;
  label: string;
};

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

const week = weekBounds();
const month = monthBounds();

export default function ScheduleComposer({
  mode = "create",
  scheduleId,
  lockedPeriod,
  employees,
  shifts,
  canPublish = false,
  disabled = false,
}: {
  mode?: "create" | "add";
  scheduleId?: string;
  /** When adding to an existing period, lock the date range. */
  lockedPeriod?: { periodStart: string; periodEnd: string; name: string };
  employees: ScheduleComposerOption[];
  shifts: ScheduleComposerOption[];
  canPublish?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [preset, setPreset] = useState<PeriodPreset>("week");
  const [periodStart, setPeriodStart] = useState(
    lockedPeriod?.periodStart ?? week.start,
  );
  const [periodEnd, setPeriodEnd] = useState(
    lockedPeriod?.periodEnd ?? week.end,
  );
  const [dayMode, setDayMode] = useState<ScheduleDayMode>("weekdays");
  const [shiftId, setShiftId] = useState(shifts[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>(() =>
    employees.map((e) => e.id),
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const workDates = useMemo(
    () => expandWorkDates(periodStart, periodEnd, dayMode),
    [periodStart, periodEnd, dayMode],
  );

  const previewCount = selected.length * workDates.length;

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

  function toggleEmployee(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAllEmployees() {
    setSelected((prev) =>
      prev.length === employees.length ? [] : employees.map((e) => e.id),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const nextErrors: FieldErrors = {};
    if (!periodStart) nextErrors.periodStart = "เลือกวันเริ่ม";
    if (!periodEnd) nextErrors.periodEnd = "เลือกวันสิ้นสุด";
    if (periodStart && periodEnd && periodEnd < periodStart) {
      nextErrors.periodEnd = "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม";
    }
    if (!shiftId) nextErrors.shiftId = "เลือกกะงาน";
    if (selected.length === 0) nextErrors.employees = "เลือกพนักงานอย่างน้อย 1 คน";
    if (workDates.length === 0) {
      nextErrors.dayMode = "ไม่มีวันที่ตรงเงื่อนไขในช่วงนี้";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาเลือกข้อมูลให้ครบก่อนบันทึก" });
      return;
    }

    setSaving(true);

    let id = scheduleId;
    if (mode === "create") {
      const created = await submitHrJson(
        "/api/hr/schedules",
        "POST",
        {
          periodStart,
          periodEnd,
          name: `ตาราง ${formatThaiDateRange(periodStart, periodEnd)}`,
        },
        "สร้างช่วงตารางเรียบร้อยแล้ว",
      );
      if (!created.ok) {
        setSaving(false);
        setFeedback({ kind: "error", text: created.message });
        return;
      }
      id = (created.data as { id?: string } | null)?.id;
      if (!id) {
        setSaving(false);
        setFeedback({ kind: "error", text: "สร้างตารางแล้ว แต่ไม่พบรหัสช่วงตาราง" });
        return;
      }
    }

    const assigned = await submitHrJson(
      `/api/hr/schedules/${id}`,
      "POST",
      {
        action: "assign",
        confirm: true,
        employeeIds: selected,
        workDates,
        shiftId,
      },
      "จัดกะเรียบร้อยแล้ว",
    );

    if (!assigned.ok) {
      setSaving(false);
      setFeedback({ kind: "error", text: assigned.message });
      return;
    }

    let publishedOk = false;
    if (canPublish && mode === "create") {
      const published = await submitHrJson(
        `/api/hr/schedules/${id}`,
        "POST",
        { action: "publish", confirm: true },
        "เปิดใช้ตารางแล้ว",
      );
      publishedOk = published.ok;
      if (!published.ok) {
        setFeedback({
          kind: "warning",
          text: `บันทึกกะแล้ว แต่เปิดใช้ไม่สำเร็จ: ${published.message}`,
        });
        setSaving(false);
        router.push(`/hr/schedules/${id}`);
        router.refresh();
        return;
      }
    }

    setSaving(false);
    setFeedback({
      kind: "success",
      text: publishedOk
        ? `บันทึกและเปิดใช้ตารางแล้ว (${previewCount} รายการ)`
        : `บันทึกตารางแล้ว (${previewCount} รายการ)`,
    });
    router.push(`/hr/schedules/${id}`);
    router.refresh();
  }

  const datesLocked = mode === "add" && !!lockedPeriod;

  return (
    <form className="card schedule-composer" onSubmit={handleSubmit} noValidate>
      <h2>{mode === "create" ? "จัดตารางกะ" : "เพิ่มกะในตารางนี้"}</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        {mode === "create"
          ? "เลือกช่วงวัน กะ และพนักงาน แล้วกดบันทึก — จบในขั้นตอนเดียว"
          : `เพิ่มกะให้ช่วง ${lockedPeriod?.name ?? ""} (${formatThaiDateRange(periodStart, periodEnd)})`}
      </p>

      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      {!datesLocked ? (
        <div className="schedule-preset" role="group" aria-label="ช่วงวัน">
          <button
            type="button"
            className={`btn btn-sm${preset === "week" ? " btn-primary" : ""}`}
            onClick={() => applyPreset("week")}
            disabled={saving || disabled}
          >
            สัปดาห์นี้
          </button>
          <button
            type="button"
            className={`btn btn-sm${preset === "month" ? " btn-primary" : ""}`}
            onClick={() => applyPreset("month")}
            disabled={saving || disabled}
          >
            เดือนนี้
          </button>
          <button
            type="button"
            className={`btn btn-sm${preset === "custom" ? " btn-primary" : ""}`}
            onClick={() => setPreset("custom")}
            disabled={saving || disabled}
          >
            กำหนดเอง
          </button>
        </div>
      ) : null}

      <div className="form-grid">
        <Field
          id="sc-start"
          label="วันเริ่ม"
          required
          error={errors.periodStart}
        >
          <ThaiDateInput
            {...fieldProps("sc-start", errors.periodStart)}
            value={periodStart}
            onChange={(iso) => {
              setPreset("custom");
              setPeriodStart(iso);
            }}
            readOnly={datesLocked}
            disabled={saving || disabled}
          />
        </Field>
        <Field id="sc-end" label="วันสิ้นสุด" required error={errors.periodEnd}>
          <ThaiDateInput
            {...fieldProps("sc-end", errors.periodEnd)}
            value={periodEnd}
            onChange={(iso) => {
              setPreset("custom");
              setPeriodEnd(iso);
            }}
            readOnly={datesLocked}
            disabled={saving || disabled}
          />
        </Field>
        <Field id="sc-shift" label="กะงาน" required error={errors.shiftId}>
          {shifts.length === 0 ? (
            <p className="field-error">
              ยังไม่มีกะงาน —{" "}
              <Link href="/hr/settings/shifts">สร้างกะก่อน</Link>
            </p>
          ) : (
            <select
              {...fieldProps("sc-shift", errors.shiftId)}
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
              disabled={saving || disabled}
            >
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="sc-days" label="วันที่จัดกะ" error={errors.dayMode}>
          <select
            id="sc-days"
            value={dayMode}
            onChange={(e) => setDayMode(e.target.value as ScheduleDayMode)}
            disabled={saving || disabled}
          >
            <option value="weekdays">จันทร์–ศุกร์</option>
            <option value="all">ทุกวันในช่วง</option>
          </select>
        </Field>
      </div>

      <div className="schedule-roster">
        <div className="schedule-roster-head">
          <strong>พนักงาน</strong>
          <button
            type="button"
            className="btn btn-sm"
            onClick={toggleAllEmployees}
            disabled={saving || disabled || employees.length === 0}
          >
            {selected.length === employees.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
          </button>
        </div>
        {errors.employees ? (
          <p className="field-error" role="alert">
            {errors.employees}
          </p>
        ) : null}
        {employees.length === 0 ? (
          <p className="empty">
            ยังไม่มีพนักงาน — <Link href="/hr/employees">เพิ่มพนักงานก่อน</Link>
          </p>
        ) : (
          <ul className="schedule-roster-list">
            {employees.map((emp) => {
              const checked = selected.includes(emp.id);
              return (
                <li key={emp.id}>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEmployee(emp.id)}
                      disabled={saving || disabled}
                    />
                    <span>{emp.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="muted schedule-preview">
        จะสร้างประมาณ <strong>{previewCount}</strong> รายการกะ ·{" "}
        {formatThaiDateRange(periodStart, periodEnd)} · {workDates.length} วัน ·{" "}
        {selected.length} คน
        {canPublish && mode === "create" ? " · และเปิดใช้ทันที" : null}
      </p>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={
            saving ||
            disabled ||
            employees.length === 0 ||
            shifts.length === 0
          }
        >
          {saving
            ? "กำลังบันทึก…"
            : mode === "create"
              ? canPublish
                ? "บันทึกและเปิดใช้"
                : "บันทึกตาราง"
              : "เพิ่มกะ"}
        </button>
      </div>
    </form>
  );
}
