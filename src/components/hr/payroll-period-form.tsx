"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

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
  const titleId = useId();
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setErrors({});
    setFeedback(null);
    setSaving(false);
  }

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

    setValues({
      payrollScheduleId: values.payrollScheduleId,
      periodStart: "",
      periodEnd: "",
      paymentDate: "",
    });
    close();
    router.refresh();
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          className="hr-fab"
          onClick={() => setOpen(true)}
          disabled={disabled || schedules.length === 0}
          aria-label="สร้างงวดจ่าย"
          title={
            schedules.length === 0
              ? "ต้องสร้างรอบจ่ายก่อน"
              : "สร้างงวดจ่าย"
          }
        >
          <span aria-hidden="true">+</span>
        </button>
      ) : null}

      {open ? (
        <div className="hr-overlay" role="presentation">
          <button
            type="button"
            className="hr-overlay-backdrop"
            aria-label="ปิด"
            onClick={close}
          />
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="hr-overlay-head hr-period-create-overlay-head">
              <div>
                <p className="hr-period-create-overlay-kicker">งวดเงินเดือน</p>
                <h2 id={titleId}>สร้างงวดจ่าย</h2>
              </div>
              <button type="button" className="btn btn-sm" onClick={close}>
                ปิด
              </button>
            </div>
            <div className="hr-overlay-body">
              <form onSubmit={handleSubmit} noValidate>
                {feedback ? (
                  <Alert kind={feedback.kind}>{feedback.text}</Alert>
                ) : null}

                <div className="form-grid">
                  <Field
                    id="period-scheduleId"
                    label="รอบจ่าย"
                    required
                    error={errors.payrollScheduleId}
                  >
                    <select
                      {...fieldProps(
                        "period-scheduleId",
                        errors.payrollScheduleId,
                      )}
                      value={values.payrollScheduleId}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          payrollScheduleId: e.target.value,
                        })
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

                  <Field
                    id="period-end"
                    label="วันสิ้นงวด"
                    required
                    error={errors.periodEnd}
                  >
                    <input
                      {...fieldProps("period-end", errors.periodEnd)}
                      type="date"
                      value={values.periodEnd}
                      onChange={(e) =>
                        setValues({ ...values, periodEnd: e.target.value })
                      }
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
                    type="button"
                    className="btn"
                    onClick={close}
                    disabled={saving}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || disabled || schedules.length === 0}
                  >
                    {saving ? "กำลังบันทึก…" : "สร้างงวด"}
                  </button>
                </div>

                {schedules.length === 0 ? (
                  <p className="field-hint">
                    ต้องสร้างรอบจ่ายก่อนจึงจะสร้างงวดเงินเดือนได้
                  </p>
                ) : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
