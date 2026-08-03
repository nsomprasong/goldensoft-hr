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
  validateDate,
  validatePositiveNumber,
  type FieldErrors,
} from "@/components/hr/form-utils";
import ThaiDateInput from "@/components/hr/thai-date-input";

export type OvertimeRuleFormValues = {
  code: string;
  name: string;
  rateTypeId: string;
  multiplier: string;
  fixedAmount: string;
  effectiveFrom: string;
  effectiveTo: string;
};

const EMPTY: OvertimeRuleFormValues = {
  code: "",
  name: "",
  rateTypeId: "",
  multiplier: "1.5",
  fixedAmount: "",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: "",
};

export default function OvertimeRuleForm({
  mode,
  overtimeRuleId,
  initialValues,
  rateTypes,
  disabled = false,
  embedded = false,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  overtimeRuleId?: string;
  initialValues?: Partial<OvertimeRuleFormValues>;
  rateTypes: Array<{ id: string; label: string }>;
  disabled?: boolean;
  embedded?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<OvertimeRuleFormValues>({
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
      rateTypeId: requireSelect(values.rateTypeId) ?? "",
      multiplier:
        validatePositiveNumber(values.multiplier, { allowZero: false }) ?? "",
      fixedAmount:
        validatePositiveNumber(values.fixedAmount, { required: false }) ?? "",
      effectiveFrom: validateDate(values.effectiveFrom, true) ?? "",
      effectiveTo: validateDate(values.effectiveTo) ?? "",
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาตรวจสอบข้อมูล" });
      return;
    }

    const payload = {
      name: values.name.trim(),
      rateTypeId: values.rateTypeId,
      multiplier: Number(values.multiplier),
      fixedAmount: values.fixedAmount.trim()
        ? Number(values.fixedAmount)
        : null,
      effectiveFrom: values.effectiveFrom,
      effectiveTo: values.effectiveTo || null,
    };

    setSaving(true);
    const result =
      mode === "create"
        ? await submitHrJson(
            "/api/hr/overtime-rules",
            "POST",
            payload,
            "เพิ่มกฎ OT เรียบร้อยแล้ว",
          )
        : await submitHrJson(
            `/api/hr/overtime-rules/${overtimeRuleId}`,
            "PATCH",
            payload,
            "บันทึกกฎ OT เรียบร้อยแล้ว",
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
        <h2>{mode === "create" ? "เพิ่มกฎ OT ใหม่" : "แก้ไขกฎ OT"}</h2>
      )}
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <div className="form-grid">
        <Field id="ot-name" label="ชื่อกฎ OT" required error={errors.name}>
          <input
            {...fieldProps("ot-name", errors.name)}
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            placeholder="ค่าล่วงเวลาวันทำงานปกติ"
            disabled={busy}
          />
        </Field>

        <Field
          id="ot-rateTypeId"
          label="ประเภทอัตรา OT"
          required
          error={errors.rateTypeId}
        >
          <select
            {...fieldProps("ot-rateTypeId", errors.rateTypeId)}
            value={values.rateTypeId}
            onChange={(e) =>
              setValues({ ...values, rateTypeId: e.target.value })
            }
            disabled={busy}
          >
            <option value="">— เลือกประเภทอัตรา —</option>
            {rateTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="ot-multiplier"
          label="ตัวคูณ"
          required
          error={errors.multiplier}
          hint="เช่น 1.5 หรือ 3"
        >
          <input
            {...fieldProps("ot-multiplier", errors.multiplier)}
            type="number"
            step="0.001"
            min="0"
            value={values.multiplier}
            onChange={(e) =>
              setValues({ ...values, multiplier: e.target.value })
            }
            disabled={busy}
          />
        </Field>

        <Field
          id="ot-fixedAmount"
          label="เงินคงที่ (บาท)"
          error={errors.fixedAmount}
          hint="เว้นว่างได้"
        >
          <input
            {...fieldProps("ot-fixedAmount", errors.fixedAmount)}
            type="number"
            step="0.01"
            min="0"
            value={values.fixedAmount}
            onChange={(e) =>
              setValues({ ...values, fixedAmount: e.target.value })
            }
            disabled={busy}
          />
        </Field>

        <Field
          id="ot-effectiveFrom"
          label="เริ่มมีผล"
          required
          error={errors.effectiveFrom}
        >
          <ThaiDateInput
            {...fieldProps("ot-effectiveFrom", errors.effectiveFrom)}
            value={values.effectiveFrom}
            onChange={(iso) => setValues({ ...values, effectiveFrom: iso })}
            disabled={busy}
            required
          />
        </Field>

        <Field
          id="ot-effectiveTo"
          label="สิ้นสุด"
          error={errors.effectiveTo}
          hint="เว้นว่าง = ยังไม่กำหนด"
        >
          <ThaiDateInput
            {...fieldProps("ot-effectiveTo", errors.effectiveTo)}
            value={values.effectiveTo}
            onChange={(iso) => setValues({ ...values, effectiveTo: iso })}
            disabled={busy}
          />
        </Field>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy}
        >
          {saving ? "กำลังบันทึก…" : mode === "create" ? "เพิ่มกฎ OT" : "บันทึก"}
        </button>
        {onCancel || mode === "edit" ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (onCancel) onCancel();
              else router.push("/hr/settings/overtime-rules");
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
