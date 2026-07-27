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
      nameTh: requireText(values.nameTh) ?? "",
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาตรวจสอบข้อมูลที่ยังไม่ถูกต้อง" });
      return;
    }

    // The tenant-scoped code is immutable, so PATCH never sends it.
    // On create the server allocates POS-#### automatically.
    // nameEn is mirrored from nameTh on the server.
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

    setFeedback({ kind: "success", text: result.message });
    if (mode === "create") setValues(EMPTY);
    router.refresh();
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h2>{mode === "create" ? "เพิ่มตำแหน่งใหม่" : "แก้ไขตำแหน่ง"}</h2>
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <div className="form-grid">
        {mode === "edit" ? (
          <Field
            id="pos-code"
            label="รหัสตำแหน่ง"
            hint="ระบบสร้างให้อัตโนมัติ และแก้ไขไม่ได้"
          >
            <input
              {...fieldProps("pos-code")}
              value={values.code}
              readOnly
            />
          </Field>
        ) : (
          <p className="muted" style={{ gridColumn: "1 / -1", margin: 0 }}>
            รหัสตำแหน่งจะถูกสร้างอัตโนมัติเมื่อบันทึก
          </p>
        )}

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
            placeholder="พิมพ์ได้ทั้งไทยและอังกฤษ"
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
