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
  validatePositiveNumber,
  type FieldErrors,
} from "@/components/hr/form-utils";

/**
 * Adds a wage record. Compensation is append-only, so this form never edits an
 * existing row. Render it only when the viewer holds hr.compensation.manage.
 */
export default function CompensationForm({
  employeeId,
  wageTypes,
  disabled = false,
}: {
  employeeId: string;
  wageTypes: Array<{ id: string; label: string }>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    wageTypeId: "",
    amount: "",
    currency: "THB",
    effectiveFrom: "",
    standardHoursPerDay: "",
    standardDaysPerMonth: "",
    overtimeEligible: true,
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
      wageTypeId: requireSelect(values.wageTypeId) ?? "",
      currency: /^[A-Za-z]{3}$/.test(values.currency.trim())
        ? ""
        : "สกุลเงินต้องเป็นรหัส 3 ตัวอักษร เช่น THB",
      amount:
        validatePositiveNumber(values.amount, { allowZero: false }) ?? "",
      effectiveFrom: validateDate(values.effectiveFrom, true) ?? "",
      standardHoursPerDay:
        validatePositiveNumber(values.standardHoursPerDay, {
          required: false,
        }) ?? "",
      standardDaysPerMonth:
        validatePositiveNumber(values.standardDaysPerMonth, {
          required: false,
        }) ?? "",
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาตรวจสอบข้อมูลที่ยังไม่ถูกต้อง" });
      return;
    }

    setSaving(true);
    const result = await submitHrJson(
      `/api/hr/employees/${employeeId}/compensations`,
      "POST",
      {
        wageTypeId: values.wageTypeId,
        amount: Number(values.amount),
        currency: values.currency.trim().toUpperCase(),
        effectiveFrom: values.effectiveFrom,
        standardHoursPerDay: values.standardHoursPerDay
          ? Number(values.standardHoursPerDay)
          : null,
        standardDaysPerMonth: values.standardDaysPerMonth
          ? Number(values.standardDaysPerMonth)
          : null,
        overtimeEligible: values.overtimeEligible,
      },
      "บันทึกค่าจ้างเรียบร้อยแล้ว",
    );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fieldErrors);
      setFeedback({ kind: "error", text: result.message });
      return;
    }

    setFeedback({ kind: "success", text: result.message });
    setValues({ ...values, amount: "", effectiveFrom: "" });
    router.refresh();
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h3>เพิ่มรายการค่าจ้าง</h3>
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <div className="form-grid">
        <Field
          id="comp-wageTypeId"
          label="ประเภทค่าจ้าง"
          required
          error={errors.wageTypeId}
        >
          <select
            {...fieldProps("comp-wageTypeId", errors.wageTypeId)}
            value={values.wageTypeId}
            onChange={(e) =>
              setValues({ ...values, wageTypeId: e.target.value })
            }
          >
            <option value="">— เลือกประเภท —</option>
            {wageTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="comp-amount" label="จำนวนเงิน" required error={errors.amount}>
          <input
            {...fieldProps("comp-amount", errors.amount)}
            type="number"
            min={0}
            step="0.01"
            value={values.amount}
            onChange={(e) => setValues({ ...values, amount: e.target.value })}
          />
        </Field>

        <Field id="comp-currency" label="สกุลเงิน" error={errors.currency}>
          <input
            {...fieldProps("comp-currency", errors.currency)}
            value={values.currency}
            onChange={(e) => setValues({ ...values, currency: e.target.value })}
          />
        </Field>

        <Field
          id="comp-effectiveFrom"
          label="มีผลตั้งแต่"
          required
          error={errors.effectiveFrom}
        >
          <input
            {...fieldProps("comp-effectiveFrom", errors.effectiveFrom)}
            type="date"
            value={values.effectiveFrom}
            onChange={(e) =>
              setValues({ ...values, effectiveFrom: e.target.value })
            }
          />
        </Field>

        <Field
          id="comp-standardHoursPerDay"
          label="ชั่วโมงงานมาตรฐาน/วัน"
          error={errors.standardHoursPerDay}
        >
          <input
            {...fieldProps("comp-standardHoursPerDay", errors.standardHoursPerDay)}
            type="number"
            min={0}
            step="0.25"
            value={values.standardHoursPerDay}
            onChange={(e) =>
              setValues({ ...values, standardHoursPerDay: e.target.value })
            }
          />
        </Field>

        <Field
          id="comp-standardDaysPerMonth"
          label="จำนวนวันทำงาน/เดือน"
          error={errors.standardDaysPerMonth}
        >
          <input
            {...fieldProps(
              "comp-standardDaysPerMonth",
              errors.standardDaysPerMonth,
            )}
            type="number"
            min={0}
            step="0.5"
            value={values.standardDaysPerMonth}
            onChange={(e) =>
              setValues({ ...values, standardDaysPerMonth: e.target.value })
            }
          />
        </Field>

        <div className="field">
          <div className="checkbox-row">
            <input
              id="comp-overtimeEligible"
              name="overtimeEligible"
              type="checkbox"
              checked={values.overtimeEligible}
              onChange={(e) =>
                setValues({ ...values, overtimeEligible: e.target.checked })
              }
            />
            <label htmlFor="comp-overtimeEligible">มีสิทธิ์รับค่าล่วงเวลา</label>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || disabled}
        >
          {saving ? "กำลังบันทึก…" : "บันทึกค่าจ้าง"}
        </button>
      </div>
    </form>
  );
}
