"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

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
  scope: "ORGANIZATION" | "BRANCH";
  defaultRoleId: string;
};

const EMPTY: PositionFormValues = {
  code: "",
  nameTh: "",
  departmentId: "",
  description: "",
  scope: "ORGANIZATION",
  defaultRoleId: "",
};

export default function PositionForm({
  mode,
  positionId,
  initialValues,
  departments,
  roles,
  disabled = false,
  embedded = false,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  positionId?: string;
  initialValues?: Partial<PositionFormValues>;
  departments: Array<{ id: string; label: string }>;
  roles: Array<{ id: string; name: string; description: string | null; typeLabel: string; permissionCount: number }>;
  disabled?: boolean;
  embedded?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<PositionFormValues>({
    ...EMPTY,
    ...initialValues,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirmImpact, setConfirmImpact] = useState<number | null>(null);
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
      scope: values.scope,
      defaultRoleId: values.defaultRoleId || null,
    };

    setSaving(true);
    if (mode === "edit" && initialValues?.defaultRoleId !== values.defaultRoleId && confirmImpact === null) {
      const response = await fetch(`/api/hr/positions/${positionId}/role`);
      const impact = response.ok ? (await response.json() as { affectedEmployees?: number }).affectedEmployees ?? 0 : 0;
      if (impact > 0) { setSaving(false); setConfirmImpact(impact); return; }
    }
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
    if (mode === "edit" && initialValues?.defaultRoleId !== values.defaultRoleId) {
      const roleResult = await submitHrJson(`/api/hr/positions/${positionId}/role`, "PUT", { organizationRoleId: values.defaultRoleId || null }, "เปลี่ยนบทบาทหลักเรียบร้อยแล้ว");
      if (!roleResult.ok) { setFeedback({ kind: "error", text: roleResult.message }); return; }
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
      ref={formRef}
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
      <p className="muted">ตำแหน่งใช้ระบุหน้าที่งานของพนักงาน ส่วนบทบาทใช้กำหนดว่าพนักงานสามารถเข้าถึงและจัดการข้อมูลใดในระบบได้</p>

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

        <Field id="pos-scope" label="ขอบเขตการใช้งาน" required>
          <select
            {...fieldProps("pos-scope")}
            value={values.scope}
            onChange={(e) => setValues({ ...values, scope: e.target.value as PositionFormValues["scope"] })}
            disabled={saving || disabled}
          >
            <option value="ORGANIZATION">ใช้ทุกสาขาในองค์กร</option>
            <option value="BRANCH">ใช้เฉพาะสาขาที่เลือกอยู่</option>
          </select>
        </Field>

        <Field id="pos-defaultRoleId" label="บทบาทหลัก" full>
          <select {...fieldProps("pos-defaultRoleId")} value={values.defaultRoleId} onChange={(e) => setValues({ ...values, defaultRoleId: e.target.value })} disabled={saving || disabled}>
            <option value="">— ยังไม่ได้กำหนดบทบาท —</option>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name} · {role.typeLabel} · {role.permissionCount} สิทธิ์</option>)}
          </select>
          {values.defaultRoleId ? <span className="field-hint">{roles.find((role) => role.id === values.defaultRoleId)?.description || "ใช้เป็นบทบาทที่แนะนำเมื่อเพิ่มหรือย้ายตำแหน่งพนักงาน"}</span> : null}
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
      {confirmImpact !== null ? (
        <div className="hr-overlay" role="presentation">
          <div className="hr-overlay-backdrop" />
          <div className="hr-overlay-panel" role="dialog" aria-modal="true" aria-label="ยืนยันการเปลี่ยนบทบาทหลัก">
            <div className="hr-overlay-body">
              <h3>ยืนยันการเปลี่ยนบทบาทหลัก</h3>
              <p>ตำแหน่งนี้มีพนักงานใช้งานอยู่ {confirmImpact} คน การเปลี่ยนบทบาทหลักจะใช้เป็นค่าแนะนำครั้งถัดไป และจะไม่เปลี่ยนบทบาทของพนักงานเดิม</p>
              <div className="form-actions">
                <button type="button" className="btn btn-primary" onClick={() => { setConfirmImpact(0); requestAnimationFrame(() => formRef.current?.requestSubmit()); }}>เปลี่ยนบทบาทหลัก โดยไม่เปลี่ยนพนักงานเดิม</button>
                <button type="button" className="btn" onClick={() => setConfirmImpact(null)}>ยกเลิก</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
