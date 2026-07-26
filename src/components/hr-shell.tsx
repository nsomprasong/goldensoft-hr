import Link from "next/link";
import type { ReactNode } from "react";

import { canHr, HR_PERMISSIONS, type HrPermission } from "@/lib/hr/permissions";
import type { HrRequestContext } from "@/lib/platform/types";

export type HrNavKey =
  | "dashboard"
  | "employees"
  | "departments"
  | "positions"
  | "shifts"
  | "overtime-rules"
  | "payroll-schedules"
  | "payroll-periods";

type NavItem = {
  key: HrNavKey;
  label: string;
  href: string;
  permission: HrPermission | null;
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "แดชบอร์ด", href: "/", permission: null },
  {
    key: "employees",
    label: "พนักงาน",
    href: "/employees",
    permission: HR_PERMISSIONS.employeeRead,
  },
  {
    key: "departments",
    label: "แผนก",
    href: "/settings/departments",
    permission: HR_PERMISSIONS.departmentRead,
  },
  {
    key: "positions",
    label: "ตำแหน่ง",
    href: "/settings/positions",
    permission: HR_PERMISSIONS.positionRead,
  },
  {
    key: "shifts",
    label: "กะงาน",
    href: "/settings/shifts",
    permission: HR_PERMISSIONS.shiftRead,
  },
  {
    key: "overtime-rules",
    label: "กฎ OT",
    href: "/settings/overtime-rules",
    permission: HR_PERMISSIONS.settingsManage,
  },
  {
    key: "payroll-schedules",
    label: "รอบจ่าย",
    href: "/settings/payroll-schedules",
    permission: HR_PERMISSIONS.payrollScheduleRead,
  },
  {
    key: "payroll-periods",
    label: "งวดเงินเดือน",
    href: "/payroll/periods",
    permission: HR_PERMISSIONS.payrollPeriodRead,
  },
];

export function visibleHrNavItems(ctx: {
  permissions: readonly string[];
  platformRoles: readonly string[];
}): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => item.permission === null || canHr(ctx, item.permission),
  );
}

function NavLinks({
  items,
  active,
}: {
  items: NavItem[];
  active?: HrNavKey;
}) {
  return (
    <nav className="hr-nav" aria-label="เมนูหลัก">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default function HrShell({
  ctx,
  active,
  children,
}: {
  ctx: HrRequestContext;
  active?: HrNavKey;
  children: ReactNode;
}) {
  const items = visibleHrNavItems(ctx);

  return (
    <div className="hr-shell">
      <header className="hr-header">
        <div className="hr-header-inner">
          <div className="hr-header-top">
            <Link href="/" className="hr-brand">
              GoldenSoft HR
            </Link>
            <div className="hr-context">
              <div>
                {ctx.organizationName}
                {ctx.branch ? ` · สาขา ${ctx.branch.name}` : " · ทุกสาขา"}
              </div>
              <div>{ctx.profile?.displayName ?? ctx.email ?? "ผู้ใช้งาน"}</div>
            </div>
          </div>

          <div className="hr-nav-desktop">
            <NavLinks items={items} active={active} />
          </div>

          <details className="hr-nav-mobile">
            <summary>เมนู</summary>
            <NavLinks items={items} active={active} />
          </details>
        </div>
      </header>

      <main className="hr-main">{children}</main>
    </div>
  );
}
