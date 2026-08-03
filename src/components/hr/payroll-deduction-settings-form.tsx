"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import Field, { fieldProps } from "@/components/hr/field";
import { submitHrJson } from "@/components/hr/form-utils";
import type { PayrollDeductionSettingsRow } from "@/lib/hr/services/payroll-deduction-settings";
import { isTaxMethod, type TaxMethod } from "@/lib/hr/thai-tax";

function numOr(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseNonNeg(raw: string, label: string): number | { error: string } {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return { error: `กรุณากรอก${label}` };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return { error: `${label}ต้องเป็นตัวเลขที่ถูกต้อง` };
  }
  return n;
}

export default function PayrollDeductionSettingsForm({
  initial,
  canEdit,
}: {
  initial: PayrollDeductionSettingsRow;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    taxEnabled: Boolean(initial.taxEnabled),
    taxMethod: (isTaxMethod(initial.taxMethod)
      ? initial.taxMethod
      : "FLAT") as TaxMethod,
    taxRatePercent: String(numOr(initial.taxRatePercent, 3)),
    taxPersonalAllowance: String(numOr(initial.taxPersonalAllowance, 60_000)),
    taxExpenseDeductionEnabled: initial.taxExpenseDeductionEnabled !== false,
    socialSecurityEnabled: Boolean(initial.socialSecurityEnabled),
    socialSecurityRatePercent: String(
      numOr(initial.socialSecurityRatePercent, 5),
    ),
    socialSecurityMaxAmount: String(numOr(initial.socialSecurityMaxAmount, 750)),
    socialSecurityWageBaseMin: String(
      numOr(initial.socialSecurityWageBaseMin, 1_650),
    ),
    socialSecurityWageBaseMax: String(
      numOr(initial.socialSecurityWageBaseMax, 15_000),
    ),
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;

    const progressive = values.taxMethod === "PROGRESSIVE";

    const taxRatePercent = progressive
      ? numOr(values.taxRatePercent, 0)
      : parseNonNeg(values.taxRatePercent, "อัตราภาษี");
    if (typeof taxRatePercent === "object") {
      setFeedback({ kind: "error", message: taxRatePercent.error });
      return;
    }

    const taxPersonalAllowance = progressive
      ? parseNonNeg(values.taxPersonalAllowance, "ลดหย่อนส่วนตัว")
      : numOr(values.taxPersonalAllowance, 60_000);
    if (typeof taxPersonalAllowance === "object") {
      setFeedback({ kind: "error", message: taxPersonalAllowance.error });
      return;
    }

    const socialSecurityRatePercent = parseNonNeg(
      values.socialSecurityRatePercent,
      "อัตราประกันสังคม",
    );
    if (typeof socialSecurityRatePercent === "object") {
      setFeedback({ kind: "error", message: socialSecurityRatePercent.error });
      return;
    }

    const socialSecurityMaxAmount = parseNonNeg(
      values.socialSecurityMaxAmount,
      "เพดานเงินหักสูงสุด",
    );
    if (typeof socialSecurityMaxAmount === "object") {
      setFeedback({ kind: "error", message: socialSecurityMaxAmount.error });
      return;
    }

    const socialSecurityWageBaseMin = parseNonNeg(
      values.socialSecurityWageBaseMin,
      "ฐานค่าจ้างขั้นต่ำ",
    );
    if (typeof socialSecurityWageBaseMin === "object") {
      setFeedback({ kind: "error", message: socialSecurityWageBaseMin.error });
      return;
    }

    const socialSecurityWageBaseMax = parseNonNeg(
      values.socialSecurityWageBaseMax,
      "ฐานค่าจ้างสูงสุด",
    );
    if (typeof socialSecurityWageBaseMax === "object") {
      setFeedback({ kind: "error", message: socialSecurityWageBaseMax.error });
      return;
    }

    if (socialSecurityWageBaseMax < socialSecurityWageBaseMin) {
      setFeedback({
        kind: "error",
        message: "เพดานฐานประกันสังคมต้องไม่ต่ำกว่าฐานขั้นต่ำ",
      });
      return;
    }

    setSaving(true);
    setFeedback({ kind: "info", message: "กำลังบันทึก…" });
    const result = await submitHrJson(
      "/api/hr/payroll/deduction-settings",
      "PATCH",
      {
        taxEnabled: values.taxEnabled,
        taxMethod: values.taxMethod,
        taxRatePercent,
        taxPersonalAllowance,
        taxExpenseDeductionEnabled: values.taxExpenseDeductionEnabled,
        socialSecurityEnabled: values.socialSecurityEnabled,
        socialSecurityRatePercent,
        socialSecurityMaxAmount,
        socialSecurityWageBaseMin,
        socialSecurityWageBaseMax,
      },
      "บันทึกภาษี/ประกันสังคมเรียบร้อยแล้ว",
    );
    setSaving(false);

    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }

    setFeedback({ kind: "success", message: result.message });
    router.refresh();
  }

  const progressive = values.taxMethod === "PROGRESSIVE";
  const busy = !canEdit || saving;

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      <form className="hr-settings-form" onSubmit={handleSubmit} noValidate>
        <p className="hr-settings-form-lead">
          ประมาณการหัก ณ ที่จ่ายสำหรับเงินเดือน
        </p>

        <section className="hr-settings-panel">
          <header className="hr-leave-panel-head">
            <h2>ภาษี</h2>
            <p>หัก ณ ที่จ่าย</p>
          </header>
          <div className="hr-settings-inner-card">
            <div className="form-grid">
              <Field id="tax-enabled" label="หักภาษี ณ ที่จ่าย" full>
                <label className="checkbox-row">
                  <input
                    id="tax-enabled"
                    type="checkbox"
                    checked={values.taxEnabled}
                    disabled={busy}
                    onChange={(e) =>
                      setValues({ ...values, taxEnabled: e.target.checked })
                    }
                  />
                  <span>เปิดใช้</span>
                </label>
              </Field>

              <Field id="tax-method" label="วิธีคิดภาษี" full required>
                <select
                  {...fieldProps("tax-method")}
                  value={values.taxMethod}
                  disabled={busy || !values.taxEnabled}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      taxMethod: e.target.value as TaxMethod,
                    })
                  }
                >
                  <option value="FLAT">อัตราคงที่ (%)</option>
                  <option value="PROGRESSIVE">ขั้นบันได (ประมาณการ)</option>
                </select>
              </Field>

              {!progressive ? (
                <Field id="tax-rate" label="อัตราภาษี (%)" required>
                  <input
                    {...fieldProps("tax-rate")}
                    type="number"
                    min={0}
                    step="0.01"
                    value={values.taxRatePercent}
                    disabled={busy || !values.taxEnabled}
                    onChange={(e) =>
                      setValues({ ...values, taxRatePercent: e.target.value })
                    }
                  />
                </Field>
              ) : (
                <>
                  <Field
                    id="tax-allowance"
                    label="ลดหย่อนส่วนตัวรายปี (บาท)"
                    required
                  >
                    <input
                      {...fieldProps("tax-allowance")}
                      type="number"
                      min={0}
                      step="1"
                      value={values.taxPersonalAllowance}
                      disabled={busy || !values.taxEnabled}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          taxPersonalAllowance: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field id="tax-expense" label="หักค่าใช้จ่าย 50%" full>
                    <label className="checkbox-row">
                      <input
                        id="tax-expense"
                        type="checkbox"
                        checked={values.taxExpenseDeductionEnabled}
                        disabled={busy || !values.taxEnabled}
                        onChange={(e) =>
                          setValues({
                            ...values,
                            taxExpenseDeductionEnabled: e.target.checked,
                          })
                        }
                      />
                      <span>ใช้ 50% ของรายได้ (เพดาน 100,000 บาท/ปี)</span>
                    </label>
                  </Field>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="hr-settings-panel">
          <header className="hr-leave-panel-head">
            <h2>ประกันสังคม</h2>
            <p>อัตราและฐานค่าจ้าง</p>
          </header>
          <div className="hr-settings-inner-card">
            <div className="form-grid">
              <Field id="sso-enabled" label="ประกันสังคม" full>
                <label className="checkbox-row">
                  <input
                    id="sso-enabled"
                    type="checkbox"
                    checked={values.socialSecurityEnabled}
                    disabled={busy}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        socialSecurityEnabled: e.target.checked,
                      })
                    }
                  />
                  <span>เปิดใช้</span>
                </label>
              </Field>

              <Field id="sso-rate" label="อัตรา (%)" required>
                <input
                  {...fieldProps("sso-rate")}
                  type="number"
                  min={0}
                  step="0.01"
                  value={values.socialSecurityRatePercent}
                  disabled={busy || !values.socialSecurityEnabled}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      socialSecurityRatePercent: e.target.value,
                    })
                  }
                />
              </Field>

              <Field id="sso-base-min" label="ฐานขั้นต่ำ (บาท)" required>
                <input
                  {...fieldProps("sso-base-min")}
                  type="number"
                  min={0}
                  step="1"
                  value={values.socialSecurityWageBaseMin}
                  disabled={busy || !values.socialSecurityEnabled}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      socialSecurityWageBaseMin: e.target.value,
                    })
                  }
                />
              </Field>

              <Field id="sso-base-max" label="ฐานสูงสุด (บาท)" required>
                <input
                  {...fieldProps("sso-base-max")}
                  type="number"
                  min={0}
                  step="1"
                  value={values.socialSecurityWageBaseMax}
                  disabled={busy || !values.socialSecurityEnabled}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      socialSecurityWageBaseMax: e.target.value,
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
                  disabled={busy || !values.socialSecurityEnabled}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      socialSecurityMaxAmount: e.target.value,
                    })
                  }
                />
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
