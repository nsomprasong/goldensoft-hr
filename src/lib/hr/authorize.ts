/**
 * Pure authorization helpers shared by pages, API routes and domain services.
 *
 * This module must stay free of `server-only` imports so domain tests can run
 * it under plain Node without a Next.js request scope.
 */
import { HrError } from "@/lib/hr/errors";
import { canHr, type HrPermission } from "@/lib/hr/permissions";

export type HrAccessContext = {
  organizationId: string;
  branchId: string | null;
  permissions: readonly string[];
  platformRoles: readonly string[];
  contextMode: "membership" | "platform_admin";
  /** Null means every branch of the organization is in scope. */
  allowedBranchIds?: readonly string[] | null;
};

export function isPlatformAdmin(ctx: HrAccessContext): boolean {
  return ctx.platformRoles.includes("SUPER_ADMIN");
}

export function hrCan(
  ctx: HrAccessContext,
  permission: HrPermission | readonly HrPermission[],
): boolean {
  return canHr(ctx, permission);
}

/** Throws FORBIDDEN unless the actor holds one of the required permissions. */
export function assertHrPermission(
  ctx: HrAccessContext,
  permission: HrPermission | readonly HrPermission[],
): void {
  if (hrCan(ctx, permission)) return;
  const required = Array.isArray(permission)
    ? (permission as readonly HrPermission[])
    : [permission as HrPermission];
  throw new HrError("FORBIDDEN", { details: { required } });
}

/**
 * Branch scope check. SUPER_ADMIN acting in platform_admin mode is exempt;
 * every other caller is limited to the resolved allow-list.
 */
export function assertBranchInScope(
  ctx: HrAccessContext,
  branchId: string | null | undefined,
): void {
  if (!branchId) return;
  if (isPlatformAdmin(ctx) && ctx.contextMode === "platform_admin") return;

  // A null allow-list means the whole organization is in scope, so the caller's
  // currently-selected branch must not narrow what they may act on.
  const allowed = ctx.allowedBranchIds;
  if (allowed == null) return;

  if (!allowed.includes(branchId)) {
    throw new HrError("BRANCH_OUT_OF_SCOPE", { details: { branchId } });
  }
}

/**
 * When the shell header has a specific branch selected, operational records
 * (schedules, etc.) must belong to that branch — even for org-wide admins.
 * "ทุกสาขา" (null selection) skips this filter.
 */
export function assertMatchesSelectedBranch(
  ctx: HrAccessContext,
  recordBranchId: string | null | undefined,
): void {
  if (!ctx.branchId || !recordBranchId) return;
  if (ctx.branchId === recordBranchId) return;
  throw new HrError("BRANCH_OUT_OF_SCOPE", {
    details: {
      branchId: recordBranchId,
      selectedBranchId: ctx.branchId,
    },
  });
}

/** Guard against records that leaked in from another tenant. */
export function assertSameOrganization(
  ctx: HrAccessContext,
  organizationId: string | null | undefined,
): void {
  if (!organizationId || organizationId !== ctx.organizationId) {
    throw new HrError("NOT_FOUND");
  }
}
