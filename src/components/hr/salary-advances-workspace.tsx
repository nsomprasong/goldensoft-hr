"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

import EmployeeAvatar from "@/components/hr/employee-avatar";
import EmployeeNameLabel from "@/components/hr/employee-name-label";
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
import { formatThaiDate } from "@/lib/hr/thai-date";

export type AdvanceEmployeeOption = { id: string; label: string };

function statusBadgeClass(status: string): string {
  if (status === "DEDUCTED" || status === "APPROVED") return "badge badge-active";
  if (status === "CANCELLED" || status === "REJECTED") return "badge badge-inactive";
  return "badge";
}

function bangkokTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function SalaryAdvancesWorkspace({
  advances,
  employees,
  periodOptions,
  canManage,
  canApprove,
  available = true,
  branchLabel,
  showBranchLabel = false,
}: {
  advances: SalaryAdvanceRow[];
  employees: AdvanceEmployeeOption[];
  periodOptions: AdvancePeriodOption[];
  canManage: boolean;
  canApprove: boolean;
  available?: boolean;
  branchLabel: string | null;
  showBranchLabel?: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [advanceDate, setAdvanceDate] = useState("");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [startPeriodId, setStartPeriodId] = useState("");
  const [reason, setReason] = useState("");
  const [autoApprove, setAutoApprove] = useState(true);
  const [disbursementMode, setDisbursementMode] =
    useState<DisbursementMode>("WITH_SALARY");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [reviewing, setReviewing] = useState<SalaryAdvanceRow | null>(null);
  const [reviewMode, setReviewMode] =
    useState<DisbursementMode>("WITH_SALARY");
  const [reviewSlipFile, setReviewSlipFile] = useState<File | null>(null);
  const [attachingSlipFor, setAttachingSlipFor] =
    useState<SalaryAdvanceRow | null>(null);
  const [attachSlipFile, setAttachSlipFile] = useState<File | null>(null);

  useEffect(() => {
    if (!creating && !reviewing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [creating, reviewing]);

  const selectedEmployee = useMemo(
    () => employees.find((row) => row.id === employeeId) ?? null,
    [employees, employeeId],
  );
  const parsedAmount = Number(amount);
  const amountOk = Number.isFinite(parsedAmount) && parsedAmount > 0;

  function openCreate() {
    setEmployeeId("");
    setAmount("");
    setAdvanceDate(bangkokTodayIso());
    setInstallmentCount("1");
    setStartPeriodId("");
    setReason("");
    setAutoApprove(canManage);
    setDisbursementMode("WITH_SALARY");
    setSlipFile(null);
    setCreating(true);
  }

  function resetForm() {
    setCreating(false);
    setEmployeeId("");
    setAmount("");
    setAdvanceDate("");
    setInstallmentCount("1");
    setStartPeriodId("");
    setReason("");
    setSlipFile(null);
  }

  function closeOverlay() {
    if (saving) return;
    resetForm();
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const count = Math.floor(Number(installmentCount) || 0);
    if (!employeeId || !advanceDate || !amountOk || count < 1) {
      setFeedback({
        kind: "error",
        message: "กรุณาระบุพนักงาน จำนวนเงิน วันที่ และจำนวนงวดหักคืน",
      });
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.set("employeeId", employeeId);
      form.set("amount", String(parsedAmount));
      form.set("advanceDate", advanceDate);
      form.set("installmentCount", String(count));
      form.set("autoApprove", autoApprove ? "true" : "false");
      form.set("disbursementMode", disbursementMode);
      if (startPeriodId) form.set("startPayrollPeriodId", startPeriodId);
      const note = reason.trim();
      if (note) form.set("reason", note);
      if (slipFile) form.set("transferSlip", slipFile);

      const response = await fetch("/api/hr/advances", {
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
          message: payload?.error?.message ?? "บันทึกไม่สำเร็จ",
        });
        return;
      }
      setFeedback({
        kind: "success",
        message: autoApprove
          ? "บันทึกและอนุมัติเบิกล่วงหน้าแล้ว"
          : "ส่งคำขอเบิกล่วงหน้าแล้ว",
      });
      resetForm();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    const result = await submitHrJson(
      `/api/hr/advances/${id}/cancel`,
      "POST",
      {},
      "ยกเลิกรายการแล้ว",
    );
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }
    setFeedback({ kind: "success", message: result.message });
    router.refresh();
  }

  async function handleApprove(event: React.FormEvent) {
    event.preventDefault();
    if (!reviewing) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.set("action", "approve");
      form.set("disbursementMode", reviewMode);
      form.set("installmentCount", String(reviewing.installmentCount));
      if (reviewing.startPayrollPeriodId) {
        form.set("startPayrollPeriodId", reviewing.startPayrollPeriodId);
      }
      if (reviewSlipFile) form.set("transferSlip", reviewSlipFile);
      const response = await fetch(
        `/api/hr/advances/${reviewing.id}/review`,
        { method: "POST", credentials: "same-origin", body: form },
      );
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
      setReviewSlipFile(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleAttachSlip(event: React.FormEvent) {
    event.preventDefault();
    if (!attachingSlipFor || !attachSlipFile) {
      setFeedback({ kind: "error", message: "กรุณาเลือกไฟล์สลิปโอนเงิน" });
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.set("transferSlip", attachSlipFile);
      const response = await fetch(
        `/api/hr/advances/${attachingSlipFor.id}/slip`,
        { method: "POST", credentials: "same-origin", body: form },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: payload?.error?.message ?? "แนบสลิปไม่สำเร็จ",
        });
        return;
      }
      setFeedback({ kind: "success", message: "แนบสลิปโอนเงินแล้ว" });
      setAttachingSlipFor(null);
      setAttachSlipFile(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function canAttachSlipLater(row: SalaryAdvanceRow): boolean {
    if (!(canManage || canApprove)) return false;
    if (row.disbursementMode !== "CASH_ALREADY") return false;
    if (row.transferSlip) return false;
    return (
      row.status === "APPROVED" ||
      row.status === "PARTIALLY_DEDUCTED" ||
      row.status === "DEDUCTED"
    );
  }

  const canCreate = (canManage || canApprove) && available;

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      {branchLabel ? (
        <p className="hr-payroll-run-table-caption">
          <strong>{branchLabel}</strong>
          <span>แสดงเฉพาะสาขาที่เลือกในหัวระบบ</span>
        </p>
      ) : null}

      {advances.length === 0 ? (
        <p className="empty">
          ยังไม่มีรายการเบิกล่วงหน้า
          {canCreate ? " — กด + เพื่อบันทึกหรือส่งคำขอ" : ""}
        </p>
      ) : (
        <div className="hr-card-grid">
          {advances.map((row) => (
            <article key={row.id} className="card hr-entity-card">
              <div className="hr-entity-card-top">
                <div className="hr-employee-card-head">
                  <EmployeeAvatar
                    displayName={row.displayName}
                    photoUrl={row.photoUrl}
                    size="lg"
                  />
                  <div className="hr-entity-card-title-wrap">
                    <EmployeeNameLabel
                      name={row.displayName}
                      branchName={row.branchName}
                      showBranch={showBranchLabel}
                      as="h2"
                      className="hr-entity-card-title hr-approval-employee-name"
                    />
                    <p className="hr-entity-card-subtitle hr-leave-request-dates">
                      {row.advanceDateLabel}
                    </p>
                  </div>
                </div>
                <span className={statusBadgeClass(row.status)}>
                  {row.statusLabel}
                </span>
              </div>
              <dl className="hr-entity-card-meta">
                <div>
                  <dt>จำนวน</dt>
                  <dd>{formatThb(row.amount)}</dd>
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
                    <dd className="muted">ยังไม่มี — แนบทีหลังได้</dd>
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
              <div className="hr-entity-card-actions">
                {canApprove && row.status === "SUBMITTED" ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      setReviewMode(
                        row.disbursementMode === "CASH_ALREADY" ||
                          row.disbursementMode === "WITH_SALARY"
                          ? row.disbursementMode
                          : "WITH_SALARY",
                      );
                      setReviewSlipFile(null);
                      setReviewing(row);
                    }}
                  >
                    อนุมัติ
                  </button>
                ) : null}
                {canAttachSlipLater(row) ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setAttachSlipFile(null);
                      setAttachingSlipFor(row);
                    }}
                  >
                    แนบสลิป
                  </button>
                ) : null}
                {canManage &&
                (row.status === "APPROVED" ||
                  row.status === "SUBMITTED" ||
                  row.status === "RECORDED") ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleCancel(row.id)}
                  >
                    ยกเลิก
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {canCreate && !creating && !reviewing ? (
        <button
          type="button"
          className="hr-fab"
          aria-label="บันทึกเบิกล่วงหน้า"
          title="บันทึกเบิกล่วงหน้า"
          onClick={openCreate}
        >
          <span aria-hidden="true">+</span>
        </button>
      ) : null}

      {creating ? (
        <div className="hr-overlay" role="presentation">
          <button
            type="button"
            className="hr-overlay-backdrop"
            aria-label="ปิด"
            onClick={closeOverlay}
            disabled={saving}
          />
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="hr-overlay-head hr-period-create-overlay-head">
              <div>
                <p className="hr-period-create-overlay-kicker">เงินเดือน</p>
                <h2 id={titleId}>บันทึกเบิกล่วงหน้า</h2>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={closeOverlay}
                disabled={saving}
                aria-label="ปิด"
              >
                ปิด
              </button>
            </div>
            <div className="hr-overlay-body">
              <form
                className="hr-advance-form"
                onSubmit={handleCreate}
                noValidate
              >
                <Field id="adv-emp" label="พนักงาน" required>
                  <select
                    {...fieldProps("adv-emp")}
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    disabled={saving || employees.length === 0}
                  >
                    <option value="">
                      {employees.length === 0
                        ? "ไม่มีพนักงานในสาขานี้"
                        : "เลือกพนักงาน"}
                    </option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="hr-advance-form-pair">
                  <Field id="adv-amount" label="จำนวนเงิน (บาท)" required>
                    <input
                      {...fieldProps("adv-amount")}
                      type="number"
                      min="1"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={saving}
                    />
                  </Field>
                  <Field id="adv-date" label="วันที่เบิก" required>
                    <ThaiDateInput
                      id="adv-date"
                      value={advanceDate}
                      onChange={setAdvanceDate}
                      required
                      disabled={saving}
                    />
                  </Field>
                </div>

                <div className="hr-advance-form-pair">
                  <Field id="adv-count" label="หักคืนกี่งวด" required>
                    <input
                      {...fieldProps("adv-count")}
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
                    id="adv-start"
                    label="เริ่มหักงวด"
                    hint="ว่างได้ — จะหักเมื่อมีรอบคำนวณหลังอนุมัติ"
                  >
                    <select
                      {...fieldProps("adv-start")}
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

                <Field id="adv-mode" label="วิธีรับเงิน" required>
                  <select
                    {...fieldProps("adv-mode")}
                    value={disbursementMode}
                    onChange={(e) => {
                      setDisbursementMode(e.target.value as DisbursementMode);
                      setSlipFile(null);
                    }}
                    disabled={saving}
                  >
                    <option value="WITH_SALARY">รับพร้อมเงินเดือน</option>
                    <option value="CASH_ALREADY">รับเงินเลย</option>
                  </select>
                </Field>
                {disbursementMode === "CASH_ALREADY" ? (
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
                ) : null}
                {canManage ? (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={autoApprove}
                      onChange={(e) => setAutoApprove(e.target.checked)}
                      disabled={saving}
                    />
                    <span>อนุมัติทันที (ไม่ส่งรออนุมัติ)</span>
                  </label>
                ) : null}

                <div className="hr-advance-form-summary" aria-live="polite">
                  <div>
                    <span className="hr-advance-form-summary-label">
                      ยอดเบิก
                    </span>
                    <strong>
                      {amountOk ? `${formatThb(parsedAmount)} บาท` : "ยังไม่ได้ระบุ"}
                    </strong>
                  </div>
                  <p className="hr-advance-form-summary-meta">
                    {selectedEmployee?.label ?? "ยังไม่ได้เลือกพนักงาน"}
                    {" · "}
                    {advanceDate
                      ? formatThaiDate(advanceDate)
                      : "ยังไม่ได้เลือกวันที่"}
                    {" · หัก "}
                    {installmentCount || "—"} งวด
                  </p>
                </div>

                <Field id="adv-reason" label="หมายเหตุ">
                  <textarea
                    {...fieldProps("adv-reason")}
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
                    onClick={closeOverlay}
                    disabled={saving}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || employees.length === 0}
                  >
                    {saving
                      ? "กำลังบันทึก…"
                      : autoApprove
                        ? "บันทึกและอนุมัติ"
                        : "ส่งคำขอ"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

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
            aria-labelledby={`${titleId}-review`}
          >
            <div className="hr-overlay-head">
              <h2 id={`${titleId}-review`}>อนุมัติเบิกล่วงหน้า</h2>
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
              <form className="hr-advance-form" onSubmit={handleApprove}>
                <p className="muted">
                  {reviewing.displayName} · {formatThb(reviewing.amount)} บาท ·
                  หัก {reviewing.installmentCount} งวด
                  {reviewing.disbursementModeLabel
                    ? ` · พนักงานขอ${reviewing.disbursementModeLabel}`
                    : ""}
                </p>
                <Field
                  id="adv-review-mode"
                  label="วิธีรับเงิน"
                  required
                  hint="เปลี่ยนจากที่พนักงานขอได้"
                >
                  <select
                    {...fieldProps("adv-review-mode")}
                    value={reviewMode}
                    onChange={(e) => {
                      setReviewMode(e.target.value as DisbursementMode);
                      setReviewSlipFile(null);
                    }}
                    disabled={saving}
                  >
                    <option value="WITH_SALARY">รับพร้อมเงินเดือน</option>
                    <option value="CASH_ALREADY">รับเงินเลย</option>
                  </select>
                </Field>
                {reviewMode === "CASH_ALREADY" ? (
                  <Field
                    id="adv-review-slip"
                    label="สลิปโอนเงิน"
                    hint="ไม่บังคับ — แนบตอนนี้หรือทีหลังก็ได้"
                  >
                    <input
                      id="adv-review-slip"
                      type="file"
                      accept="image/*,application/pdf"
                      disabled={saving}
                      onChange={(e) =>
                        setReviewSlipFile(e.target.files?.[0] ?? null)
                      }
                    />
                  </Field>
                ) : null}
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

      {attachingSlipFor ? (
        <div className="hr-overlay" role="presentation">
          <button
            type="button"
            className="hr-overlay-backdrop"
            aria-label="ปิด"
            onClick={() => !saving && setAttachingSlipFor(null)}
          />
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${titleId}-slip`}
          >
            <div className="hr-overlay-head">
              <h2 id={`${titleId}-slip`}>แนบสลิปโอนเงิน</h2>
              <button
                type="button"
                className="btn btn-sm"
                disabled={saving}
                onClick={() => setAttachingSlipFor(null)}
              >
                ปิด
              </button>
            </div>
            <div className="hr-overlay-body">
              <form className="hr-advance-form" onSubmit={handleAttachSlip}>
                <p className="muted">
                  {attachingSlipFor.displayName} ·{" "}
                  {formatThb(attachingSlipFor.amount)} บาท · รับเงินเลย
                </p>
                <Field
                  id="adv-attach-slip"
                  label="สลิปโอนเงิน"
                  required
                  hint="เก็บในเอกสารพนักงานเป็นหลักฐาน"
                >
                  <input
                    id="adv-attach-slip"
                    type="file"
                    accept="image/*,application/pdf"
                    disabled={saving}
                    onChange={(e) =>
                      setAttachSlipFile(e.target.files?.[0] ?? null)
                    }
                  />
                </Field>
                <div className="form-actions hr-advance-form-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={saving}
                    onClick={() => setAttachingSlipFor(null)}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || !attachSlipFile}
                  >
                    {saving ? "กำลังบันทึก…" : "บันทึกสลิป"}
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
