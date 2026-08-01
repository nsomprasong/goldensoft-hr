"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import Field, { fieldProps } from "@/components/hr/field";
import {
  compact,
  firstError,
  requireText,
  submitHrJson,
  validateDate,
  type FieldErrors,
} from "@/components/hr/form-utils";
import ThaiDateInput from "@/components/hr/thai-date-input";
import { signalNavigationPending } from "@/lib/navigation-pending";

function monthBounds(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { start, end };
}

const bounds = monthBounds();

export type SchedulePeriodFormValues = {
  name: string;
  periodStart: string;
  periodEnd: string;
};

export default function SchedulePeriodForm({
  mode = "create",
  scheduleId,
  initialValues,
  statusCode,
  disabled = false,
}: {
  mode?: "create" | "edit";
  scheduleId?: string;
  initialValues?: Partial<SchedulePeriodFormValues>;
  /** When locked, the form stays read-only. */
  statusCode?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const locked = statusCode === "LOCKED";
  const [values, setValues] = useState<SchedulePeriodFormValues>({
    name: "",
    periodStart: bounds.start,
    periodEnd: bounds.end,
    ...initialValues,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;

    const nextErrors = compact({
      periodStart: validateDate(values.periodStart, true) ?? "",
      periodEnd: validateDate(values.periodEnd, true) ?? "",
      name: values.name.trim() ? (requireText(values.name) ?? "") : "",
    });
    if (
      !nextErrors.periodStart &&
      !nextErrors.periodEnd &&
      values.periodEnd < values.periodStart
    ) {
      nextErrors.periodEnd = "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({
        kind: "error",
        message: "กรุณาตรวจสอบข้อมูลที่ยังไม่ถูกต้อง",
      });
      return;
    }

    const payload = {
      name: values.name.trim() || undefined,
      periodStart: values.periodStart,
      periodEnd: values.periodEnd,
    };

    setSaving(true);
    setFeedback({ kind: "info", message: "กำลังบันทึก…" });
    const result =
      mode === "create"
        ? await submitHrJson(
            "/api/hr/schedules",
            "POST",
            payload,
            "สร้างช่วงตารางเรียบร้อยแล้ว",
          )
        : await submitHrJson(
            `/api/hr/schedules/${scheduleId}`,
            "PATCH",
            payload,
            "บันทึกช่วงตารางเรียบร้อยแล้ว",
          );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fieldErrors);
      const hint = firstError(result.fieldErrors);
      setFeedback({
        kind: "error",
        message: hint ? `${result.message} (${hint})` : result.message,
      });
      return;
    }

    setFeedback({ kind: "success", message: result.message });
    if (mode === "create") {
      setValues({ name: "", periodStart: bounds.start, periodEnd: bounds.end });
      const createdId = (result.data as { id?: string } | null)?.id;
      if (createdId) {
        signalNavigationPending("กำลังเปิดช่วงตาราง");
        router.push(`/hr/schedules/${createdId}`);
        return;
      }
    }
    router.refresh();
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <FeedbackPopup
        feedback={feedback}
        onClose={() => setFeedback(null)}
      />
      <h2>{mode === "create" ? "สร้างช่วงตารางใหม่" : "แก้ไขช่วงตาราง"}</h2>
      {mode === "create" ? (
        <p className="muted" style={{ marginTop: 0 }}>
          รหัสช่วงตารางจะถูกสร้างอัตโนมัติเมื่อบันทึก
        </p>
      ) : locked ? (
        <p className="muted" style={{ marginTop: 0 }}>
          ช่วงตารางถูกล็อกแล้ว แก้ไขหรือลบไม่ได้
        </p>
      ) : null}

      <div className="form-grid">
        <Field id="sched-period-name" label="ชื่อช่วงตาราง" error={errors.name}>
          <input
            {...fieldProps("sched-period-name", errors.name)}
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            placeholder="เช่น ตาราง ก.ค. 2569"
            readOnly={locked}
          />
        </Field>

        <Field
          id="sched-period-start"
          label="วันเริ่ม"
          required
          error={errors.periodStart}
        >
          <ThaiDateInput
            {...fieldProps("sched-period-start", errors.periodStart)}
            value={values.periodStart}
            onChange={(iso) =>
              setValues({ ...values, periodStart: iso })
            }
            readOnly={locked}
          />
        </Field>

        <Field
          id="sched-period-end"
          label="วันสิ้นสุด"
          required
          error={errors.periodEnd}
        >
          <ThaiDateInput
            {...fieldProps("sched-period-end", errors.periodEnd)}
            value={values.periodEnd}
            onChange={(iso) => setValues({ ...values, periodEnd: iso })}
            readOnly={locked}
          />
        </Field>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || disabled || locked}
        >
          {saving
            ? "กำลังบันทึก…"
            : mode === "create"
              ? "สร้างช่วงตาราง"
              : "บันทึก"}
        </button>
        {mode === "edit" ? (
          <button
            type="button"
            className="btn"
            onClick={() => router.push("/hr/schedules")}
            disabled={saving}
          >
            ยกเลิก
          </button>
        ) : null}
      </div>
    </form>
  );
}
