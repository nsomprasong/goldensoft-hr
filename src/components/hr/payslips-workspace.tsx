"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import EmployeeAvatar from "@/components/hr/employee-avatar";
import EmployeeNameLabel from "@/components/hr/employee-name-label";
import Field, { fieldProps } from "@/components/hr/field";
import { formatThb } from "@/lib/hr/money";
import type {
  PayslipListItem,
  PayslipPeriodOption,
} from "@/lib/hr/services/payroll-runs";
import { formatThaiDateReadable } from "@/lib/hr/thai-date";

export default function PayslipsWorkspace({
  payslips,
  periods,
  selectedPeriodId,
  detailBasePath = "/hr/payslips",
  basePath = "/hr/payslips",
  showBranchLabel = false,
}: {
  payslips: PayslipListItem[];
  periods: PayslipPeriodOption[];
  selectedPeriodId: string | null;
  detailBasePath?: string;
  basePath?: string;
  showBranchLabel?: boolean;
}) {
  const router = useRouter();
  const filtered = selectedPeriodId
    ? payslips.filter((row) => row.payrollPeriodId === selectedPeriodId)
    : payslips;
  const selected = periods.find((row) => row.id === selectedPeriodId) ?? null;

  return (
    <>
      {periods.length > 0 ? (
        <div className="hr-payslip-period-filter">
          <Field id="payslip-period" label="งวดจ่าย" hint="ค่าเริ่มต้น = งวดปัจจุบัน">
            <select
              {...fieldProps("payslip-period")}
              value={selectedPeriodId ?? ""}
              onChange={(event) => {
                const next = event.target.value;
                router.replace(
                  next ? `${basePath}?periodId=${encodeURIComponent(next)}` : basePath,
                );
              }}
            >
              {periods.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                  {opt.scheduleName ? ` · ${opt.scheduleName}` : ""}
                  {opt.isCurrent ? " (งวดปัจจุบัน)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="empty">
          {selected
            ? `ยังไม่มีสลิปในงวด ${selected.label}`
            : "ยังไม่มีสลิปเงินเดือน"}
        </p>
      ) : (
        <div className="hr-card-grid">
          {filtered.map((row) => (
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
                    <p className="hr-entity-card-subtitle">{row.scheduleName}</p>
                  </div>
                </div>
              </div>

              <dl className="hr-entity-card-meta">
                <div>
                  <dt>งวด</dt>
                  <dd>{row.periodLabel}</dd>
                </div>
                <div>
                  <dt>สุทธิ</dt>
                  <dd>{formatThb(row.netPay)}</dd>
                </div>
                <div>
                  <dt>ออกเมื่อ</dt>
                  <dd>
                    {row.issuedAt ? formatThaiDateReadable(row.issuedAt) : "—"}
                  </dd>
                </div>
              </dl>

              <div className="hr-entity-card-actions">
                <Link className="btn btn-sm" href={`${detailBasePath}/${row.id}`}>
                  เปิดดู
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
