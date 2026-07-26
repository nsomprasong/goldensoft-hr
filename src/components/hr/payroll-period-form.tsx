"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import {
  compact,
  requireSelect,
  submitHrJson,
  validateDate,
  type FieldErrors,
} from "@/components/hr/form-utils";

export default function PayrollPeriodForm({
  schedules,
  disabled = false,
}: {
  schedules: Array<{ id: string; label: string }>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    payrollScheduleId: "",
    periodStart: "",
    periodEnd: "",
    paymentDate: "",
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
      payrollScheduleId: requireSelect(values.payrollScheduleId) ?? "",
      periodStart: validateDate(values.periodStart, true) ?? "",
      periodEnd: validateDate(values.periodEnd, true) ?? "",
      paymentDate: validateDate(values.paymentDate, true) ?? "",
    });

    if (
      !nextErrors.periodEnd &&
      values.periodStart &&
      values.periodEnd &&
      values.periodEnd < values.periodStart
    ) {
      nextErrors.periodEnd = "วันสิ้นงวดต้องไม่ก่อนวันเริ่มงวด";
    }
    if (
      !nextErrors.paymentDate &&
      values.periodEnd &&
      values.paymentDate &&
      values.paymentDate < values.periodEnd
    ) {
      nextErrors.paymentDate = "วันจ่ายเงินต้องไม่ก่อนวันสิ้นงวด";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาตรวจสอบข้อมูลที่ยังไม่ถูกต้อง" });
      return;
    }

    setSaving(true);
    const result = await submitHrJson(
      "/api/hr/payroll-periods",
      "POST",
      values,
      "สร้างงวดเงินเดือนเรียบร้อยแล้ว",
    );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fieldErrors);
      setFeedback({ kind: "error", text: result.message });
      return;
    }

    setFeedback({ kind: "success", text: result.message });
    setValues({
      payrollScheduleId: values.payrollScheduleId,
      periodStart: "",
      periodEnd: "",
      paymentDate: "",
    });
    router.refresh();
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h2>สร้างงวดเงินเดือน</h2>
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <div className="form-grid">
        <Field
          id="period-scheduleId"
          label="รอบจ่าย"
          required
          error={errors.payrollScheduleId}
        >
          <select
            {...fieldProps("period-scheduleId", errors.payrollScheduleId)}
            value={values.payrollScheduleId}
            onChange={(e) =>
              setValues({ ...values, payrollScheduleId: e.target.value })
            }
          >
            <option value="">— เลือกรอบจ่าย —</option>
            {schedules.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="period-start"
          label="วันเริ่มงวด"
          required
          error={errors.periodStart}
        >
          <input
            {...fieldProps("period-start", errors.periodStart)}
            type="date"
            value={values.periodStart}
            onChange={(e) =>
              setValues({ ...values, periodStart: e.target.value })
            }
          />
        </Field>

        <Field id="period-end" label="วันสิ้นงวด" required error={errors.periodEnd}>
          <input
            {...fieldProps("period-end", errors.periodEnd)}
            type="date"
            value={values.periodEnd}
            onChange={(e) => setValues({ ...values, periodEnd: e.target.value })}
          />
        </Field>

        <Field
          id="period-paymentDate"
          label="วันจ่ายเงิน"
          required
          error={errors.paymentDate}
        >
          <input
            {...fieldProps("period-paymentDate", errors.paymentDate)}
            type="date"
            value={values.paymentDate}
            onChange={(e) =>
              setValues({ ...values, paymentDate: e.target.value })
            }
          />
        </Field>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || disabled || schedules.length === 0}
        >
          {saving ? "กำลังบันทึก…" : "สร้างงวด"}
        </button>
      </div>

      {schedules.length === 0 ? (
        <p className="field-hint">ต้องสร้างรอบจ่ายก่อนจึงจะสร้างงวดเงินเดือนได้</p>
      ) : null}
    </form>
  );
}
