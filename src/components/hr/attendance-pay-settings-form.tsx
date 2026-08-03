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

  const busy = !canEdit || saving;

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      <form className="hr-settings-form" onSubmit={handleSubmit} noValidate>
        <p className="hr-settings-form-lead">
          ใช้ตอนประมวลผลเงินเดือน · ใส่ 0 เพื่อคำนวณอัตโนมัติจากค่าจ้าง
        </p>

        <section className="hr-settings-panel">
          <header className="hr-leave-panel-head">
            <h2>หักสาย</h2>
            <p>จากนาทีมาสายในบันทึกเวลา</p>
          </header>
          <div className="hr-settings-inner-card">
            <div className="form-grid">
              <Field id="late-enabled" label="หักสาย" full>
                <label className="checkbox-row">
                  <input
                    id="late-enabled"
                    type="checkbox"
                    checked={values.lateDeductionEnabled}
                    disabled={busy}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        lateDeductionEnabled: e.target.checked,
                      })
                    }
                  />
                  <span>เปิดใช้</span>
                </label>
              </Field>

              <Field id="late-rate" label="บาท/นาที" required>
                <input
                  {...fieldProps("late-rate")}
                  type="number"
                  min={0}
                  step="0.01"
                  value={values.lateBahtPerMinute}
                  disabled={busy || !values.lateDeductionEnabled}
                  onChange={(e) =>
                    setValues({ ...values, lateBahtPerMinute: e.target.value })
                  }
                />
                <span className="field-hint">
                  0 = ค่าจ้างรายวัน ÷ 8 ชม. ÷ 60 นาที
                </span>
              </Field>
            </div>
          </div>
        </section>

        <section className="hr-settings-panel">
          <header className="hr-leave-panel-head">
            <h2>หักขาดงาน</h2>
            <p>จากวันที่สถานะขาดงาน</p>
          </header>
          <div className="hr-settings-inner-card">
            <div className="form-grid">
              <Field id="absence-enabled" label="หักขาดงาน" full>
                <label className="checkbox-row">
                  <input
                    id="absence-enabled"
                    type="checkbox"
                    checked={values.absenceDeductionEnabled}
                    disabled={busy}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        absenceDeductionEnabled: e.target.checked,
                      })
                    }
                  />
                  <span>เปิดใช้</span>
                </label>
              </Field>

              <Field id="absence-rate" label="บาท/วัน" required>
                <input
                  {...fieldProps("absence-rate")}
                  type="number"
                  min={0}
                  step="1"
                  value={values.absenceBahtPerDay}
                  disabled={busy || !values.absenceDeductionEnabled}
                  onChange={(e) =>
                    setValues({ ...values, absenceBahtPerDay: e.target.value })
                  }
                />
                <span className="field-hint">
                  0 = หัก 1 วันค่าจ้าง
                </span>
              </Field>
            </div>
          </div>
        </section>

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
