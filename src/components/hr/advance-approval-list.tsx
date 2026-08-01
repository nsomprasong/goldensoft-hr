"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import EmployeeAvatar from "@/components/hr/employee-avatar";
import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import Field, { fieldProps } from "@/components/hr/field";
import { formatThb } from "@/lib/hr/money";
import type {
  DisbursementMode,
  SalaryAdvanceRow,
} from "@/lib/hr/services/salary-advances";

export default function AdvanceApprovalList({
  rows,
  canApprove,
  focusId = null,
}: {
  rows: SalaryAdvanceRow[];
  canApprove: boolean;
  focusId?: string | null;
}) {
  const router = useRouter();
  const titleId = useId();
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [reviewing, setReviewing] = useState<SalaryAdvanceRow | null>(null);
  const [mode, setMode] = useState<DisbursementMode>("WITH_SALARY");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function openReview(row: SalaryAdvanceRow) {
    setMode(
      row.disbursementMode === "CASH_ALREADY" ||
        row.disbursementMode === "WITH_SALARY"
        ? row.disbursementMode
        : "WITH_SALARY",
    );
    setSlipFile(null);
    setReviewing(row);
  }

  async function reject(row: SalaryAdvanceRow) {
    setSaving(true);
    try {
      const response = await fetch(`/api/hr/advances/${row.id}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "reject" }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: payload?.error?.message ?? "ไม่อนุมัติไม่สำเร็จ",
        });
        return;
      }
      setFeedback({ kind: "success", message: "ไม่อนุมัติคำขอแล้ว" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function approve(event: React.FormEvent) {
    event.preventDefault();
    if (!reviewing) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.set("action", "approve");
      form.set("disbursementMode", mode);
      form.set("installmentCount", String(reviewing.installmentCount));
      if (reviewing.startPayrollPeriodId) {
        form.set("startPayrollPeriodId", reviewing.startPayrollPeriodId);
      }
      if (slipFile) form.set("transferSlip", slipFile);

      const response = await fetch(`/api/hr/advances/${reviewing.id}/review`, {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: payload?.error?.message ?? "อนุมัติไม่สำเร็จ",
        });
        return;
      }
      setFeedback({ kind: "success", message: "อนุมัติเบิกล่วงหน้าแล้ว" });
      setReviewing(null);
      setSlipFile(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (rows.length === 0) {
    return <p className="empty">ยังไม่มีคำขอเบิกล่วงหน้าที่รออนุมัติ</p>;
  }

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />
      <div className="hr-card-grid">
        {rows.map((row) => (
          <article
            key={row.id}
            id={`approval-${row.id}`}
            className={`card hr-entity-card${
              focusId === row.id ? " hr-approval-focus" : ""
            }`}
          >
            <div className="hr-entity-card-top">
              <div className="hr-employee-card-head">
                <EmployeeAvatar
                  displayName={row.displayName}
                  photoUrl={row.photoUrl}
                  size="md"
                />
                <div className="hr-entity-card-title-wrap">
                  <h2 className="hr-entity-card-title">{row.displayName}</h2>
                  <p className="hr-entity-card-subtitle">
                    {row.advanceDateLabel}
                  </p>
                </div>
              </div>
              <span className="badge">{row.statusLabel}</span>
            </div>
            <dl className="hr-entity-card-meta">
              <div>
                <dt>จำนวน</dt>
                <dd>{formatThb(row.amount)} บาท</dd>
              </div>
              <div>
                <dt>หักคืน</dt>
                <dd>{row.installmentCount} งวด</dd>
              </div>
              {row.startPeriodLabel ? (
                <div>
                  <dt>เริ่มหัก</dt>
                  <dd>{row.startPeriodLabel}</dd>
                </div>
              ) : null}
              {row.disbursementModeLabel ? (
                <div>
                  <dt>วิธีรับเงินที่ขอ</dt>
                  <dd>{row.disbursementModeLabel}</dd>
                </div>
              ) : null}
              {row.reason ? (
                <div>
                  <dt>หมายเหตุ</dt>
                  <dd>{row.reason}</dd>
                </div>
              ) : null}
            </dl>
            {canApprove ? (
              <div className="hr-entity-card-actions">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={saving}
                  onClick={() => reject(row)}
                >
                  ไม่อนุมัติ
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={saving}
                  onClick={() => openReview(row)}
                >
                  อนุมัติ
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {reviewing ? (
        <div className="hr-overlay" role="presentation">
          <button
            type="button"
            className="hr-overlay-backdrop"
            aria-label="ปิด"
            onClick={() => !saving && setReviewing(null)}
          />
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="hr-overlay-head hr-period-create-overlay-head">
              <div>
                <p className="hr-period-create-overlay-kicker">เบิกล่วงหน้า</p>
                <h2 id={titleId}>อนุมัติคำขอ</h2>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                disabled={saving}
                onClick={() => setReviewing(null)}
              >
                ปิด
              </button>
            </div>
            <div className="hr-overlay-body">
              <form className="hr-advance-form" onSubmit={approve}>
                <p className="muted">
                  {reviewing.displayName} · {formatThb(reviewing.amount)} บาท ·
                  หัก {reviewing.installmentCount} งวด เริ่ม{" "}
                  {reviewing.startPeriodLabel ?? "รอบถัดไป"}
                  {reviewing.disbursementModeLabel
                    ? ` · พนักงานขอ${reviewing.disbursementModeLabel}`
                    : ""}
                </p>
                <Field
                  id="adv-disburse"
                  label="วิธีรับเงิน"
                  required
                  hint="เปลี่ยนจากที่พนักงานขอได้"
                >
                  <select
                    {...fieldProps("adv-disburse")}
                    value={mode}
                    onChange={(e) => {
                      setMode(e.target.value as DisbursementMode);
                      setSlipFile(null);
                    }}
                    disabled={saving}
                  >
                    <option value="WITH_SALARY">รับพร้อมเงินเดือน</option>
                    <option value="CASH_ALREADY">รับเงินเลย</option>
                  </select>
                </Field>
                {mode === "CASH_ALREADY" ? (
                  <Field
                    id="adv-slip"
                    label="สลิปโอนเงิน"
                    hint="ไม่บังคับ — แนบตอนนี้หรือทีหลังก็ได้ เก็บในเอกสารพนักงาน"
                  >
                    <input
                      id="adv-slip"
                      type="file"
                      accept="image/*,application/pdf"
                      disabled={saving}
                      onChange={(e) =>
                        setSlipFile(e.target.files?.[0] ?? null)
                      }
                    />
                  </Field>
                ) : (
                  <p className="field-hint">
                    โอนเข้าบัญชีพร้อมเงินเดือนในรอบที่หักงวดแรก
                  </p>
                )}
                <div className="form-actions hr-advance-form-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={saving}
                    onClick={() => setReviewing(null)}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? "กำลังบันทึก…" : "ยืนยันอนุมัติ"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
