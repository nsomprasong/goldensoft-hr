"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import {
  compact,
  requireText,
  submitHrJson,
  validateCode,
  type FieldErrors,
} from "@/components/hr/form-utils";

export type PositionFormValues = {
  code: string;
  nameTh: string;
  nameEn: string;
  departmentId: string;
  description: string;
};

const EMPTY: PositionFormValues = {
  code: "",
  nameTh: "",
  nameEn: "",
  departmentId: "",
  description: "",
};

export default function PositionForm({
  mode,
  positionId,
  initialValues,
  departments,
  disabled = false,
}: {
  mode: "create" | "edit";
  positionId?: string;
  initialValues?: Partial<PositionFormValues>;
  departments: Array<{ id: string; label: string }>;
  disabled?: boolean;
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
      code: mode === "create" ? (validateCode(values.code) ?? "") : "",
      nameTh: requireText(values.nameTh) ?? "",
      nameEn: requireText(values.nameEn) ?? "",
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาตรวจสอบข้อมูลที่ยังไม่ถูกต้อง" });
      return;
    }

    // The tenant-scoped code is immutable, so PATCH never sends it.
    const payload = {
      nameTh: values.nameTh.trim(),
      nameEn: values.nameEn.trim(),
      departmentId: values.departmentId || null,
      description: values.description.trim() || null,
    };

    setSaving(true);
    const result =
      mode === "create"
        ? await submitHrJson(
            "/api/hr/positions",
            "POST",
            { ...payload, code: values.code.trim() },
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

    setFeedback({ kind: "success", text: result.message });
    if (mode === "create") setValues(EMPTY);
    router.refresh();
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h2>{mode === "create" ? "เพิ่มตำแหน่งใหม่" : "แก้ไขตำแหน่ง"}</h2>
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <div className="form-grid">
        <Field
          id="pos-code"
          label="รหัสตำแหน่ง"
          required
          error={errors.code}
          hint={mode === "edit" ? "รหัสแก้ไขไม่ได้" : undefined}
        >
          <input
            {...fieldProps("pos-code", errors.code)}
            value={values.code}
            onChange={(e) => setValues({ ...values, code: e.target.value })}
            placeholder="STAFF"
            readOnly={mode === "edit"}
          />
        </Field>

        <Field id="pos-nameTh" label="ชื่อตำแหน่ง (ไทย)" required error={errors.nameTh}>
          <input
            {...fieldProps("pos-nameTh", errors.nameTh)}
            value={values.nameTh}
            onChange={(e) => setValues({ ...values, nameTh: e.target.value })}
          />
        </Field>

        <Field
          id="pos-nameEn"
          label="ชื่อตำแหน่ง (อังกฤษ)"
          required
          error={errors.nameEn}
        >
          <input
            {...fieldProps("pos-nameEn", errors.nameEn)}
            value={values.nameEn}
            onChange={(e) => setValues({ ...values, nameEn: e.target.value })}
          />
        </Field>

        <Field id="pos-departmentId" label="สังกัดแผนก">
          <select
            {...fieldProps("pos-departmentId")}
            value={values.departmentId}
            onChange={(e) =>
              setValues({ ...values, departmentId: e.target.value })
            }
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
        {mode === "edit" ? (
          <button
            type="button"
            className="btn"
            onClick={() => router.push("/hr/settings/positions")}
            disabled={saving}
          >
            ยกเลิก
          </button>
        ) : null}
      </div>
    </form>
  );
}
