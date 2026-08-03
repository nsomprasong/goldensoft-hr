"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import {
  compact,
  requireText,
  submitHrJson,
  type FieldErrors,
} from "@/components/hr/form-utils";

export type PositionFormValues = {
  code: string;
  nameTh: string;
  departmentId: string;
  description: string;
};

const EMPTY: PositionFormValues = {
  code: "",
  nameTh: "",
  departmentId: "",
  description: "",
};

export default function PositionForm({
  mode,
  positionId,
  initialValues,
  departments,
  disabled = false,
  embedded = false,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  positionId?: string;
  initialValues?: Partial<PositionFormValues>;
  departments: Array<{ id: string; label: string }>;
  disabled?: boolean;
  embedded?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<PositionFormValues>({
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
      nameTh: requireText(values.nameTh) ?? "",
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาตรวจสอบข้อมูล" });
      return;
    }

    const payload = {
      nameTh: values.nameTh.trim(),
      departmentId: values.departmentId || null,
      description: values.description.trim() || null,
    };

    setSaving(true);
    const result =
      mode === "create"
        ? await submitHrJson(
            "/api/hr/positions",
            "POST",
            payload,
            "เพิ่มตำแหน่งเรียบร้อยแล้ว",
          )
        : await submitHrJson(
            `/api/hr/positions/${positionId}`,
            "PATCH",
            payload,
            "บันทึกตำแหน่งเรียบร้อยแล้ว",
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

  return (
    <form
      className={embedded ? "hr-shift-form-embedded" : "card"}
      onSubmit={handleSubmit}
      noValidate
    >
      {embedded ? null : (
        <h2>{mode === "create" ? "เพิ่มตำแหน่งใหม่" : "แก้ไขตำแหน่ง"}</h2>
      )}
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}
      {mode === "create" ? (
        <p className="muted" style={{ marginTop: 0 }}>
          รหัสตำแหน่งจะถูกสร้างอัตโนมัติเมื่อบันทึก
        </p>
      ) : null}

      <div className="form-grid">
        <Field
          id="pos-nameTh"
          label="ชื่อตำแหน่ง"
          required
          error={errors.nameTh}
        >
          <input
            {...fieldProps("pos-nameTh", errors.nameTh)}
            value={values.nameTh}
            onChange={(e) => setValues({ ...values, nameTh: e.target.value })}
            placeholder="ชื่อตำแหน่ง"
            disabled={saving || disabled}
          />
        </Field>

        <Field id="pos-departmentId" label="สังกัดแผนก">
          <select
            {...fieldProps("pos-departmentId")}
            value={values.departmentId}
            onChange={(e) =>
              setValues({ ...values, departmentId: e.target.value })
            }
            disabled={saving || disabled}
          >
            <option value="">— ไม่ระบุ —</option>
            {departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="pos-description" label="คำอธิบาย" full>
          <textarea
            {...fieldProps("pos-description")}
            value={values.description}
            onChange={(e) =>
              setValues({ ...values, description: e.target.value })
            }
            disabled={saving || disabled}
          />
        </Field>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || disabled}
        >
          {saving ? "กำลังบันทึก…" : mode === "create" ? "เพิ่มตำแหน่ง" : "บันทึก"}
        </button>
        {onCancel || mode === "edit" ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (onCancel) onCancel();
              else router.push("/hr/settings/positions");
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
