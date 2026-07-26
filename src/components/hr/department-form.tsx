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

export type DepartmentFormValues = {
  code: string;
  nameTh: string;
  nameEn: string;
  description: string;
};

const EMPTY: DepartmentFormValues = {
  code: "",
  nameTh: "",
  nameEn: "",
  description: "",
};

export default function DepartmentForm({
  mode,
  departmentId,
  initialValues,
  disabled = false,
  onDone,
}: {
  mode: "create" | "edit";
  departmentId?: string;
  initialValues?: Partial<DepartmentFormValues>;
  disabled?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<DepartmentFormValues>({
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
      description: values.description.trim() || null,
    };

    setSaving(true);
    const result =
      mode === "create"
        ? await submitHrJson(
            "/api/hr/departments",
            "POST",
            { ...payload, code: values.code.trim() },
            "เพิ่มแผนกเรียบร้อยแล้ว",
          )
        : await submitHrJson(
            `/api/hr/departments/${departmentId}`,
            "PATCH",
            payload,
            "บันทึกแผนกเรียบร้อยแล้ว",
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
    onDone?.();
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h2>{mode === "create" ? "เพิ่มแผนกใหม่" : "แก้ไขแผนก"}</h2>
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <div className="form-grid">
        <Field
          id="dept-code"
          label="รหัสแผนก"
          required
          error={errors.code}
          hint={mode === "edit" ? "รหัสแก้ไขไม่ได้" : undefined}
        >
          <input
            {...fieldProps("dept-code", errors.code)}
            value={values.code}
            onChange={(e) => setValues({ ...values, code: e.target.value })}
            placeholder="HR"
            readOnly={mode === "edit"}
          />
        </Field>

        <Field id="dept-nameTh" label="ชื่อแผนก (ไทย)" required error={errors.nameTh}>
          <input
            {...fieldProps("dept-nameTh", errors.nameTh)}
            value={values.nameTh}
            onChange={(e) => setValues({ ...values, nameTh: e.target.value })}
          />
        </Field>

        <Field
          id="dept-nameEn"
          label="ชื่อแผนก (อังกฤษ)"
          required
          error={errors.nameEn}
        >
          <input
            {...fieldProps("dept-nameEn", errors.nameEn)}
            value={values.nameEn}
            onChange={(e) => setValues({ ...values, nameEn: e.target.value })}
          />
        </Field>

        <Field id="dept-description" label="คำอธิบาย" full>
          <textarea
            {...fieldProps("dept-description")}
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
          {saving ? "กำลังบันทึก…" : mode === "create" ? "เพิ่มแผนก" : "บันทึก"}
        </button>
        {mode === "edit" ? (
          <button
            type="button"
            className="btn"
            onClick={() => router.push("/settings/departments")}
            disabled={saving}
          >
            ยกเลิก
          </button>
        ) : null}
      </div>
    </form>
  );
}
