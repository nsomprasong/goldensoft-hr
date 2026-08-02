"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import EmployeeAvatar from "@/components/hr/employee-avatar";
import EmployeeNameLabel from "@/components/hr/employee-name-label";
import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import { submitHrJson } from "@/components/hr/form-utils";
import { formatThb } from "@/lib/hr/money";
import type { PayrollRunDetail } from "@/lib/hr/services/payroll-runs";
import { formatThaiDate } from "@/lib/hr/thai-date";

type ActionKey = "calculate" | "review" | "approve" | "markPaid" | "lock";

function statusBadgeClass(code: string): string {
  if (code === "APPROVED" || code === "PAID") return "badge badge-active";
  if (code === "LOCKED") return "badge badge-inactive";
  return "badge";
}

function cellOrDash(amount: number): string {
  if (!amount) return "—";
  return formatThb(amount);
}

export default function PayrollRunDetailWorkspace({
  run,
  canCalculate,
  canApprove,
  canMarkPaid,
  canIssue,
  available = true,
  showBranchLabel = false,
}: {
  run: PayrollRunDetail;
  canCalculate: boolean;
  canApprove: boolean;
  canMarkPaid: boolean;
  canIssue: boolean;
  available?: boolean;
  showBranchLabel?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);

  async function runAction(action: ActionKey, successMessage: string) {
    setBusy(action);
    setFeedback({ kind: "info", message: "กำลังดำเนินการ…" });
    const result = await submitHrJson(
      `/api/hr/payroll/runs/${run.id}/actions`,
      "POST",
      { action },
      successMessage,
    );
    setBusy(null);
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }
    setFeedback({ kind: "success", message: result.message });
    router.refresh();
  }

  async function issuePayslips() {
    setBusy("issue");
    setFeedback({ kind: "info", message: "กำลังออกสลิป…" });
    const result = await submitHrJson(
      `/api/hr/payroll/runs/${run.id}/issue`,
      "POST",
      {},
      "ออกสลิปเรียบร้อยแล้ว",
    );
    setBusy(null);
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }
    setFeedback({ kind: "success", message: result.message });
    router.refresh();
  }

  const status = run.statusCode;
  // APPROVED ยังคำนวณใหม่ได้ (ยังไม่จ่าย/ล็อก) เพื่อดึง OT/สาย/ขาดงาน
  const showCalculate =
    canCalculate &&
    (status === "DRAFT" || status === "REVIEW" || status === "APPROVED");
  const showApprove = canApprove && status === "REVIEW";
  const showMarkPaid = canMarkPaid && status === "APPROVED";
  const showIssue =
    canIssue && (status === "APPROVED" || status === "PAID" || status === "LOCKED");
  const hasActions =
    available && (showCalculate || showApprove || showMarkPaid || showIssue);

  const totals = run.employees.reduce(
    (acc, emp) => ({
      baseEarnings: acc.baseEarnings + emp.baseEarnings,
      overtime: acc.overtime + emp.overtime,
      advancePayout: acc.advancePayout + emp.advancePayout,
      otherEarnings: acc.otherEarnings + emp.otherEarnings,
      tax: acc.tax + emp.tax,
      socialSecurity: acc.socialSecurity + emp.socialSecurity,
      advance: acc.advance + emp.advance,
      late: acc.late + emp.late,
      absence: acc.absence + emp.absence,
      other: acc.other + emp.otherDeductions,
      net: acc.net + emp.netPay,
    }),
    {
      baseEarnings: 0,
      overtime: 0,
      advancePayout: 0,
      otherEarnings: 0,
      tax: 0,
      socialSecurity: 0,
      advance: 0,
      late: 0,
      absence: 0,
      other: 0,
      net: 0,
    },
  );
  const totalEarnings =
    totals.baseEarnings +
    totals.overtime +
    totals.advancePayout +
    totals.otherEarnings;
  const totalDeductions =
    totals.tax +
    totals.socialSecurity +
    totals.advance +
    totals.late +
    totals.absence +
    totals.other;

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      <p className="breadcrumb">
        <Link href="/hr/payroll/runs">ประมวลผลเงินเดือน</Link>
        {" · "}
        {run.scheduleName}
      </p>

      <header className="hr-page-head hr-payroll-run-head">
        <div className="hr-payroll-run-head-main">
          <div className="hr-payroll-run-title-row">
            <h1>{run.scheduleName}</h1>
            <span className={statusBadgeClass(run.statusCode)}>
              {run.statusNameTh}
            </span>
          </div>
          <p className="hr-payroll-run-summary">
            <span>{run.periodLabel}</span>
            <span className="hr-payroll-run-sep" aria-hidden>
              ·
            </span>
            <span>จ่าย {formatThaiDate(run.paymentDate)}</span>
            <span className="hr-payroll-run-sep" aria-hidden>
              ·
            </span>
            <span>{run.employeeCount} คน</span>
            <span className="hr-payroll-run-sep" aria-hidden>
              ·
            </span>
            <span>คงเหลือ {formatThb(run.totalNet)}</span>
          </p>
        </div>
        {hasActions ? (
          <div className="hr-payroll-run-actions">
            {showCalculate ? (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={busy != null}
                onClick={() =>
                  runAction(
                    "calculate",
                    status === "APPROVED"
                      ? "คำนวณใหม่เรียบร้อยแล้ว (สถานะกลับไปรอตรวจสอบ)"
                      : "คำนวณเรียบร้อยแล้ว",
                  )
                }
              >
                {busy === "calculate"
                  ? "…"
                  : status === "APPROVED"
                    ? "คำนวณใหม่"
                    : "คำนวณ"}
              </button>
            ) : null}
            {showApprove ? (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={busy != null}
                onClick={() => runAction("approve", "อนุมัติเรียบร้อยแล้ว")}
              >
                {busy === "approve" ? "…" : "อนุมัติ"}
              </button>
            ) : null}
            {showMarkPaid ? (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy != null}
                onClick={() => runAction("markPaid", "บันทึกจ่ายแล้ว")}
              >
                {busy === "markPaid" ? "…" : "จ่ายแล้ว"}
              </button>
            ) : null}
            {showIssue ? (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy != null}
                onClick={issuePayslips}
              >
                {busy === "issue" ? "…" : "ออกสลิป"}
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      {run.employees.length === 0 ? (
        <p className="empty">ยังไม่มีผลคำนวณ — กดคำนวณเพื่อสร้างรายการ</p>
      ) : (
        <div className="table-wrap hr-payroll-run-table-wrap">
          <div className="hr-payroll-run-table-caption">
            <strong>{run.branchLabel ?? "ทุกสาขา"}</strong>
            <span>
              รายรับ {formatThb(totalEarnings)} · หัก {formatThb(totalDeductions)}{" "}
              · คงเหลือ {formatThb(totals.net)}
            </span>
          </div>
          <table className="hr-payroll-run-table">
            <thead>
              <tr>
                <th rowSpan={2} className="col-sticky-name">
                  พนักงาน
                </th>
                <th colSpan={4} className="col-earn-group">
                  รายรับ
                </th>
                <th colSpan={6} className="col-deduct-group">
                  รายการหัก
                </th>
                <th rowSpan={2} className="num col-net">
                  คงเหลือ
                </th>
                <th rowSpan={2}>สลิป</th>
              </tr>
              <tr>
                <th className="num col-earn">ค่าจ้าง</th>
                <th className="num col-earn">OT</th>
                <th className="num col-earn">จ่ายเบิก</th>
                <th className="num col-earn">รายได้อื่น</th>
                <th className="num col-deduct">ภาษี</th>
                <th className="num col-deduct">ประกันสังคม</th>
                <th className="num col-deduct">หักเบิก</th>
                <th className="num col-deduct">สาย</th>
                <th className="num col-deduct">ขาดงาน</th>
                <th className="num col-deduct">หักอื่น</th>
              </tr>
            </thead>
            <tbody>
              {run.employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="col-sticky-name">
                    <div className="hr-payroll-run-person">
                      <EmployeeAvatar
                        displayName={emp.displayName}
                        photoUrl={emp.photoUrl}
                        size="sm"
                      />
                      <EmployeeNameLabel
                        name={emp.displayName}
                        branchName={emp.branchName}
                        showBranch={showBranchLabel}
                        as="span"
                        className="hr-approval-employee-name"
                      />
                    </div>
                  </td>
                  <td className="num nowrap col-earn">
                    {formatThb(emp.baseEarnings)}
                  </td>
                  <td className="num nowrap col-earn">
                    {cellOrDash(emp.overtime)}
                  </td>
                  <td className="num nowrap col-earn">
                    {cellOrDash(emp.advancePayout)}
                  </td>
                  <td className="num nowrap col-earn">
                    {cellOrDash(emp.otherEarnings)}
                  </td>
                  <td className="num nowrap col-deduct">
                    {cellOrDash(emp.tax)}
                  </td>
                  <td className="num nowrap col-deduct">
                    {cellOrDash(emp.socialSecurity)}
                  </td>
                  <td className="num nowrap col-deduct">
                    {cellOrDash(emp.advance)}
                  </td>
                  <td className="num nowrap col-deduct">
                    {cellOrDash(emp.late)}
                  </td>
                  <td className="num nowrap col-deduct">
                    {cellOrDash(emp.absence)}
                  </td>
                  <td className="num nowrap col-deduct">
                    {cellOrDash(emp.otherDeductions)}
                  </td>
                  <td className="num nowrap col-net">
                    <strong>{formatThb(emp.netPay)}</strong>
                  </td>
                  <td>{emp.hasPayslip ? "ออกแล้ว" : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className="col-sticky-name">รวม</th>
                <th className="num col-earn">
                  {formatThb(totals.baseEarnings)}
                </th>
                <th className="num col-earn">{cellOrDash(totals.overtime)}</th>
                <th className="num col-earn">
                  {cellOrDash(totals.advancePayout)}
                </th>
                <th className="num col-earn">
                  {cellOrDash(totals.otherEarnings)}
                </th>
                <th className="num col-deduct">{cellOrDash(totals.tax)}</th>
                <th className="num col-deduct">
                  {cellOrDash(totals.socialSecurity)}
                </th>
                <th className="num col-deduct">{cellOrDash(totals.advance)}</th>
                <th className="num col-deduct">{cellOrDash(totals.late)}</th>
                <th className="num col-deduct">{cellOrDash(totals.absence)}</th>
                <th className="num col-deduct">{cellOrDash(totals.other)}</th>
                <th className="num col-net">{formatThb(totals.net)}</th>
                <th />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
