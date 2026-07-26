import Link from "next/link";
import type { ReactNode } from "react";

import { HrNavIcon, hrNavIconForPath } from "@/components/ui/icons";
import { canHr } from "@/lib/hr/permissions";
import {
  hrNavRegistry,
  hrNavRouteKey,
  type HrNavKey,
  type HrRouteDefinition,
} from "@/lib/hr/routes";
import type { HrRequestContext } from "@/lib/platform/types";

function entitlementOk(
  ctx: HrRequestContext,
  route: HrRouteDefinition,
): boolean {
  for (const code of route.requiredEntitlements) {
    const row = ctx.entitlements[code];
    // Missing entitlement check result → fail closed for nav (except access
    // which resolve-context already required to enter HR).
    if (row && row.allowed === false) return false;
  }
  return true;
}

export function visibleHrProductNav(
  ctx: HrRequestContext,
): HrRouteDefinition[] {
  return hrNavRegistry().filter((route) => {
    if (!entitlementOk(ctx, route)) return false;
    if (route.requiredPermissions.length === 0) return true;
    return canHr(ctx, route.requiredPermissions);
  });
}

function ProductNav({
  items,
  active,
}: {
  items: HrRouteDefinition[];
  active?: HrNavKey;
}) {
  const activeKey = active ? hrNavRouteKey(active) : null;
  return (
    <nav className="hr-product-nav" aria-label="เมนูผลิตภัณฑ์ HR">
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <Link
            key={item.key}
            href={item.path}
            className={[
              "shell-nav-link",
              isActive ? "active nav-row-active-services" : undefined,
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={isActive ? "page" : undefined}
          >
            {isActive ? (
              <span
                className="shell-nav-accent nav-accent-services"
                aria-hidden="true"
              />
            ) : null}
            <span
              className={[
                "shell-nav-icon",
                isActive
                  ? "nav-icon-active-services"
                  : "nav-icon-idle-services",
              ].join(" ")}
            >
              <HrNavIcon name={hrNavIconForPath(item.path)} size={18} />
            </span>
            <span className="shell-nav-label">{item.labelTh}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Product-only chrome for Unified Customer Shell embedding.
 * No global Login / Sidebar / Header / org-branch selector.
 */
export default function HrProductFrame({
  ctx,
  active,
  children,
}: {
  ctx: HrRequestContext;
  active?: HrNavKey;
  children: ReactNode;
}) {
  const items = visibleHrProductNav(ctx);

  return (
    <div className="hr-root hr-product-frame" data-hr-shell="product">
      <div className="hr-product-nav-bar">
        <div className="hr-product-nav-desktop">
          <ProductNav items={items} active={active} />
        </div>
        <details className="hr-product-nav-mobile">
          <summary>เมนู HR</summary>
          <ProductNav items={items} active={active} />
        </details>
      </div>
      <div className="hr-product-body">{children}</div>
    </div>
  );
}
