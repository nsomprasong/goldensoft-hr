"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";

import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import Field, { fieldProps } from "@/components/hr/field";
import { submitHrJson } from "@/components/hr/form-utils";
import ThaiDateInput from "@/components/hr/thai-date-input";
import { formatThb } from "@/lib/hr/money";
import type {
  AdvancePeriodOption,
  DisbursementMode,
  SalaryAdvanceRow,
} from "@/lib/hr/services/salary-advances";

function bangkokTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function statusBadgeClass(status: string): string {
  if (status === "APPROVED" || status === "DEDUCTED") return "badge badge-active";
  if (status === "REJECTED" || status === "CANCELLED") return "badge badge-inactive";
  return "badge";
}

export default function MeAdvancesWorkspace({
  advances,
  periodOptions,
}: {
  advances: SalaryAdvanceRow[];
  periodOptions: AdvancePeriodOption[];
}) {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [amount, setAmount] = useState("");
  const [advanceDate, setAdvanceDate] = useState(bangkokTodayIso());
  const [installmentCount, setInstallmentCount] = useState("1");
  const [startPeriodId, setStartPeriodId] = useState("");
  const [disbursementMode, setDisbursementMode] =
    useState<DisbursementMode>("WITH_SALARY");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function close() {
    if (saving) return;
    setOpen(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    const count = Math.floor(Number(installmentCount) || 0);
    if (
      !advanceDate ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0 ||
      count < 1
    ) {
      setFeedback({
        kind: "error",
        message: "กรุณาระบุจำนวนเงิน วันที่ และจำนวนงวดหักคืน",
      });
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      amount: parsedAmount,
      advanceDate,
      installmentCount: count,
      disbursementMode,
    };
    if (startPeriodId) payload.startPayrollPeriodId = startPeriodId;
    if (reason.trim()) payload.reason = reason.trim();
    const result = await submitHrJson(
      "/api/hr/advances/me",
      "POST",
      payload,
      "ส่งคำขอเบิกล่วงหน้าแล้ว",
    );
    setSaving(false);
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }
    setFeedback({ kind: "success", message: result.message });
    setOpen(false);
    setAmount("");
    setReason("");
    setDisbursementMode("WITH_SALARY");
    router.refresh();
  }

  async function cancel(id: string) {
    const result = await submitHrJson(
      `/api/hr/advances/${id}/cancel`,
      "POST",
      {},
      "ยกเลิกคำขอแล้ว",
    );
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

      {advances.length === 0 ? (
        <p className="empty">ยังไม่มีคำขอเบิก — กด + เพื่อส่งคำขอ</p>
      ) : (
        <div className="hr-card-grid">
          {advances.map((row) => (
            <article key={row.id} className="card hr-entity-card">
              <div className="hr-entity-card-top">
                <div className="hr-entity-card-title-wrap">
                  <h2 className="hr-entity-card-title">
                    {formatThb(row.amount)} บาท
                  </h2>
                  <p className="hr-entity-card-subtitle">
                    {row.advanceDateLabel}
                  </p>
                </div>
                <span className={statusBadgeClass(row.status)}>
                  {row.statusLabel}
                </span>
              </div>
              <dl className="hr-entity-card-meta">
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
                    <dt>วิธีรับเงิน</dt>
                    <dd>{row.disbursementModeLabel}</dd>
                  </div>
                ) : null}
                {row.transferSlip ? (
                  <div>
                    <dt>สลิปโอน</dt>
                    <dd>
                      <a
                        href={row.transferSlip.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        ดูหลักฐาน
                      </a>
                    </dd>
                  </div>
                ) : row.disbursementMode === "CASH_ALREADY" &&
                  (row.status === "APPROVED" ||
                    row.status === "PARTIALLY_DEDUCTED" ||
                    row.status === "DEDUCTED") ? (
                  <div>
                    <dt>สลิปโอน</dt>
                    <dd className="muted">รอแนบหลักฐาน</dd>
                  </div>
                ) : null}
                {row.reason ? (
                  <div>
                    <dt>หมายเหตุ</dt>
                    <dd>{row.reason}</dd>
                  </div>
                ) : null}
              </dl>
              {row.installments.length > 0 ? (
                <ul className="hr-advance-installment-list">
                  {row.installments.map((inst) => (
                    <li key={inst.id}>
                      งวด {inst.sequence}: {formatThb(inst.amount)} ·{" "}
                      {inst.periodLabel} · {inst.statusLabel}
                    </li>
                  ))}
                </ul>
              ) : null}
              {row.status === "SUBMITTED" ? (
                <div className="hr-entity-card-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => cancel(row.id)}
                  >
                    ยกเลิกคำขอ
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {!open ? (
        <button
          type="button"
          className="hr-fab"
          aria-label="ขอเบิกล่วงหน้า"
          title="ขอเบิกล่วงหน้า"
          onClick={() => {
            setAdvanceDate(bangkokTodayIso());
            setStartPeriodId("");
            setOpen(true);
          }}
        >
          <span aria-hidden="true">+</span>
        </button>
      ) : null}

      {open ? (
        <div className="hr-overlay" role="presentation">
          <button
            type="button"
            className="hr-overlay-backdrop"
            aria-label="ปิด"
            onClick={close}
          />
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="hr-overlay-head hr-period-create-overlay-head">
              <div>
                <p className="hr-period-create-overlay-kicker">ของฉัน</p>
                <h2 id={titleId}>ขอเบิกล่วงหน้า</h2>
              </div>
              <button type="button" className="btn btn-sm" onClick={close}>
                ปิด
              </button>
            </div>
            <div className="hr-overlay-body">
              <form className="hr-advance-form" onSubmit={submit} noValidate>
                <div className="hr-advance-form-pair">
                  <Field id="me-adv-amount" label="จำนวนเงิน (บาท)" required>
                    <input
                      {...fieldProps("me-adv-amount")}
                      type="number"
                      min="1"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={saving}
                    />
                  </Field>
                  <Field id="me-adv-date" label="วันที่ขอ" required>
                    <ThaiDateInput
                      id="me-adv-date"
                      value={advanceDate}
                      onChange={setAdvanceDate}
                      required
                      disabled={saving}
                    />
                  </Field>
                </div>
                <div className="hr-advance-form-pair">
                  <Field id="me-adv-count" label="หักคืนกี่งวด" required>
                    <input
                      {...fieldProps("me-adv-count")}
                      type="number"
                      min="1"
                      max="24"
                      step="1"
                      value={installmentCount}
                      onChange={(e) => setInstallmentCount(e.target.value)}
                      disabled={saving}
                    />
                  </Field>
                  <Field
                    id="me-adv-start"
                    label="เริ่มหักงวด"
                    hint="ว่างได้ — ไม่ต้องมีงวดครบก่อน ระบบจะหักเมื่อสร้าง/คำนวณรอบ"
                  >
                    <select
                      {...fieldProps("me-adv-start")}
                      value={startPeriodId}
                      onChange={(e) => setStartPeriodId(e.target.value)}
                      disabled={saving}
                    >
                      <option value="">เริ่มหักตั้งแต่รอบถัดไป</option>
                      {periodOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field id="me-adv-mode" label="วิธีรับเงิน" required>
                  <select
                    {...fieldProps("me-adv-mode")}
                    value={disbursementMode}
                    onChange={(e) =>
                      setDisbursementMode(e.target.value as DisbursementMode)
                    }
                    disabled={saving}
                  >
                    <option value="WITH_SALARY">รับพร้อมเงินเดือน</option>
                    <option value="CASH_ALREADY">รับเงินเลย</option>
                  </select>
                </Field>
                <p className="field-hint">
                  {disbursementMode === "WITH_SALARY"
                    ? "โอนเข้าบัญชีพร้อมเงินเดือนในรอบที่หักงวดแรก — ผู้อนุมัติเปลี่ยนวิธีจ่ายได้"
                    : "ต้องการรับเงินทันทีหลังอนุมัติ — ผู้อนุมัติเปลี่ยนวิธีจ่ายและแนบสลิปได้ทีหลัง"}
                </p>
                <Field id="me-adv-reason" label="หมายเหตุ">
                  <textarea
                    {...fieldProps("me-adv-reason")}
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={saving}
                    placeholder="เช่น ค่ารักษาพยาบาล"
                  />
                </Field>
                <div className="form-actions hr-advance-form-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={close}
                    disabled={saving}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? "กำลังส่ง…" : "ส่งคำขอ"}
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
