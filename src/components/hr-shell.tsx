import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import HrProductFrame, {
  visibleHrProductNav,
} from "@/components/hr/product-frame";
import { hrPath, type HrNavKey } from "@/lib/hr/routes";
import { isHrStandaloneDebugShell } from "@/lib/hr/shell-mode";
import { decodeCustomerShellMarkup } from "@/lib/platform/bootstrap-bridge";
import type { HrRequestContext } from "@/lib/platform/types";

export type { HrNavKey };
export { visibleHrProductNav as visibleHrNavItems };

/**
 * Page entry that chooses Debug Standalone Shell vs product-only frame.
 * Under Customer App (`x-gs-customer-shell` / embedded env) only ProductFrame.
 */
export default async function HrShell({
  ctx,
  active,
  children,
}: {
  ctx: HrRequestContext;
  active?: HrNavKey;
  children: ReactNode;
}) {
  const headerList = await headers();
  if (!isHrStandaloneDebugShell(process.env, headerList)) {
    const customerShell = decodeCustomerShellMarkup(
      headerList.get("x-gs-customer-shell-markup"),
    );
    return (
      <>
        {customerShell ? (
          <div
            className="gs-customer-shell-slot"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: customerShell }}
          />
        ) : null}
        <HrProductFrame ctx={ctx} active={active}>
          {children}
        </HrProductFrame>
      </>
    );
  }

  return (
    <div className="hr-shell hr-debug-shell" data-hr-shell="standalone_debug">
      <div className="hr-debug-banner" role="status">
        <strong>Debug Shell เท่านั้น</strong>
        {" — "}
        ไม่ใช่ GoldenSoft Customer App · Global Login / Sidebar / Header /
        Organization selector จะอยู่ใน <code>goldensoft-app</code> · ใช้ได้เฉพาะ
        development/debug
      </div>
      <header className="hr-header hr-debug-header">
        <div className="hr-header-inner">
          <div className="hr-header-top">
            <Link href={hrPath("dashboard")} className="hr-brand">
              GoldenSoft HR (Debug)
            </Link>
            <div className="hr-context">
              <div>
                {ctx.organizationName}
                {ctx.branch ? ` · สาขา ${ctx.branch.name}` : " · ทุกสาขา"}
              </div>
              <div>{ctx.profile?.displayName ?? ctx.email ?? "ผู้ใช้งาน"}</div>
              <div className="hr-debug-context-note">
                แสดง context จาก cookie <code>gs_platform_ctx</code> เท่านั้น ·
                ไม่มีตัวเลือกองค์กรในโมดูลนี้
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="hr-main">
        <HrProductFrame ctx={ctx} active={active}>
          {children}
        </HrProductFrame>
      </main>
    </div>
  );
}
