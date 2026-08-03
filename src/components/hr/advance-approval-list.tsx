"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import EmployeeAvatar from "@/components/hr/employee-avatar";
import EmployeeNameLabel from "@/components/hr/employee-name-label";
import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import Field, { fieldProps } from "@/components/hr/field";
import HrButton from "@/components/ui/hr-button";
import { formatThb } from "@/lib/hr/money";
import type {
  DisbursementMode,
  SalaryAdvanceRow,
} from "@/lib/hr/services/salary-advances";
import { formatThaiDateTimeReadable } from "@/lib/hr/thai-date";

function statusClass(code: string): string {
  if (code === "APPROVED" || code === "PARTIALLY_DEDUCTED" || code === "DEDUCTED") {
    return "badge badge-active";
  }
  if (code === "REJECTED" || code === "CANCELLED") return "badge badge-inactive";
  return "badge";
}

export default function AdvanceApprovalList({
  rows,
  canApprove,
  focusId = null,
  showBranchLabel = false,
  onChanged,
}: {
  rows: SalaryAdvanceRow[];
  canApprove: boolean;
  focusId?: string | null;
  showBranchLabel?: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [reviewing, setReviewing] = useState<SalaryAdvanceRow | null>(null);
  const [mode, setMode] = useState<DisbursementMode>("WITH_SALARY");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    setBusyId(row.id);
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
      setFeedback({ kind: "success", message: "ไม่อนุมัติแล้ว" });
      onChanged?.();
      router.refresh();
    } finally {
      setSaving(false);
      setBusyId(null);
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
      setFeedback({ kind: "success", message: "อนุมัติแล้ว" });
      setReviewing(null);
      setSlipFile(null);
      onChanged?.();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (rows.length === 0) {
    return <p className="empty">ยังไม่มีคำขอเบิกล่วงหน้าที่รออนุมัติ</p>;
  }

  const overlay =
    reviewing && typeof document !== "undefined"
      ? createPortal(
          <div className="hr-root">
            <div
              className="hr-overlay hr-overlay--elevated"
              role="presentation"
            >
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
                    <p className="hr-period-create-overlay-kicker">
                      เบิกล่วงหน้า
                    </p>
                    <h2 id={titleId}>อนุมัติคำขอ</h2>
                  </div>
                  <HrButton
                    type="button"
                    className="btn btn-sm"
                    disabled={saving}
                    onClick={() => setReviewing(null)}
                  >
                    ปิด
                  </HrButton>
                </div>
                <div className="hr-overlay-body">
                  <form className="hr-advance-form" onSubmit={approve}>
                    <p className="muted">
                      {reviewing.displayName} · {formatThb(reviewing.amount)}{" "}
                      บาท · หัก {reviewing.installmentCount} งวด เริ่ม{" "}
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
                      <HrButton
                        type="button"
                        className="btn"
                        disabled={saving}
                        onClick={() => setReviewing(null)}
                      >
                        ยกเลิก
                      </HrButton>
                      <HrButton
                        type="submit"
                        className="btn btn-primary"
                        action="approve"
                        disabled={saving}
                      >
                        {saving ? "กำลังบันทึก…" : "ยืนยันอนุมัติ"}
                      </HrButton>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />
      <ul className="hr-leave-request-list">
        {rows.map((row) => {
          const pending = row.status === "SUBMITTED";
          const busy = busyId === row.id || (saving && reviewing?.id === row.id);
          return (
            <li
              key={row.id}
              id={`approval-${row.id}`}
              className={`hr-leave-approval-item${
                focusId === row.id ? " hr-approval-focus" : ""
              }`}
            >
              <div className="hr-leave-approval-head">
                <div className="hr-ot-approval-person">
                  <EmployeeAvatar
                    displayName={row.displayName}
                    photoUrl={row.photoUrl}
                    size="lg"
                  />
                  <div className="hr-leave-request-main">
                    <EmployeeNameLabel
                      name={row.displayName}
                      branchName={row.branchName}
                      showBranch={showBranchLabel}
                      className="hr-approval-employee-name"
                    />
                    <div className="hr-leave-request-headline">
                      <span className="hr-leave-request-type">เบิก</span>
                      <span className="hr-leave-request-dates">
                        {row.advanceDateLabel}
                        <span className="hr-leave-request-days">
                          · {formatThb(row.amount)} บาท
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="hr-leave-approval-side">
                  <span
                    className={`hr-leave-approval-status ${statusClass(row.status)}`}
                  >
                    {row.statusLabel}
                  </span>
                  {canApprove && pending ? (
                    <div className="hr-leave-approval-actions">
                      <HrButton
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={busy}
                        onClick={() => openReview(row)}
                      >
                        อนุมัติ
                      </HrButton>
                      <HrButton
                        type="button"
                        className="btn btn-sm btn-danger"
                        disabled={busy}
                        onClick={() => void reject(row)}
                      >
                        ไม่อนุมัติ
                      </HrButton>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="hr-leave-approval-body">
                <span className="hr-leave-request-submitted">
                  ยื่นเมื่อ {formatThaiDateTimeReadable(row.submittedAt)}
                </span>
                <span className="hr-leave-request-shift">
                  หักคืน {row.installmentCount} งวด
                  {row.startPeriodLabel
                    ? ` · เริ่ม ${row.startPeriodLabel}`
                    : ""}
                  {row.disbursementModeLabel
                    ? ` · ขอ${row.disbursementModeLabel}`
                    : ""}
                </span>
                {row.reason?.trim() ? (
                  <span className="hr-leave-request-reason">
                    {row.reason.trim()}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {overlay}
    </>
  );
}
