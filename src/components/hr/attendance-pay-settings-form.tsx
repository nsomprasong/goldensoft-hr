"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import Field, { fieldProps } from "@/components/hr/field";
import { submitHrJson } from "@/components/hr/form-utils";
import type { PayrollDeductionSettingsRow } from "@/lib/hr/services/payroll-deduction-settings";

export default function AttendancePaySettingsForm({
  initial,
  canEdit,
}: {
  initial: PayrollDeductionSettingsRow;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    lateDeductionEnabled: initial.lateDeductionEnabled,
    lateBahtPerMinute: String(initial.lateBahtPerMinute),
    absenceDeductionEnabled: initial.absenceDeductionEnabled,
    absenceBahtPerDay: String(initial.absenceBahtPerDay),
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;

    const lateBahtPerMinute = Number(values.lateBahtPerMinute);
    const absenceBahtPerDay = Number(values.absenceBahtPerDay);

    if (
      !Number.isFinite(lateBahtPerMinute) ||
      !Number.isFinite(absenceBahtPerDay)
    ) {
      setFeedback({ kind: "error", message: "กรุณากรอกตัวเลขให้ถูกต้อง" });
      return;
    }

    setSaving(true);
    setFeedback({ kind: "info", message: "กำลังบันทึก…" });
    const result = await submitHrJson(
      "/api/hr/payroll/attendance-pay-settings",
      "PATCH",
      {
        lateDeductionEnabled: values.lateDeductionEnabled,
        lateBahtPerMinute,
        absenceDeductionEnabled: values.absenceDeductionEnabled,
        absenceBahtPerDay,
      },
      "บันทึกตั้งค่าหักสาย/ขาดงานเรียบร้อยแล้ว",
    );
    setSaving(false);

    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }

    setFeedback({ kind: "success", message: result.message });
    router.refresh();
  }

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      <form className="card" onSubmit={handleSubmit} noValidate>
        <p className="field-hint" style={{ marginBottom: "1rem" }}>
          ใช้ตอนประมวลผลเงินเดือน — ค่า OT ดึงจากคำขอ OT ที่อนุมัติแล้ว (ตั้งอัตราที่กฎ OT)
          ใส่ 0 เพื่อคำนวณอัตโนมัติจากค่าจ้างรายวัน
        </p>

        <div className="form-grid">
          <Field id="late-enabled" label="หักสาย" full>
            <label className="checkbox-row">
              <input
                id="late-enabled"
                type="checkbox"
                checked={values.lateDeductionEnabled}
                disabled={!canEdit || saving}
                onChange={(e) =>
                  setValues({
                    ...values,
                    lateDeductionEnabled: e.target.checked,
                  })
                }
              />
              <span>เปิดใช้หักสายจากนาทีมาสายในบันทึกเวลา</span>
            </label>
          </Field>

          <Field id="late-rate" label="หักสาย (บาท/นาที)" required>
            <input
              {...fieldProps("late-rate")}
              type="number"
              min={0}
              step="0.01"
              value={values.lateBahtPerMinute}
              disabled={!canEdit || saving || !values.lateDeductionEnabled}
              onChange={(e) =>
                setValues({ ...values, lateBahtPerMinute: e.target.value })
              }
            />
            <span className="field-hint">
              0 = คำนวณจากค่าจ้างรายวัน ÷ 8 ชม. ÷ 60 นาที
            </span>
          </Field>

          <Field id="absence-enabled" label="หักขาดงาน" full>
            <label className="checkbox-row">
              <input
                id="absence-enabled"
                type="checkbox"
                checked={values.absenceDeductionEnabled}
                disabled={!canEdit || saving}
                onChange={(e) =>
                  setValues({
                    ...values,
                    absenceDeductionEnabled: e.target.checked,
                  })
                }
              />
              <span>เปิดใช้หักขาดงานจากวันที่สถานะ ABSENT</span>
            </label>
          </Field>

          <Field id="absence-rate" label="หักขาดงาน (บาท/วัน)" required>
            <input
              {...fieldProps("absence-rate")}
              type="number"
              min={0}
              step="1"
              value={values.absenceBahtPerDay}
              disabled={
                !canEdit || saving || !values.absenceDeductionEnabled
              }
              onChange={(e) =>
                setValues({ ...values, absenceBahtPerDay: e.target.value })
              }
            />
            <span className="field-hint">
              0 = หัก 1 วันค่าจ้าง (รายเดือน ÷ 30 / รายวันตามอัตรา / รายชม. × 8)
            </span>
          </Field>
        </div>

        {canEdit ? (
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        ) : (
          <p className="field-hint">คุณมีสิทธิ์ดูการตั้งค่าเท่านั้น</p>
        )}
      </form>
    </>
  );
}
