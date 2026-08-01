"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import Field, { fieldProps } from "@/components/hr/field";
import { submitHrJson } from "@/components/hr/form-utils";
import type { PayrollDeductionSettingsRow } from "@/lib/hr/services/payroll-deduction-settings";

export default function PayrollDeductionSettingsForm({
  initial,
  canEdit,
}: {
  initial: PayrollDeductionSettingsRow;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    taxEnabled: initial.taxEnabled,
    taxRatePercent: String(initial.taxRatePercent),
    socialSecurityEnabled: initial.socialSecurityEnabled,
    socialSecurityRatePercent: String(initial.socialSecurityRatePercent),
    socialSecurityMaxAmount: String(initial.socialSecurityMaxAmount),
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;

    const taxRatePercent = Number(values.taxRatePercent);
    const socialSecurityRatePercent = Number(values.socialSecurityRatePercent);
    const socialSecurityMaxAmount = Number(values.socialSecurityMaxAmount);

    if (
      !Number.isFinite(taxRatePercent) ||
      !Number.isFinite(socialSecurityRatePercent) ||
      !Number.isFinite(socialSecurityMaxAmount)
    ) {
      setFeedback({ kind: "error", message: "กรุณากรอกตัวเลขให้ถูกต้อง" });
      return;
    }

    setSaving(true);
    setFeedback({ kind: "info", message: "กำลังบันทึก…" });
    const result = await submitHrJson(
      "/api/hr/payroll/deduction-settings",
      "PATCH",
      {
        taxEnabled: values.taxEnabled,
        taxRatePercent,
        socialSecurityEnabled: values.socialSecurityEnabled,
        socialSecurityRatePercent,
        socialSecurityMaxAmount,
      },
      "บันทึกอัตราภาษีและประกันสังคมเรียบร้อยแล้ว",
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
          ประมาณการจากอัตราที่ตั้ง — ยังไม่ใช่สูตรกฎหมายฉบับสมบูรณ์
        </p>

        <div className="form-grid">
          <Field id="tax-enabled" label="หักภาษี ณ ที่จ่าย" full>
            <label className="checkbox-row">
              <input
                id="tax-enabled"
                type="checkbox"
                checked={values.taxEnabled}
                disabled={!canEdit || saving}
                onChange={(e) =>
                  setValues({ ...values, taxEnabled: e.target.checked })
                }
              />
              <span>เปิดใช้การหักภาษี</span>
            </label>
          </Field>

          <Field id="tax-rate" label="อัตราภาษี (%)" required>
            <input
              {...fieldProps("tax-rate")}
              type="number"
              min={0}
              step="0.01"
              value={values.taxRatePercent}
              disabled={!canEdit || saving || !values.taxEnabled}
              onChange={(e) =>
                setValues({ ...values, taxRatePercent: e.target.value })
              }
            />
          </Field>

          <Field id="sso-enabled" label="ประกันสังคม" full>
            <label className="checkbox-row">
              <input
                id="sso-enabled"
                type="checkbox"
                checked={values.socialSecurityEnabled}
                disabled={!canEdit || saving}
                onChange={(e) =>
                  setValues({
                    ...values,
                    socialSecurityEnabled: e.target.checked,
                  })
                }
              />
              <span>เปิดใช้การหักประกันสังคม</span>
            </label>
          </Field>

          <Field id="sso-rate" label="อัตราประกันสังคม (%)" required>
            <input
              {...fieldProps("sso-rate")}
              type="number"
              min={0}
              step="0.01"
              value={values.socialSecurityRatePercent}
              disabled={
                !canEdit || saving || !values.socialSecurityEnabled
              }
              onChange={(e) =>
                setValues({
                  ...values,
                  socialSecurityRatePercent: e.target.value,
                })
              }
            />
          </Field>

          <Field id="sso-max" label="เพดานหักสูงสุด (บาท)" required>
            <input
              {...fieldProps("sso-max")}
              type="number"
              min={0}
              step="1"
              value={values.socialSecurityMaxAmount}
              disabled={
                !canEdit || saving || !values.socialSecurityEnabled
              }
              onChange={(e) =>
                setValues({
                  ...values,
                  socialSecurityMaxAmount: e.target.value,
                })
              }
            />
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
