import {
  HR_ENTITLEMENTS,
  resolveHrProductCode,
} from "@/lib/hr/entitlements";
import { hrPermissionsForOrganizationRoles } from "@/lib/hr/permissions";
import {
  decodePlatformContextCookie,
  PLATFORM_CONTEXT_COOKIE_NAME,
} from "@/lib/platform/context-cookie";
import {
  isInactiveSubscriptionStatus,
  PlatformIntegrationError,
} from "@/lib/platform/errors";
import type {
  HrRequestContext,
  PlatformClient,
  PlatformForwardHeaders,
} from "@/lib/platform/types";

export type ResolveHrContextInput = {
  cookieHeader: string;
  clientOrganizationId?: string | null;
  requiredBranchId?: string | null;
  platformClient: PlatformClient;
  /** Explicit allow-list for branch scope checks (tests / enriched loaders). */
  allowedBranchIds?: string[] | null;
  /** Local ALLOW_TEST_AUTH headers forwarded to Platform (never trusted alone). */
  forwardHeaders?: PlatformForwardHeaders;
};

export function parseCookieValue(
  cookieHeader: string,
  name: string,
): string | null {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq) === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

/**
 * Resolve authenticated HR tenant context from Platform.
 * Never trusts client organizationId / branchId without verification.
 */
export async function resolveHrRequestContext(
  input: ResolveHrContextInput,
): Promise<HrRequestContext> {
  const me = await input.platformClient.getMe(
    input.cookieHeader,
    input.forwardHeaders,
  );

  if (!me.profile) {
    throw new PlatformIntegrationError("PROFILE_NOT_FOUND");
  }
  if (me.profile.statusCode !== "ACTIVE") {
    throw new PlatformIntegrationError("PROFILE_SUSPENDED");
  }

  const cookie = decodePlatformContextCookie(
    parseCookieValue(input.cookieHeader, PLATFORM_CONTEXT_COOKIE_NAME),
  );

  const isSuper = me.platformRoles.includes("SUPER_ADMIN");
  const cookieMembership = cookie?.organizationId
    ? me.memberships.find((m) => m.organizationId === cookie.organizationId)
    : null;
  const cookieUsable =
    !cookie ||
    Boolean(cookieMembership) ||
    (isSuper && cookie.mode === "platform_admin");

  // Prefer bridge/Platform active org when gs_platform_ctx is from another user.
  const organizationId = cookieUsable
    ? (cookie?.organizationId ?? me.activeOrganization?.id ?? null)
    : (me.activeOrganization?.id ?? null);
  if (!organizationId) {
    throw new PlatformIntegrationError("TENANT_CONTEXT_REQUIRED");
  }

  if (
    input.clientOrganizationId &&
    input.clientOrganizationId !== organizationId
  ) {
    throw new PlatformIntegrationError("CLIENT_ORG_MISMATCH");
  }

  const membership = me.memberships.find(
    (m) => m.organizationId === organizationId,
  );
  const contextMode =
    cookieUsable && cookie?.mode === "platform_admin" && isSuper
      ? ("platform_admin" as const)
      : ("membership" as const);

  if (!membership && contextMode !== "platform_admin") {
    throw new PlatformIntegrationError("FORBIDDEN");
  }

  const branchId = cookieUsable
    ? (cookie?.branchId ?? me.activeBranch?.id ?? null)
    : (me.activeBranch?.id ?? null);
  if (input.requiredBranchId && contextMode !== "platform_admin") {
    const allowed = input.allowedBranchIds;
    if (allowed != null) {
      if (!allowed.includes(input.requiredBranchId)) {
        throw new PlatformIntegrationError("BRANCH_OUT_OF_SCOPE");
      }
    } else if (branchId && input.requiredBranchId !== branchId) {
      throw new PlatformIntegrationError("BRANCH_OUT_OF_SCOPE");
    } else if (!branchId) {
      throw new PlatformIntegrationError("BRANCH_OUT_OF_SCOPE");
    }
  }

  const productCode = resolveHrProductCode();
  const [access, employeeLimit] = await Promise.all([
    input.platformClient.checkEntitlement(
      input.cookieHeader,
      {
        organizationId,
        productCode,
        entitlementCode: HR_ENTITLEMENTS.access,
        branchId,
      },
      input.forwardHeaders,
    ),
    input.platformClient.checkEntitlement(
      input.cookieHeader,
      {
        organizationId,
        productCode,
        entitlementCode: HR_ENTITLEMENTS.employeeLimit,
        branchId,
      },
      input.forwardHeaders,
    ),
  ]);

  if (!access.allowed) {
    if (
      access.subscriptionStatus &&
      isInactiveSubscriptionStatus(access.subscriptionStatus)
    ) {
      throw new PlatformIntegrationError("SUBSCRIPTION_INACTIVE");
    }
    throw new PlatformIntegrationError("PRODUCT_NOT_ENTITLED");
  }

  const membershipRoles = membership?.roles ?? [];
  const hrPermissions = hrPermissionsForOrganizationRoles(
    contextMode === "platform_admin" ? ["OWNER"] : membershipRoles,
  );
  const membershipBranchIds = Array.isArray(membership?.branches)
    ? membership.branches.map((row) => row.id)
    : null;

  return {
    authUserId: me.user.id,
    email: me.user.email,
    profile: me.profile,
    platformRoles: me.platformRoles,
    permissions: [...me.permissions, ...hrPermissions],
    organizationId,
    organizationName:
      membership?.organizationName ??
      me.activeOrganization?.name ??
      organizationId,
    branchId,
    branch: me.activeBranch,
    contextMode,
    membershipRoles,
    membershipBranchIds,
    entitlements: {
      [HR_ENTITLEMENTS.access]: access,
      [HR_ENTITLEMENTS.employeeLimit]: employeeLimit,
    },
  };
}
