"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import ThaiDateInput from "@/components/hr/thai-date-input";
import {
  compact,
  requireSelect,
  submitHrJson,
  validateDate,
  validatePositiveNumber,
  type FieldErrors,
} from "@/components/hr/form-utils";
import { formatThaiDate } from "@/lib/hr/thai-date";

export type CompensationCurrentValues = {
  wageTypeId: string;
  amount: string;
  currency: string;
  effectiveFrom: string;
  overtimeEligible: boolean;
};

function bangkokTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Saves wage data. Same effective-from as current → edits in place;
 * a later date closes the previous row and appends history.
 */
export default function CompensationForm({
  employeeId,
  wageTypes,
  current = null,
  disabled = false,
  embedded = false,
}: {
  employeeId: string;
  wageTypes: Array<{ id: string; label: string }>;
  current?: CompensationCurrentValues | null;
  disabled?: boolean;
  /** When true, hide outer card chrome (parent already provides a section). */
  embedded?: boolean;
}) {
  const router = useRouter();
  const hasCurrent = Boolean(current);
  const [editing, setEditing] = useState(!hasCurrent);
  const [values, setValues] = useState({
    wageTypeId: current?.wageTypeId ?? "",
    amount: current?.amount ?? "",
    currency: current?.currency ?? "THB",
    effectiveFrom: current?.effectiveFrom || bangkokTodayIso(),
    overtimeEligible: current?.overtimeEligible ?? true,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  function reset() {
    setValues({
      wageTypeId: current?.wageTypeId ?? "",
      amount: current?.amount ?? "",
      currency: current?.currency ?? "THB",
      effectiveFrom: current?.effectiveFrom || bangkokTodayIso(),
      overtimeEligible: current?.overtimeEligible ?? true,
    });
    setErrors({});
    setFeedback(null);
    setEditing(!hasCurrent);
  }

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
        overtimeEligible: values.overtimeEligible,
      },
      hasCurrent ? "บันทึกค่าตอบแทนเรียบร้อยแล้ว" : "กำหนดค่าจ้างเรียบร้อยแล้ว",
    );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fieldErrors);
      setFeedback({ kind: "error", text: result.message });
      return;
    }

    setFeedback({ kind: "success", text: result.message });
    setEditing(false);
    router.refresh();
  }

  const body = (
    <>
      <div className="hr-entity-card-top">
        <h3 style={{ margin: 0 }}>{hasCurrent ? "ค่าตอบแทน" : "กำหนดค่าจ้าง"}</h3>
        {hasCurrent ? (
          editing ? (
            <button type="button" className="btn btn-sm" onClick={reset}>
              ยกเลิก
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setEditing(true)}
              disabled={disabled}
            >
              แก้ไข
            </button>
          )
        ) : null}
      </div>

      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      {!editing && hasCurrent ? (
        <dl className="dl">
          <dt>ประเภทค่าจ้าง</dt>
          <dd>
            {wageTypes.find((w) => w.id === current?.wageTypeId)?.label ?? "—"}
          </dd>
          <dt>จำนวนเงิน</dt>
          <dd>
            {current?.amount} {current?.currency}
          </dd>
          <dt>มีผลตั้งแต่</dt>
          <dd>{formatThaiDate(current?.effectiveFrom)}</dd>
          <dt>OT</dt>
          <dd>{current?.overtimeEligible ? "ได้" : "ไม่ได้"}</dd>
        </dl>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="field-hint">
            ใช้วันมีผลเดิมเพื่อแก้รายการปัจจุบัน หรือเลือกวันหลังกว่าเพื่อเปิดรอบค่าจ้างใหม่
          </p>
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

            <Field
              id="comp-amount"
              label="จำนวนเงิน"
              required
              error={errors.amount}
            >
              <input
                {...fieldProps("comp-amount", errors.amount)}
                type="number"
                min={0}
                step="0.01"
                value={values.amount}
                onChange={(e) =>
                  setValues({ ...values, amount: e.target.value })
                }
              />
            </Field>

            <Field id="comp-currency" label="สกุลเงิน" error={errors.currency}>
              <input
                {...fieldProps("comp-currency", errors.currency)}
                value={values.currency}
                onChange={(e) =>
                  setValues({ ...values, currency: e.target.value })
                }
              />
            </Field>

            <Field
              id="comp-effectiveFrom"
              label="มีผลตั้งแต่"
              required
              error={errors.effectiveFrom}
            >
              <ThaiDateInput
                id="comp-effectiveFrom"
                value={values.effectiveFrom}
                onChange={(value) =>
                  setValues({ ...values, effectiveFrom: value })
                }
                required
                aria-invalid={Boolean(errors.effectiveFrom)}
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
                    setValues({
                      ...values,
                      overtimeEligible: e.target.checked,
                    })
                  }
                />
                <label htmlFor="comp-overtimeEligible">
                  มีสิทธิ์รับค่าล่วงเวลา
                </label>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || disabled}
            >
              {saving ? "กำลังบันทึก…" : "บันทึกค่าตอบแทน"}
            </button>
          </div>
        </form>
      )}
    </>
  );

  if (embedded) return <div className="hr-compensation-block">{body}</div>;
  return <section className="card">{body}</section>;
}
