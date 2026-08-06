import { PlatformIntegrationError } from "@/lib/platform/errors";
import type {
  EntitlementCheckResponse,
  PlatformClient,
  PlatformMeResponse,
} from "@/lib/platform/types";
import { HR_ENTITLEMENTS, HR_PRODUCT_CODE } from "@/lib/hr/entitlements";

export type MockPlatformState = {
  authenticated: boolean;
  me?: PlatformMeResponse;
  entitlements?: Record<string, EntitlementCheckResponse>;
  /** When set, entitlement check for this org is FORBIDDEN (cross-tenant). */
  forbiddenOrganizationIds?: string[];
};

function keyOf(organizationId: string, entitlementCode: string): string {
  return `${organizationId}::${entitlementCode}`;
}

export function createMockPlatformClient(
  state: MockPlatformState,
): PlatformClient {
  return {
    async getMe() {
      if (!state.authenticated || !state.me) {
        throw new PlatformIntegrationError("UNAUTHENTICATED");
      }
      if (!state.me.profile) {
        throw new PlatformIntegrationError("PROFILE_NOT_FOUND");
      }
      if (state.me.profile.statusCode !== "ACTIVE") {
        throw new PlatformIntegrationError("PROFILE_SUSPENDED");
      }
      return state.me;
    },

    async checkEntitlement(_cookie, input) {
      if (!state.authenticated) {
        throw new PlatformIntegrationError("UNAUTHENTICATED");
      }
      if (state.forbiddenOrganizationIds?.includes(input.organizationId)) {
        throw new PlatformIntegrationError("FORBIDDEN");
      }
      const hit =
        state.entitlements?.[keyOf(input.organizationId, input.entitlementCode)];
      if (!hit) {
        return {
          allowed: false,
          value: null,
          reason: "NOT_FOUND",
          subscriptionStatus: null,
          expiresAt: null,
          organizationId: input.organizationId,
          productCode: input.productCode,
          entitlementCode: input.entitlementCode,
          branchId: input.branchId ?? null,
        };
      }
      return hit;
    },
  };
}

export function mockEntitledHrUser(options?: {
  organizationId?: string;
  branchId?: string | null;
  employeeLimit?: string;
  platformAdmin?: boolean;
  organizationRoles?: string[];
}): {
  state: MockPlatformState;
  organizationId: string;
  branchId: string | null;
} {
  const organizationId =
    options?.organizationId ?? "11111111-1111-4111-8111-111111111111";
  const branchId =
    options?.branchId === undefined
      ? "22222222-2222-4222-8222-222222222222"
      : options.branchId;
  const employeeLimit = options?.employeeLimit ?? "50";

  const me: PlatformMeResponse = {
    user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "hr@example.com" },
    profile: {
      displayName: "HR User",
      email: "hr@example.com",
      statusCode: "ACTIVE",
    },
    platformRoles: options?.platformAdmin ? ["SUPER_ADMIN"] : [],
    contextMode: options?.platformAdmin ? "platform_admin" : "membership",
    memberships: options?.platformAdmin
      ? []
      : [
          {
            organizationId,
            organizationName: "Demo Org",
            organizationStatus: "ACTIVE",
            roles: options?.organizationRoles ?? ["ADMIN"],
            branchCount: branchId ? 1 : 0,
            branches: branchId
              ? [{ id: branchId, name: "สาขาหลัก", code: "HQ" }]
              : [],
          },
        ],
    activeOrganization: { id: organizationId, name: "Demo Org" },
    activeBranch: branchId
      ? { id: branchId, name: "สาขาหลัก", code: "HQ" }
      : null,
    permissions: ["platform.organization.read"],
  };

  const entitlements: Record<string, EntitlementCheckResponse> = {
    [keyOf(organizationId, HR_ENTITLEMENTS.access)]: {
      allowed: true,
      value: "true",
      reason: null,
      subscriptionStatus: "ACTIVE",
      expiresAt: null,
      organizationId,
      productCode: HR_PRODUCT_CODE,
      entitlementCode: HR_ENTITLEMENTS.access,
      branchId: null,
    },
    [keyOf(organizationId, HR_ENTITLEMENTS.employeeLimit)]: {
      allowed: true,
      value: employeeLimit,
      reason: null,
      subscriptionStatus: "ACTIVE",
      expiresAt: null,
      organizationId,
      productCode: HR_PRODUCT_CODE,
      entitlementCode: HR_ENTITLEMENTS.employeeLimit,
      branchId: null,
    },
  };

  return {
    organizationId,
    branchId,
    state: { authenticated: true, me, entitlements },
  };
}
