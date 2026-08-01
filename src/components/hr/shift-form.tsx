"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import {
  compact,
  firstError,
  normalizeTime,
  requireSelect,
  requireText,
  submitHrJson,
  validatePositiveNumber,
  validateTime,
  type FieldErrors,
} from "@/components/hr/form-utils";

export type ShiftFormValues = {
  name: string;
  shiftTypeId: string;
  branchId: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  graceLateMinutes: string;
  graceEarlyLeaveMinutes: string;
  overtimeAfterMinutes: string;
  crossesMidnight: boolean;
};

const EMPTY: ShiftFormValues = {
  name: "",
  shiftTypeId: "",
  branchId: "",
  startTime: "08:00",
  endTime: "17:00",
  breakMinutes: "60",
  graceLateMinutes: "5",
  graceEarlyLeaveMinutes: "5",
  overtimeAfterMinutes: "",
  crossesMidnight: false,
};

export default function ShiftForm({
  mode,
  shiftId,
  initialValues,
  shiftTypes,
  branches,
  disabled = false,
  embedded = false,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  shiftId?: string;
  initialValues?: Partial<ShiftFormValues>;
  shiftTypes: Array<{ id: string; label: string }>;
  branches: Array<{ id: string; label: string }>;
  disabled?: boolean;
  /** Hide outer card chrome when rendered inside an overlay. */
  embedded?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ShiftFormValues>({
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
      shiftTypeId: requireSelect(values.shiftTypeId) ?? "",
      startTime: validateTime(values.startTime) ?? "",
      endTime: validateTime(values.endTime) ?? "",
      breakMinutes: validatePositiveNumber(values.breakMinutes) ?? "",
      graceLateMinutes: validatePositiveNumber(values.graceLateMinutes) ?? "",
      graceEarlyLeaveMinutes:
        validatePositiveNumber(values.graceEarlyLeaveMinutes) ?? "",
      overtimeAfterMinutes:
        validatePositiveNumber(values.overtimeAfterMinutes, {
          required: false,
        }) ?? "",
    });

    if (
      !nextErrors.endTime &&
      !values.crossesMidnight &&
      values.endTime <= values.startTime
    ) {
      nextErrors.endTime = "เวลาเลิกงานต้องหลังเวลาเข้างาน หรือเลือกข้ามวัน";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาตรวจสอบข้อมูลที่ยังไม่ถูกต้อง" });
      return;
    }

    // Working minutes are derived server-side from the times and break.
    const payload = {
      name: values.name.trim(),
      shiftTypeId: values.shiftTypeId,
      branchId: values.branchId || null,
      startTime: normalizeTime(values.startTime),
      endTime: normalizeTime(values.endTime),
      breakMinutes: Number(values.breakMinutes),
      graceLateMinutes: Number(values.graceLateMinutes),
      graceEarlyLeaveMinutes: Number(values.graceEarlyLeaveMinutes),
      overtimeAfterMinutes: values.overtimeAfterMinutes
        ? Number(values.overtimeAfterMinutes)
        : null,
      crossesMidnight: values.crossesMidnight,
    };

    setSaving(true);
    const result =
      mode === "create"
        ? await submitHrJson(
            "/api/hr/shifts",
            "POST",
            payload,
            "เพิ่มกะงานเรียบร้อยแล้ว",
          )
        : await submitHrJson(
            `/api/hr/shifts/${shiftId}`,
            "PATCH",
            payload,
            "บันทึกกะงานเรียบร้อยแล้ว",
          );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fieldErrors);
      const fieldHint = firstError(result.fieldErrors);
      setFeedback({
        kind: "error",
        text: fieldHint ? `${result.message} (${fieldHint})` : result.message,
      });
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
        <h2>{mode === "create" ? "เพิ่มกะงานใหม่" : "แก้ไขกะงาน"}</h2>
      )}
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}
      {mode === "create" ? (
        <p className="muted" style={{ marginTop: 0 }}>
          รหัสกะจะถูกสร้างอัตโนมัติเมื่อบันทึก
        </p>
      ) : null}

      <div className="form-grid">
        <Field id="shift-name" label="ชื่อกะ" required error={errors.name}>
          <input
            {...fieldProps("shift-name", errors.name)}
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            placeholder="กะกลางวัน"
          />
        </Field>

        <Field
          id="shift-typeId"
          label="ประเภทกะ"
          required
          error={errors.shiftTypeId}
        >
          <select
            {...fieldProps("shift-typeId", errors.shiftTypeId)}
            value={values.shiftTypeId}
            onChange={(e) =>
              setValues({ ...values, shiftTypeId: e.target.value })
            }
          >
            <option value="">— เลือกประเภท —</option>
            {shiftTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="shift-branchId"
          label="สาขา"
          hint="ไม่เลือก = ใช้ได้ทุกสาขาในองค์กร"
        >
          <select
            {...fieldProps("shift-branchId")}
            value={values.branchId}
            onChange={(e) => setValues({ ...values, branchId: e.target.value })}
          >
            <option value="">— ทุกสาขา —</option>
            {branches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="shift-startTime"
          label="เวลาเข้างาน"
          required
          error={errors.startTime}
        >
          <input
            {...fieldProps("shift-startTime", errors.startTime)}
            type="time"
            value={values.startTime}
            onChange={(e) =>
              setValues({ ...values, startTime: e.target.value })
            }
          />
        </Field>

        <Field
          id="shift-endTime"
          label="เวลาเลิกงาน"
          required
          error={errors.endTime}
        >
          <input
            {...fieldProps("shift-endTime", errors.endTime)}
            type="time"
            value={values.endTime}
            onChange={(e) => setValues({ ...values, endTime: e.target.value })}
          />
        </Field>

        <Field
          id="shift-breakMinutes"
          label="เวลาพัก (นาที)"
          required
          error={errors.breakMinutes}
        >
          <input
            {...fieldProps("shift-breakMinutes", errors.breakMinutes)}
            type="number"
            min={0}
            value={values.breakMinutes}
            onChange={(e) =>
              setValues({ ...values, breakMinutes: e.target.value })
            }
          />
        </Field>

        <Field
          id="shift-graceLateMinutes"
          label="ผ่อนผันมาสาย (นาที)"
          required
          error={errors.graceLateMinutes}
        >
          <input
            {...fieldProps("shift-graceLateMinutes", errors.graceLateMinutes)}
            type="number"
            min={0}
            value={values.graceLateMinutes}
            onChange={(e) =>
              setValues({ ...values, graceLateMinutes: e.target.value })
            }
          />
        </Field>

        <Field
          id="shift-graceEarlyLeaveMinutes"
          label="ผ่อนผันออกก่อน (นาที)"
          required
          error={errors.graceEarlyLeaveMinutes}
        >
          <input
            {...fieldProps(
              "shift-graceEarlyLeaveMinutes",
              errors.graceEarlyLeaveMinutes,
            )}
            type="number"
            min={0}
            value={values.graceEarlyLeaveMinutes}
            onChange={(e) =>
              setValues({ ...values, graceEarlyLeaveMinutes: e.target.value })
            }
          />
        </Field>

        <Field
          id="shift-overtimeAfterMinutes"
          label="เริ่มคิด OT หลัง (นาที)"
          error={errors.overtimeAfterMinutes}
          hint="เว้นว่างได้หากไม่กำหนด"
        >
          <input
            {...fieldProps(
              "shift-overtimeAfterMinutes",
              errors.overtimeAfterMinutes,
            )}
            type="number"
            min={0}
            value={values.overtimeAfterMinutes}
            onChange={(e) =>
              setValues({ ...values, overtimeAfterMinutes: e.target.value })
            }
          />
        </Field>

        <div className="field">
          <div className="checkbox-row">
            <input
              id="shift-crossesMidnight"
              name="crossesMidnight"
              type="checkbox"
              checked={values.crossesMidnight}
              onChange={(e) =>
                setValues({ ...values, crossesMidnight: e.target.checked })
              }
            />
            <label htmlFor="shift-crossesMidnight">กะข้ามวัน</label>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || disabled}
        >
          {saving ? "กำลังบันทึก…" : mode === "create" ? "เพิ่มกะงาน" : "บันทึก"}
        </button>
        {onCancel || mode === "edit" ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (onCancel) onCancel();
              else router.push("/hr/settings/shifts");
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
