import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import {
  DashboardMeter,
  clampPercent,
  parseLimitValue,
} from "@/components/hr/dashboard-meter";
import HrShell from "@/components/hr-shell";
import { loadHrDashboard } from "@/lib/hr/data";
import { HR_ENTITLEMENTS } from "@/lib/hr/entitlements";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import { formatThaiDate, formatThaiDateRange } from "@/lib/hr/thai-date";

export const dynamic = "force-dynamic";

function dashHref(branchId: string | null, path: string): string {
  if (!branchId) return path;
  if (path.startsWith("/hr/schedules")) {
    return `/hr/schedules?branchId=${encodeURIComponent(branchId)}`;
  }
  if (path.startsWith("/hr/employees")) {
    return `/hr/employees?branchId=${encodeURIComponent(branchId)}`;
  }
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}branchId=${encodeURIComponent(branchId)}`;
}

function formatInboxWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatThaiDate(iso.slice(0, 10));
  } catch {
    return "—";
  }
}

function ActionTile({
  href,
  label,
  value,
  hint,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  hint?: string;
  tone: "amber" | "blue" | "green" | "violet" | "rose";
}) {
  const urgent = value > 0;
  return (
    <Link
      className={`hr-dash-action hr-dash-action--${tone}${urgent ? " hr-dash-action--urgent" : ""}`}
      href={href}
    >
      <span className="hr-dash-action-label">{label}</span>
      <span className="hr-dash-action-value">{value}</span>
      {hint ? <span className="hr-dash-action-hint">{hint}</span> : null}
    </Link>
  );
}

export default async function HrDashboardPage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.employeeRead });
  const branchId = ctx.branchId ?? null;

  const dashboard = await loadHrDashboard(ctx, { branchId });
  const stats = dashboard.data;
  const actions = stats.actions;
  const employeeLimitRaw =
    ctx.entitlements[HR_ENTITLEMENTS.employeeLimit]?.value ?? "—";
  const employeeLimit = parseLimitValue(employeeLimitRaw);
  const quotaPercent =
    employeeLimit != null && employeeLimit > 0
      ? clampPercent((stats.activeEmployees / employeeLimit) * 100)
      : null;
  const branchForLinks = branchId;
  const headcountTotal = Math.max(
    stats.activeEmployees,
    stats.byBranch.reduce((sum, row) => sum + row.count, 0),
    1,
  );
  const employmentTotal = Math.max(
    stats.byEmploymentType.reduce((sum, row) => sum + row.count, 0),
    1,
  );

  const canApprove = canHr(ctx, [
    HR_PERMISSIONS.approvalRead,
    HR_PERMISSIONS.leaveApprove,
    HR_PERMISSIONS.overtimeApprove,
  ]);
  const canManageEmployees = canHr(ctx, HR_PERMISSIONS.employeeRead);
  const canManageSchedule = canHr(ctx, HR_PERMISSIONS.scheduleRead);
  const canManageAttendance = canHr(ctx, HR_PERMISSIONS.attendanceRead);
  const canManagePayroll = canHr(ctx, HR_PERMISSIONS.payrollRead);
  const canLeaveSettings = canHr(ctx, HR_PERMISSIONS.leaveManage);

  const scopeLabel = ctx.branch
    ? `สาขา ${ctx.branch.name}`
    : "ทุกสาขาที่มีสิทธิ์";

  return (
    <HrShell ctx={ctx} active="dashboard">
      <div className="hr-dash">
        <header className="hr-dash-hero">
          <div className="hr-dash-hero-copy">
            <p className="hr-dash-kicker">GoldenSoft HR</p>
            <h1>แดชบอร์ด</h1>
            <p>
              ศูนย์สั่งการ {ctx.organizationName}
              <span className="hr-dash-hero-sep">·</span>
              {scopeLabel}
            </p>
          </div>
        </header>

        <DatabaseUnavailableNotice message={dashboard.message} />

        <section className="hr-dash-section" aria-label="ต้องทำวันนี้">
          <div className="hr-dash-section-head">
            <h2>ต้องทำวันนี้</h2>
            <p>คิวที่รอการอนุมัติหรือแก้ไข</p>
          </div>
          <div className="hr-dash-action-grid">
            <ActionTile
              href="/hr/leave"
              label="ลารออนุมัติ"
              value={actions.pendingLeave}
              tone="amber"
            />
            <ActionTile
              href="/hr/overtime"
              label="OT รออนุมัติ"
              value={actions.pendingOvertime}
              tone="violet"
            />
            <ActionTile
              href="/hr/approvals"
              label="ปรับเวลาลงเวลา"
              value={actions.pendingAttendanceAdjustments}
              tone="blue"
            />
            <ActionTile
              href="/hr/attendance"
              label="ลงเวลาผิดปกติ"
              value={actions.attendanceExceptionsToday}
              hint={`ลืมลงออก ${actions.missingClockOutToday}`}
              tone="rose"
            />
            <ActionTile
              href={dashHref(branchForLinks, "/hr/schedules")}
              label="ตารางร่าง"
              value={actions.draftSchedules}
              tone="green"
            />
            <ActionTile
              href="/hr/payroll/periods"
              label="เตือนงวดเงินเดือน"
              value={actions.payrollWarnings}
              hint="ใกล้วันจ่าย / ค้างขั้น"
              tone="amber"
            />
          </div>
        </section>

        <nav className="hr-dash-shortcuts" aria-label="ทางลัด">
          {canApprove ? (
            <Link className="hr-dash-chip" href="/hr/approvals">
              คิวอนุมัติ
            </Link>
          ) : null}
          {canManageEmployees ? (
            <Link
              className="hr-dash-chip"
              href={dashHref(branchForLinks, "/hr/employees")}
            >
              พนักงาน
            </Link>
          ) : null}
          {canManageSchedule ? (
            <Link
              className="hr-dash-chip"
              href={dashHref(branchForLinks, "/hr/schedules")}
            >
              ตารางกะ
            </Link>
          ) : null}
          {canManageAttendance ? (
            <Link className="hr-dash-chip" href="/hr/attendance">
              ลงเวลา
            </Link>
          ) : null}
          {canManagePayroll ? (
            <Link className="hr-dash-chip" href="/hr/payroll/periods">
              เงินเดือน
            </Link>
          ) : null}
          {canLeaveSettings ? (
            <Link
              className="hr-dash-chip"
              href="/hr/settings/leave-entitlements"
            >
              สิทธิ์วันลา
            </Link>
          ) : null}
        </nav>

        {canApprove && stats.recentInbox.length > 0 ? (
          <section className="hr-dash-panel">
            <div className="hr-dash-panel-head">
              <div>
                <h2>คิอล่าสุด</h2>
                <p>รายการรออนุมัติล่าสุด</p>
              </div>
              <Link className="btn btn-sm" href="/hr/approvals">
                เปิดคิวทั้งหมด
              </Link>
            </div>
            <ul className="hr-dash-inbox">
              {stats.recentInbox.map((row) => (
                <li key={`${row.kind}:${row.id}`}>
                  <div>
                    <strong>{row.employeeName}</strong>
                    <span>{row.label}</span>
                  </div>
                  <div className="hr-dash-inbox-meta">
                    <time>{formatInboxWhen(row.submittedAt)}</time>
                    <Link className="btn btn-sm" href={row.href}>
                      เปิด
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="hr-dash-section" aria-label="สุขภาพองค์กร">
          <div className="hr-dash-section-head">
            <h2>สุขภาพองค์กร</h2>
            <p>โควตา คน และสถานะงวดปัจจุบัน</p>
          </div>

          <div className="hr-dash-pulse-grid">
            <article className="hr-dash-panel hr-dash-panel--accent">
              <h3>โควตาพนักงาน</h3>
              <p className="hr-dash-big">
                {stats.activeEmployees}
                <span>
                  {employeeLimit != null
                    ? ` / ${employeeLimit}`
                    : ` / ${employeeLimitRaw}`}
                </span>
              </p>
              {quotaPercent != null ? (
                <DashboardMeter
                  valueLabel={`${Math.round(quotaPercent)}% ของโควตาแพ็กเกจ`}
                  percent={quotaPercent}
                />
              ) : (
                <p className="muted">ไม่จำกัดโควตา หรือยังไม่มีค่าแพ็กเกจ</p>
              )}
            </article>

            <article className="hr-dash-panel">
              <h3>กะที่เปิดใช้</h3>
              <p className="hr-dash-big">{stats.activeShifts}</p>
              <p className="muted">ใช้จัดตารางงานตามสาขา</p>
            </article>

            <article className="hr-dash-panel">
              <h3>ทดลองงานใกล้ครบ</h3>
              <p className="hr-dash-big">{actions.probationEndingSoon}</p>
              <p className="muted">ครบกำหนดใน 30 วัน</p>
            </article>

            <article className="hr-dash-panel">
              <div className="hr-dash-panel-head">
                <div>
                  <h3>งวดเงินเดือนปัจจุบัน</h3>
                </div>
                {stats.currentPeriod ? (
                  <Link
                    className="btn btn-sm"
                    href={`/hr/payroll/periods/${stats.currentPeriod.id}`}
                  >
                    เปิดงวด
                  </Link>
                ) : null}
              </div>
              {stats.currentPeriod ? (
                <dl className="hr-dash-dl">
                  <div>
                    <dt>รอบจ่าย</dt>
                    <dd>{stats.currentPeriod.scheduleName}</dd>
                  </div>
                  <div>
                    <dt>ช่วงงวด</dt>
                    <dd>
                      {formatThaiDateRange(
                        stats.currentPeriod.periodStart,
                        stats.currentPeriod.periodEnd,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>วันจ่าย</dt>
                    <dd>{formatThaiDate(stats.currentPeriod.paymentDate)}</dd>
                  </div>
                  <div>
                    <dt>สถานะ</dt>
                    <dd>
                      <span className="badge">
                        {stats.currentPeriod.statusNameTh}
                      </span>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="empty">ยังไม่มีงวดที่ครอบคลุมวันนี้</p>
              )}
            </article>
          </div>
        </section>

        <div className="hr-dash-split">
          <section className="hr-dash-panel">
            <h2>พนักงานตามสาขา</h2>
            {stats.byBranch.length === 0 ? (
              <p className="empty">ยังไม่มีข้อมูลพนักงาน</p>
            ) : (
              <ul className="hr-dash-share-list">
                {stats.byBranch.map((row) => {
                  const percent = clampPercent(
                    (row.count / headcountTotal) * 100,
                  );
                  return (
                    <li key={row.branchId}>
                      <DashboardMeter
                        label={row.branchName}
                        valueLabel={`${row.count} คน · ${Math.round(percent)}%`}
                        percent={percent}
                        tone="neutral"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="hr-dash-panel">
            <h2>พนักงานตามประเภทการจ้าง</h2>
            {stats.byEmploymentType.length === 0 ? (
              <p className="empty">ยังไม่มีข้อมูลพนักงาน</p>
            ) : (
              <ul className="hr-dash-share-list">
                {stats.byEmploymentType.map((row) => {
                  const percent = clampPercent(
                    (row.count / employmentTotal) * 100,
                  );
                  return (
                    <li key={row.code}>
                      <DashboardMeter
                        label={row.nameTh}
                        valueLabel={`${row.count} คน · ${Math.round(percent)}%`}
                        percent={percent}
                        tone="neutral"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {canHr(ctx, HR_PERMISSIONS.employeeCreate) ? (
        <Link
          className="hr-fab"
          href="/hr/employees/new"
          aria-label="เพิ่มพนักงาน"
          title="เพิ่มพนักงาน"
        >
          <span aria-hidden="true">+</span>
        </Link>
      ) : null}
    </HrShell>
  );
}
