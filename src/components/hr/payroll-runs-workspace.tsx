"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import Field, { fieldProps } from "@/components/hr/field";
import { submitHrJson } from "@/components/hr/form-utils";
import { formatThb } from "@/lib/hr/money";
import type { PayrollRunListItem } from "@/lib/hr/services/payroll-runs";
import { formatThaiDate } from "@/lib/hr/thai-date";

export type PayrollPeriodOption = { id: string; label: string };

function statusBadgeClass(code: string): string {
  if (code === "APPROVED" || code === "PAID") return "badge badge-active";
  if (code === "LOCKED") return "badge badge-inactive";
  return "badge";
}

export default function PayrollRunsWorkspace({
  runs,
  periodOptions,
  canManage,
  available = true,
}: {
  runs: PayrollRunListItem[];
  periodOptions: PayrollPeriodOption[];
  canManage: boolean;
  available?: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const [creating, setCreating] = useState(false);
  const [periodId, setPeriodId] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);

  useEffect(() => {
    if (!creating) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [creating]);

  useEffect(() => {
    if (!creating) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setCreating(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [creating]);

  function closeOverlay() {
    setCreating(false);
    setPeriodId("");
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!periodId) {
      setFeedback({ kind: "error", message: "กรุณาเลือกงวดเงินเดือน" });
      return;
    }
    setSaving(true);
    const result = await submitHrJson(
      "/api/hr/payroll/runs",
      "POST",
      { payrollPeriodId: periodId },
      "เริ่มประมวลผลเรียบร้อยแล้ว",
    );
    setSaving(false);
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }
    setFeedback({ kind: "success", message: result.message });
    closeOverlay();
    router.refresh();
  }

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      {runs.length === 0 ? (
        <p className="empty">
          ยังไม่มีรายการประมวลผลเงินเดือน
          {canManage ? " — กด + เพื่อเริ่มรอบใหม่" : ""}
        </p>
      ) : (
        <div className="hr-card-grid">
          {runs.map((row) => (
            <article key={row.id} className="card hr-entity-card">
              <div className="hr-entity-card-top">
                <div className="hr-entity-card-title-wrap">
                  <h2 className="hr-entity-card-title">{row.scheduleName}</h2>
                  <p className="hr-entity-card-subtitle">{row.periodLabel}</p>
                </div>
                <span className={statusBadgeClass(row.statusCode)}>
                  {row.statusNameTh}
                </span>
              </div>

              <dl className="hr-entity-card-meta">
                <div>
                  <dt>พนักงาน</dt>
                  <dd>{row.employeeCount} คน</dd>
                </div>
                <div>
                  <dt>ยอดสุทธิรวม</dt>
                  <dd>{formatThb(row.totalNet)}</dd>
                </div>
                <div>
                  <dt>วันจ่าย</dt>
                  <dd>{formatThaiDate(row.paymentDate)}</dd>
                </div>
              </dl>

              <div className="hr-entity-card-actions">
                <Link
                  className="btn btn-sm"
                  href={`/hr/payroll/runs/${row.id}`}
                >
                  เปิดดู
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {canManage && !creating ? (
        <button
          type="button"
          className="hr-fab"
          onClick={() => setCreating(true)}
          disabled={!available || periodOptions.length === 0}
          aria-label="เริ่มประมวลผลเงินเดือน"
          title="เริ่มประมวลผลเงินเดือน"
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
          />
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="hr-overlay-head">
              <h2 id={titleId}>เริ่มประมวลผลเงินเดือน</h2>
              <button
                type="button"
                className="btn btn-sm"
                onClick={closeOverlay}
                aria-label="ปิด"
              >
                ปิด
              </button>
            </div>
            <div className="hr-overlay-body">
              <form onSubmit={handleCreate} noValidate>
                <Field id="payroll-period" label="งวดเงินเดือน" required>
                  <select
                    {...fieldProps("payroll-period")}
                    value={periodId}
                    onChange={(e) => setPeriodId(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">— เลือกงวด —</option>
                    {periodOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
                {periodOptions.length === 0 ? (
                  <p className="field-hint">ยังไม่มีงวดให้ประมวลผล</p>
                ) : null}
                <div className="form-actions">
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
                    disabled={saving || !periodId}
                  >
                    {saving ? "กำลังสร้าง…" : "เริ่มประมวลผล"}
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
