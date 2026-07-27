"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import { submitHrJson, type FieldErrors } from "@/components/hr/form-utils";
import { WORK_DAY_OPTIONS } from "@/lib/hr/work-days";

const DEFAULT_DAYS = [1, 2, 3, 4, 5];

export default function WorkCalendarForm({
  mode = "create",
  calendarId,
  initialName = "",
  initialWorkDays = DEFAULT_DAYS,
  disabled = false,
}: {
  mode?: "create" | "edit";
  calendarId?: string;
  initialName?: string;
  initialWorkDays?: number[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const fieldPrefix = mode === "edit" ? `cal-edit-${calendarId}` : "cal-new";
  const [name, setName] = useState(initialName);
  const [workDays, setWorkDays] = useState<number[]>(initialWorkDays);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  function toggleDay(day: number) {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (workDays.length === 0) {
      setErrors({ workDays: "เลือกวันทำงานอย่างน้อย 1 วัน" });
      setFeedback({ kind: "error", text: "กรุณาเลือกวันทำงาน" });
      return;
    }
    setErrors({});
    setSaving(true);

    const payload = {
      name: name.trim() || undefined,
      workDays,
      timezone: "Asia/Bangkok",
    };

    const result =
      mode === "create"
        ? await submitHrJson(
            "/api/hr/calendars",
            "POST",
            payload,
            "สร้างปฏิทินเรียบร้อยแล้ว",
          )
        : await submitHrJson(
            `/api/hr/calendars/${calendarId}`,
            "PATCH",
            payload,
            "บันทึกปฏิทินเรียบร้อยแล้ว",
          );

    setSaving(false);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.message });
      return;
    }

    setFeedback({ kind: "success", text: result.message });
    if (mode === "create") {
      const id = (result.data as { id?: string } | null)?.id;
      setName("");
      setWorkDays(DEFAULT_DAYS);
      if (id) {
        router.push(`/hr/calendars?id=${id}`);
        router.refresh();
        return;
      }
    }
    router.refresh();
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h2>{mode === "create" ? "สร้างปฏิทินวันทำงาน" : "แก้ไขวันทำงาน"}</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        เลือกว่าองค์กรทำงานวันไหนบ้าง แล้วเพิ่มวันหยุดด้านล่างได้ทันที
      </p>
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <div className="form-grid">
        <Field id={`${fieldPrefix}-name`} label="ชื่อปฏิทิน" error={errors.name}>
          <input
            {...fieldProps(`${fieldPrefix}-name`, errors.name)}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น ปฏิทินสำนักงาน"
            disabled={saving || disabled}
          />
        </Field>
      </div>

      <div className="field" style={{ marginTop: "0.875rem" }}>
        <span className="field-label">วันทำงาน *</span>
        {errors.workDays ? (
          <p className="field-error" role="alert">
            {errors.workDays}
          </p>
        ) : null}
        <div className="workday-chips" role="group" aria-label="วันทำงาน">
          {WORK_DAY_OPTIONS.map((day) => {
            const on = workDays.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                className={`btn btn-sm${on ? " btn-primary" : ""}`}
                aria-pressed={on}
                onClick={() => toggleDay(day.value)}
                disabled={saving || disabled}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || disabled}
        >
          {saving
            ? "กำลังบันทึก…"
            : mode === "create"
              ? "สร้างปฏิทิน"
              : "บันทึกวันทำงาน"}
        </button>
      </div>
    </form>
  );
}
