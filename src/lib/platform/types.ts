/** Typed Platform ↔ HR integration contracts (v1). */

export type PlatformErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "TENANT_CONTEXT_REQUIRED"
  | "PRODUCT_NOT_ENTITLED"
  | "SUBSCRIPTION_INACTIVE"
  | "BRANCH_OUT_OF_SCOPE"
  | "CLIENT_ORG_MISMATCH"
  | "INVALID_BODY"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_SUSPENDED"
  | "PLATFORM_UNAVAILABLE";

export type PlatformContextMode = "membership" | "platform_admin";

export type PlatformMeResponse = {
  user: { id: string; email: string | null };
  profile: {
    displayName: string;
    email: string;
    statusCode: string;
  } | null;
  platformRoles: string[];
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    organizationStatus: string;
    roles: string[];
    branchCount: number;
  }>;
  activeOrganization: { id: string; name: string } | null;
  activeBranch: { id: string; name: string; code: string } | null;
  permissions: string[];
};

export type EntitlementCheckRequest = {
  organizationId: string;
  productCode: string;
  entitlementCode: string;
  branchId?: string | null;
};

export type EntitlementCheckResponse = {
  allowed: boolean;
  value: string | null;
  reason: string | null;
  subscriptionStatus: string | null;
  expiresAt: string | null;
  organizationId: string;
  productCode: string;
  entitlementCode: string;
  branchId: string | null;
};

export type PlatformContextCookie = {
  organizationId: string;
  branchId: string | null;
  mode?: PlatformContextMode;
};

/** Optional headers forwarded to Platform (e.g. local ALLOW_TEST_AUTH). */
export type PlatformForwardHeaders = {
  "x-test-auth-user-id"?: string;
  "x-test-auth-email"?: string;
};

export type PlatformClient = {
  getMe(
    cookieHeader: string,
    forwardHeaders?: PlatformForwardHeaders,
  ): Promise<PlatformMeResponse>;
  checkEntitlement(
    cookieHeader: string,
    input: EntitlementCheckRequest,
    forwardHeaders?: PlatformForwardHeaders,
  ): Promise<EntitlementCheckResponse>;
};

export type HrRequestContext = {
  authUserId: string;
  email: string | null;
  profile: PlatformMeResponse["profile"];
  platformRoles: string[];
  permissions: string[];
  organizationId: string;
  organizationName: string;
  branchId: string | null;
  branch: PlatformMeResponse["activeBranch"];
  contextMode: PlatformContextMode;
  membershipRoles: string[];
  entitlements: Partial<Record<string, EntitlementCheckResponse>>;
};
