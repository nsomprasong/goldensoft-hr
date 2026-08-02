import Link from "next/link";
import { redirect } from "next/navigation";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import {
  DashboardMeter,
  clampPercent,
  parseLimitValue,
} from "@/components/hr/dashboard-meter";
import HrShell from "@/components/hr-shell";
import {
  resolveAllowedBranchIds,
  showEmployeeBranchLabel,
} from "@/lib/hr/api";
import { loadHrDashboard } from "@/lib/hr/data";
import { HR_ENTITLEMENTS } from "@/lib/hr/entitlements";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";
import {
  formatThaiDateReadable,
  formatThaiDateRangeReadable,
} from "@/lib/hr/thai-date";

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
    return formatThaiDateReadable(iso.slice(0, 10));
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
  const ctx = await requireHrPage({
    permission: [
      HR_PERMISSIONS.employeeRead,
      HR_PERMISSIONS.approvalRead,
      HR_PERMISSIONS.leaveApprove,
      HR_PERMISSIONS.attendanceRead,
      HR_PERMISSIONS.attendanceSelf,
    ],
  });

  const canManageEmployees = canHr(ctx, HR_PERMISSIONS.employeeRead);
  const canApprove = canHr(ctx, [
    HR_PERMISSIONS.approvalRead,
    HR_PERMISSIONS.leaveApprove,
    HR_PERMISSIONS.overtimeApprove,
  ]);
  const canManageAttendance = canHr(ctx, HR_PERMISSIONS.attendanceRead);
  const isBranchOps = canApprove || canManageAttendance;

  // Plain employees (self-service only) go to their clock-in page.
  if (!canManageEmployees && !isBranchOps) {
    redirect("/hr/me/attendance");
  }

  const allowedBranches = resolveAllowedBranchIds(ctx);
  const branchId =
    ctx.branchId &&
    (allowedBranches == null || allowedBranches.includes(ctx.branchId))
      ? ctx.branchId
      : allowedBranches?.length === 1
        ? allowedBranches[0]!
        : null;
  const dashboard = await loadHrDashboard(ctx, { branchId });
  const stats = dashboard.data;
  const actions = stats.actions;
  const canApproveAdvances = canHr(ctx, [
    HR_PERMISSIONS.advanceApprove,
    HR_PERMISSIONS.payrollManage,
    HR_PERMISSIONS.approvalRead,
  ]);
  const showBranchLabel = showEmployeeBranchLabel(ctx);
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

  const canManageSchedule = canHr(ctx, HR_PERMISSIONS.scheduleManage);
  const canManagePayroll = canHr(ctx, HR_PERMISSIONS.payrollRead);
  const canLeaveSettings = canHr(ctx, HR_PERMISSIONS.leaveManage);
  const canSelfAttendance = canHr(ctx, HR_PERMISSIONS.attendanceSelf);

  const scopeLabel =
    ctx.branch && (!branchId || ctx.branch.id === branchId)
      ? `สาขา ${ctx.branch.name}`
      : branchId
        ? "สาขาที่คุณดูแล"
        : "ทุกสาขาที่มีสิทธิ์";
  const heroTitle = canManageEmployees ? "แดชบอร์ด" : "แดชบอร์ดสาขา";
  const heroSubtitle = canManageEmployees
    ? `ศูนย์สั่งการ ${ctx.organizationName}`
    : `งานที่ต้องดูแล · ${ctx.organizationName}`;

  return (
    <HrShell ctx={ctx} active="dashboard">
      <div className="hr-dash">
        <header className="hr-dash-hero">
          <div className="hr-dash-hero-copy">
            <p className="hr-dash-kicker">GoldenSoft HR</p>
            <h1>{heroTitle}</h1>
            <p>
              {heroSubtitle}
              <span className="hr-dash-hero-sep">·</span>
              {scopeLabel}
            </p>
          </div>
        </header>

        <DatabaseUnavailableNotice message={dashboard.message} />

        <section className="hr-dash-section" aria-label="ต้องทำวันนี้">
          <div className="hr-dash-section-head">
            <h2>ต้องทำวันนี้</h2>
            <p>
              {canManageEmployees
                ? "คิวที่รอการอนุมัติหรือแก้ไข"
                : "คิวอนุมัติและลงเวลาผิดปกติในสาขา"}
            </p>
          </div>
          <div className="hr-dash-action-grid">
            {canApprove ? (
              <>
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
              </>
            ) : null}
            {canApproveAdvances ? (
              <ActionTile
                href="/hr/approvals?tab=advance"
                label="เบิกรออนุมัติ"
                value={actions.pendingAdvances}
                tone="green"
              />
            ) : null}
            {canManageAttendance ? (
              <ActionTile
                href="/hr/attendance"
                label="ลงเวลาผิดปกติ"
                value={actions.attendanceExceptionsToday}
                hint={`ลืมลงออก ${actions.missingClockOutToday}`}
                tone="rose"
              />
            ) : null}
            {canManageSchedule ? (
              <ActionTile
                href={dashHref(branchForLinks, "/hr/schedules")}
                label="ตารางร่าง"
                value={actions.draftSchedules}
                tone="green"
              />
            ) : null}
            {canManagePayroll ? (
              <ActionTile
                href="/hr/payroll/periods"
                label="เตือนงวดเงินเดือน"
                value={actions.payrollWarnings}
                hint="ใกล้วันจ่าย / ค้างขั้น"
                tone="amber"
              />
            ) : null}
          </div>
        </section>

        <nav className="hr-dash-shortcuts" aria-label="ทางลัด">
          {canApprove ? (
            <Link className="hr-dash-chip" href="/hr/approvals">
              คิวอนุมัติ
            </Link>
          ) : null}
          {canManageAttendance ? (
            <Link className="hr-dash-chip" href="/hr/attendance">
              ลงเวลาสาขา
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
              ตารางงาน
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
          {canSelfAttendance ? (
            <Link className="hr-dash-chip" href="/hr/me/attendance">
              ลงเวลาของฉัน
            </Link>
          ) : null}
          {canHr(ctx, HR_PERMISSIONS.leaveSelf) ? (
            <Link className="hr-dash-chip" href="/hr/me/leave">
              ลาของฉัน
            </Link>
          ) : null}
        </nav>

        {canApprove && stats.recentInbox.length > 0 ? (
          <section className="hr-dash-panel">
            <div className="hr-dash-panel-head">
              <div>
                <h2>คิอล่าสุด</h2>
                <p>เรียงตามสาขา · รายการรออนุมัติล่าสุด</p>
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
                    {showBranchLabel ? (
                      <span className="hr-dash-inbox-branch">
                        {row.branchName}
                      </span>
                    ) : null}
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

        {canApprove && stats.recentDecisions.length > 0 ? (
          <section className="hr-dash-panel">
            <div className="hr-dash-panel-head">
              <div>
                <h2>ผลอนุมัติล่าสุด</h2>
                <p>เรียงตามสาขา · แสดงตัวอย่างล่าสุด</p>
              </div>
              <Link className="btn btn-sm" href="/hr/approvals/history">
                ดูทั้งหมด
              </Link>
            </div>
            <ul className="hr-dash-inbox">
              {stats.recentDecisions.map((row) => (
                <li key={`decision:${row.kind}:${row.id}`}>
                  <div>
                    <strong>{row.employeeName}</strong>
                    {showBranchLabel ? (
                      <span className="hr-dash-inbox-branch">
                        {row.branchName}
                      </span>
                    ) : null}
                    <span>
                      {row.label} ·{" "}
                      {row.decision === "APPROVED" ? "อนุมัติ" : "ปฏิเสธ"}
                    </span>
                    <span className="muted">โดย {row.reviewedByName}</span>
                  </div>
                  <div className="hr-dash-inbox-meta">
                    <time>{formatInboxWhen(row.reviewedAt)}</time>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {canManageEmployees ? (
          <>
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
                          {formatThaiDateRangeReadable(
                            stats.currentPeriod.periodStart,
                            stats.currentPeriod.periodEnd,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>วันจ่าย</dt>
                        <dd>
                          {formatThaiDateReadable(
                            stats.currentPeriod.paymentDate,
                          )}
                        </dd>
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
          </>
        ) : (
          <section className="hr-dash-section" aria-label="สรุปสาขา">
            <div className="hr-dash-section-head">
              <h2>สรุปสาขา</h2>
              <p>ภาพรวมพนักงานและการลงเวลาในสาขาที่ดูแล</p>
            </div>
            <div className="hr-dash-pulse-grid">
              <article className="hr-dash-panel hr-dash-panel--accent">
                <h3>พนักงานในสาขา</h3>
                <p className="hr-dash-big">{stats.activeEmployees}</p>
                <p className="muted">{scopeLabel}</p>
              </article>
              <article className="hr-dash-panel">
                <h3>รออนุมัติทั้งหมด</h3>
                <p className="hr-dash-big">
                  {actions.pendingLeave +
                    actions.pendingOvertime +
                    actions.pendingAttendanceAdjustments +
                    actions.pendingAdvances}
                </p>
                <p className="muted">ลา · OT · ปรับเวลา · เบิก</p>
              </article>
              <article className="hr-dash-panel">
                <h3>ลงเวลาผิดปกติวันนี้</h3>
                <p className="hr-dash-big">
                  {actions.attendanceExceptionsToday}
                </p>
                <p className="muted">
                  ลืมลงออก {actions.missingClockOutToday} รายการ
                </p>
              </article>
            </div>
          </section>
        )}
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
