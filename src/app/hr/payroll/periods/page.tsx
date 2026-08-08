import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import HrPageBackButton from "@/components/hr/hr-page-back-button";
import PayrollPeriodForm from "@/components/hr/payroll-period-form";
import HrShell from "@/components/hr-shell";
import { IconOpen } from "@/components/ui/action-icons";
import {
  combineAvailability,
  listPayrollPeriods,
  listPayrollSchedules,
  type PayrollPeriodRow,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import {
  formatThaiDate,
  formatThaiDateRange,
  parseDateParts,
} from "@/lib/hr/thai-date";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const THAI_MONTH_LONG = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

function single(params: SearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function bangkokMonthKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function monthKeyFromIso(value: string): string | null {
  const parts = parseDateParts(value);
  if (!parts) return null;
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return monthKey;
  return `${THAI_MONTH_LONG[month - 1]} ${year + 543}`;
}

function collectMonthOptions(rows: PayrollPeriodRow[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    const start = monthKeyFromIso(row.periodStart);
    const end = monthKeyFromIso(row.periodEnd);
    if (start) keys.add(start);
    if (end) keys.add(end);
  }
  keys.add(bangkokMonthKey());
  return [...keys].sort((a, b) => b.localeCompare(a));
}

function filterByMonth(
  rows: PayrollPeriodRow[],
  monthKey: string,
): PayrollPeriodRow[] {
  if (!monthKey) return rows;
  return rows.filter((row) => {
    const start = monthKeyFromIso(row.periodStart);
    const end = monthKeyFromIso(row.periodEnd);
    return start === monthKey || end === monthKey;
  });
}

export default async function PayrollPeriodsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireHrPage({
    permission: HR_PERMISSIONS.payrollPeriodRead,
  });
  const params = await searchParams;
  // Empty = แสดงทั้งหมด; YYYY-MM = filter by that month.
  const monthFilter = single(params, "month");

  const [periods, schedules] = await Promise.all([
    listPayrollPeriods(ctx),
    listPayrollSchedules(ctx),
  ]);
  const availability = combineAvailability(periods, schedules);
  const canManage = canHr(ctx, HR_PERMISSIONS.payrollPeriodManage);
  const monthOptions = collectMonthOptions(periods.data);
  const filtered = filterByMonth(periods.data, monthFilter);
  const filterLabel = monthFilter
    ? formatMonthLabel(monthFilter)
    : "ทั้งหมด";

  return (
    <HrShell ctx={ctx} active="payroll-periods">
      <div className="hr-page-head">
        <div>
          <h1>งวดเงินเดือน</h1>
          <p>
            องค์กร {ctx.organizationName} — {filterLabel} ({filtered.length} งวด)
          </p>
        </div>
        <HrPageBackButton href="/hr" />
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      <form className="card" method="get" action="/hr/payroll/periods">
        <div className="filters">
          <div className="field">
            <label htmlFor="month">เดือน</label>
            <select id="month" name="month" defaultValue={monthFilter}>
              <option value="">แสดงทั้งหมด</option>
              {monthOptions.map((key) => (
                <option key={key} value={key}>
                  {formatMonthLabel(key)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <button type="submit" className="btn btn-primary">
              แสดง
            </button>
          </div>
        </div>
      </form>

      {filtered.length === 0 ? (
        <p className="empty">
          {periods.data.length === 0
            ? "ยังไม่มีงวดเงินเดือน — กด + เพื่อสร้างงวดจ่าย"
            : "ไม่พบงวดเงินเดือนในเดือนที่เลือก"}
        </p>
      ) : (
        <div className="hr-card-grid">
          {filtered.map((row) => (
            <article key={row.id} className="card hr-entity-card">
              <div className="hr-entity-card-top">
                <div className="hr-entity-card-title-wrap">
                  <h2 className="hr-entity-card-title">{row.scheduleName}</h2>
                  <p className="hr-entity-card-subtitle">
                    {formatThaiDateRange(row.periodStart, row.periodEnd)}
                  </p>
                </div>
                <span
                  className={
                    row.statusCode === "LOCKED"
                      ? "badge badge-inactive"
                      : row.statusCode === "APPROVED" ||
                          row.statusCode === "PAID"
                        ? "badge badge-active"
                        : "badge"
                  }
                >
                  {row.statusNameTh}
                </span>
              </div>

              <dl className="hr-entity-card-meta">
                <div>
                  <dt>วันเริ่มงวด</dt>
                  <dd>{formatThaiDate(row.periodStart)}</dd>
                </div>
                <div>
                  <dt>วันสิ้นงวด</dt>
                  <dd>{formatThaiDate(row.periodEnd)}</dd>
                </div>
                <div>
                  <dt>วันจ่ายเงิน</dt>
                  <dd>{formatThaiDate(row.paymentDate)}</dd>
                </div>
              </dl>

              <div className="hr-entity-card-actions">
                <Link
                  className="btn btn-sm btn-tab"
                  href={`/hr/payroll/periods/${row.id}`}
                >
                  <span className="btn-icon" aria-hidden="true">
                    <IconOpen size={15} />
                  </span>
                  <span className="btn-label">เปิดดู</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {canManage ? (
        <PayrollPeriodForm
          disabled={!availability.available}
          schedules={schedules.data
            .filter((s) => s.isActive)
            .map((s) => ({ id: s.id, label: s.name }))}
        />
      ) : null}
    </HrShell>
  );
}
