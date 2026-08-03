"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import {
  compact,
  requireSelect,
  requireText,
  submitHrJson,
  type FieldErrors,
} from "@/components/hr/form-utils";

export type PayrollScheduleFormValues = {
  code: string;
  name: string;
  payFrequencyId: string;
  periodStartRule: string;
  periodEndRule: string;
  paymentDayRule: string;
  timezone: string;
};

const EMPTY: PayrollScheduleFormValues = {
  code: "",
  name: "",
  payFrequencyId: "",
  periodStartRule: "DAY:1",
  periodEndRule: "END_OF_MONTH",
  paymentDayRule: "END_OF_PERIOD",
  timezone: "Asia/Bangkok",
};

export default function PayrollScheduleForm({
  mode,
  scheduleId,
  initialValues,
  payFrequencies,
  disabled = false,
  embedded = false,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  scheduleId?: string;
  initialValues?: Partial<PayrollScheduleFormValues>;
  payFrequencies: Array<{ id: string; label: string }>;
  disabled?: boolean;
  embedded?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<PayrollScheduleFormValues>({
    ...EMPTY,
    ...initialValues,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const nextErrors = compact({
      name: requireText(values.name) ?? "",
      payFrequencyId: requireSelect(values.payFrequencyId) ?? "",
      periodStartRule: requireText(values.periodStartRule) ?? "",
      periodEndRule: requireText(values.periodEndRule) ?? "",
      paymentDayRule: requireText(values.paymentDayRule) ?? "",
      timezone: requireText(values.timezone) ?? "",
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาตรวจสอบข้อมูล" });
      return;
    }

    const payload = {
      name: values.name.trim(),
      payFrequencyId: values.payFrequencyId,
      periodStartRule: values.periodStartRule.trim(),
      periodEndRule: values.periodEndRule.trim(),
      paymentDayRule: values.paymentDayRule.trim(),
      timezone: values.timezone.trim(),
    };

    setSaving(true);
    const result =
      mode === "create"
        ? await submitHrJson(
            "/api/hr/payroll-schedules",
            "POST",
            payload,
            "เพิ่มรอบจ่ายเรียบร้อยแล้ว",
          )
        : await submitHrJson(
            `/api/hr/payroll-schedules/${scheduleId}`,
            "PATCH",
            payload,
            "บันทึกรอบจ่ายเรียบร้อยแล้ว",
          );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fieldErrors);
      setFeedback({ kind: "error", text: result.message });
      return;
    }

    if (onDone) {
      onDone();
      return;
    }

    setFeedback({ kind: "success", text: result.message });
    if (mode === "create") setValues(EMPTY);
    router.refresh();
  }

  const busy = saving || disabled;

  return (
    <form
      className={embedded ? "hr-shift-form-embedded" : "card"}
      onSubmit={handleSubmit}
      noValidate
    >
      {embedded ? null : (
        <h2>{mode === "create" ? "เพิ่มรอบจ่ายใหม่" : "แก้ไขรอบจ่าย"}</h2>
      )}
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <div className="form-grid">
        <Field id="sched-name" label="ชื่อรอบจ่าย" required error={errors.name}>
          <input
            {...fieldProps("sched-name", errors.name)}
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            placeholder="เงินเดือนรายเดือน"
            disabled={busy}
          />
        </Field>

        <Field
          id="sched-payFrequencyId"
          label="ความถี่การจ่าย"
          required
          error={errors.payFrequencyId}
        >
          <select
            {...fieldProps("sched-payFrequencyId", errors.payFrequencyId)}
            value={values.payFrequencyId}
            onChange={(e) =>
              setValues({ ...values, payFrequencyId: e.target.value })
            }
            disabled={busy}
          >
            <option value="">— เลือกความถี่ —</option>
            {payFrequencies.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="sched-periodStartRule"
          label="กติกาวันเริ่มงวด"
          required
          error={errors.periodStartRule}
          hint="เช่น DAY:1 หรือ DAY:16"
        >
          <input
            {...fieldProps("sched-periodStartRule", errors.periodStartRule)}
            value={values.periodStartRule}
            onChange={(e) =>
              setValues({ ...values, periodStartRule: e.target.value })
            }
            disabled={busy}
          />
        </Field>

        <Field
          id="sched-periodEndRule"
          label="กติกาวันสิ้นงวด"
          required
          error={errors.periodEndRule}
          hint="เช่น END_OF_MONTH"
        >
          <input
            {...fieldProps("sched-periodEndRule", errors.periodEndRule)}
            value={values.periodEndRule}
            onChange={(e) =>
              setValues({ ...values, periodEndRule: e.target.value })
            }
            disabled={busy}
          />
        </Field>

        <Field
          id="sched-paymentDayRule"
          label="กติกาวันจ่ายเงิน"
          required
          error={errors.paymentDayRule}
          hint="เช่น END_OF_PERIOD"
        >
          <input
            {...fieldProps("sched-paymentDayRule", errors.paymentDayRule)}
            value={values.paymentDayRule}
            onChange={(e) =>
              setValues({ ...values, paymentDayRule: e.target.value })
            }
            disabled={busy}
          />
        </Field>

        <Field id="sched-timezone" label="เขตเวลา" required error={errors.timezone}>
          <input
            {...fieldProps("sched-timezone", errors.timezone)}
            value={values.timezone}
            onChange={(e) => setValues({ ...values, timezone: e.target.value })}
            disabled={busy}
          />
        </Field>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {saving ? "กำลังบันทึก…" : mode === "create" ? "เพิ่มรอบจ่าย" : "บันทึก"}
        </button>
        {onCancel || mode === "edit" ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (onCancel) onCancel();
              else router.push("/hr/settings/payroll-schedules");
            }}
            disabled={saving}
          >
            ยกเลิก
          </button>
        ) : null}
      </div>
    </form>
  );
}
