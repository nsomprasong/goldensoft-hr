import Link from "next/link";

import EmployeeAvatar from "@/components/hr/employee-avatar";
import { formatThb } from "@/lib/hr/money";
import type { PayslipDetail } from "@/lib/hr/services/payroll-runs";
import { formatThaiDate } from "@/lib/hr/thai-date";

export default function PayslipDetailView({
  payslip,
  backHref,
  backLabel,
}: {
  payslip: PayslipDetail;
  backHref: string;
  backLabel: string;
}) {
  const earnings = payslip.items.filter((i) => i.kind === "EARNING");
  const deductions = payslip.items.filter((i) => i.kind === "DEDUCTION");

  return (
    <>
      <p className="breadcrumb">
        <Link href={backHref}>{backLabel}</Link>
        {" · "}
        {payslip.displayName}
      </p>

      <article className="card payslip-print">
        <div className="hr-entity-card-top">
          <div className="hr-employee-card-head">
            <EmployeeAvatar
              displayName={payslip.displayName}
              photoUrl={payslip.photoUrl}
              size="lg"
            />
            <div className="hr-entity-card-title-wrap">
              <h1>{payslip.displayName}</h1>
              <p className="hr-entity-card-subtitle">
                {payslip.scheduleName} · {payslip.periodLabel}
              </p>
            </div>
          </div>
        </div>

        <dl className="hr-entity-card-meta" style={{ marginTop: "1rem" }}>
          <div>
            <dt>งวด</dt>
            <dd>{payslip.periodLabel}</dd>
          </div>
          <div>
            <dt>ออกเมื่อ</dt>
            <dd>
              {payslip.issuedAt ? formatThaiDate(payslip.issuedAt) : "—"}
            </dd>
          </div>
          <div>
            <dt>รายได้รวม</dt>
            <dd>{formatThb(payslip.grossEarnings)}</dd>
          </div>
          <div>
            <dt>หักรวม</dt>
            <dd>{formatThb(payslip.totalDeductions)}</dd>
          </div>
          <div>
            <dt>สุทธิ</dt>
            <dd>
              <strong>{formatThb(payslip.netPay)}</strong>
            </dd>
          </div>
        </dl>

        {earnings.length > 0 ? (
          <section style={{ marginTop: "1.25rem" }}>
            <h2>รายได้</h2>
            <ul className="hr-leave-request-list">
              {earnings.map((item, index) => (
                <li key={`e-${index}`} className="hr-leave-request-row">
                  <div className="hr-leave-request-main">
                    <strong>{item.description}</strong>
                  </div>
                  <span>{formatThb(item.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {deductions.length > 0 ? (
          <section style={{ marginTop: "1.25rem" }}>
            <h2>รายการหัก</h2>
            <ul className="hr-leave-request-list">
              {deductions.map((item, index) => (
                <li key={`d-${index}`} className="hr-leave-request-row">
                  <div className="hr-leave-request-main">
                    <strong>{item.description}</strong>
                  </div>
                  <span>−{formatThb(item.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="field-hint" style={{ marginTop: "1.25rem" }}>
          พิมพ์จากเบราว์เซอร์ได้เมื่อต้องการสำเนา
        </p>
      </article>
    </>
  );
}
