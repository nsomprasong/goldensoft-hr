import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { HR_ENTITLEMENTS, HR_PRODUCT_CODE } from "../src/lib/hr/entitlements";
import { resolveHrRequestContext } from "../src/lib/hr/resolve-context";
import {
  encodePlatformContextCookie,
  PLATFORM_CONTEXT_COOKIE_NAME,
} from "../src/lib/platform/context-cookie";
import { PlatformIntegrationError } from "../src/lib/platform/errors";
import {
  createMockPlatformClient,
  mockEntitledHrUser,
} from "../src/lib/platform/test-adapters";

const SECRET = "phase8a-test-secret-key";
let previousSecret: string | undefined;

before(() => {
  previousSecret = process.env.PLATFORM_CONTEXT_COOKIE_SECRET;
  process.env.PLATFORM_CONTEXT_COOKIE_SECRET = SECRET;
});

after(() => {
  if (previousSecret === undefined) {
    delete process.env.PLATFORM_CONTEXT_COOKIE_SECRET;
  } else {
    process.env.PLATFORM_CONTEXT_COOKIE_SECRET = previousSecret;
  }
});

function cookieHeader(
  organizationId: string,
  branchId: string | null,
  mode?: "membership" | "platform_admin" | "managed_org",
): string {
  const value = encodePlatformContextCookie({
    organizationId,
    branchId,
    mode,
  });
  return `${PLATFORM_CONTEXT_COOKIE_NAME}=${value}`;
}

async function expectCode(
  code: string,
  run: () => Promise<unknown>,
): Promise<void> {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof PlatformIntegrationError);
    assert.equal(error.code, code);
    return true;
  });
}

describe("Phase 8A HR platform integration", () => {
  it("denies unauthenticated callers", async () => {
    const client = createMockPlatformClient({ authenticated: false });
    await expectCode("UNAUTHENTICATED", () =>
      resolveHrRequestContext({
        cookieHeader: "",
        platformClient: client,
      }),
    );
  });

  it("requires organization context", async () => {
    const { state } = mockEntitledHrUser();
    state.me!.activeOrganization = null;
    const client = createMockPlatformClient(state);
    await expectCode("TENANT_CONTEXT_REQUIRED", () =>
      resolveHrRequestContext({
        cookieHeader: "",
        platformClient: client,
      }),
    );
  });

  it("denies when HR entitlement is missing", async () => {
    const { state, organizationId, branchId } = mockEntitledHrUser();
    delete state.entitlements![`${organizationId}::${HR_ENTITLEMENTS.access}`];
    const client = createMockPlatformClient(state);
    await expectCode("PRODUCT_NOT_ENTITLED", () =>
      resolveHrRequestContext({
        cookieHeader: cookieHeader(organizationId, branchId),
        platformClient: client,
      }),
    );
  });

  it("denies inactive subscription", async () => {
    const { state, organizationId, branchId } = mockEntitledHrUser();
    const accessKey = `${organizationId}::${HR_ENTITLEMENTS.access}`;
    state.entitlements![accessKey] = {
      ...state.entitlements![accessKey]!,
      allowed: false,
      subscriptionStatus: "SUSPENDED",
      reason: "INACTIVE",
    };
    const client = createMockPlatformClient(state);
    await expectCode("SUBSCRIPTION_INACTIVE", () =>
      resolveHrRequestContext({
        cookieHeader: cookieHeader(organizationId, branchId),
        platformClient: client,
      }),
    );
  });

  it("resolves employee limit value from Platform", async () => {
    const { state, organizationId, branchId } = mockEntitledHrUser({
      employeeLimit: "120",
    });
    const client = createMockPlatformClient(state);
    const ctx = await resolveHrRequestContext({
      cookieHeader: cookieHeader(organizationId, branchId),
      platformClient: client,
    });
    assert.equal(
      ctx.entitlements[HR_ENTITLEMENTS.employeeLimit]?.value,
      "120",
    );
    assert.equal(
      ctx.entitlements[HR_ENTITLEMENTS.employeeLimit]?.productCode,
      HR_PRODUCT_CODE,
    );
  });

  it("denies cross-tenant organization access", async () => {
    const { state, branchId } = mockEntitledHrUser();
    const otherOrg = "99999999-9999-4999-8999-999999999999";
    state.me!.activeOrganization = { id: otherOrg, name: "Other" };
    const client = createMockPlatformClient(state);
    await expectCode("FORBIDDEN", () =>
      resolveHrRequestContext({
        cookieHeader: cookieHeader(otherOrg, branchId),
        platformClient: client,
      }),
    );
  });

  it("ignores stale org cookie when Platform active org is entitled", async () => {
    const { state, organizationId, branchId } = mockEntitledHrUser();
    const staleOrg = "99999999-9999-4999-8999-999999999999";
    const client = createMockPlatformClient(state);
    const ctx = await resolveHrRequestContext({
      cookieHeader: cookieHeader(staleOrg, branchId),
      platformClient: client,
    });
    assert.equal(ctx.organizationId, organizationId);
  });

  it("denies branch out of scope", async () => {
    const { state, organizationId, branchId } = mockEntitledHrUser();
    const client = createMockPlatformClient(state);
    const otherBranch = "33333333-3333-4333-8333-333333333333";
    await expectCode("BRANCH_OUT_OF_SCOPE", () =>
      resolveHrRequestContext({
        cookieHeader: cookieHeader(organizationId, branchId),
        platformClient: client,
        requiredBranchId: otherBranch,
        allowedBranchIds: branchId ? [branchId] : [],
      }),
    );
  });

  it("allows an authorized HR user", async () => {
    const { state, organizationId, branchId } = mockEntitledHrUser();
    const client = createMockPlatformClient(state);
    const ctx = await resolveHrRequestContext({
      cookieHeader: cookieHeader(organizationId, branchId),
      platformClient: client,
      requiredBranchId: branchId,
      allowedBranchIds: branchId ? [branchId] : [],
    });
    assert.equal(ctx.organizationId, organizationId);
    assert.equal(ctx.contextMode, "membership");
    assert.ok(ctx.entitlements[HR_ENTITLEMENTS.access]?.allowed);
  });

  it("accepts legacy cookies without employeeId", async () => {
    const { state, organizationId, branchId } = mockEntitledHrUser();
    const client = createMockPlatformClient(state);
    const value = encodePlatformContextCookie({
      organizationId,
      branchId,
    });
    const ctx = await resolveHrRequestContext({
      cookieHeader: `${PLATFORM_CONTEXT_COOKIE_NAME}=${value}`,
      platformClient: client,
    });
    assert.equal(ctx.organizationId, organizationId);
    assert.equal(ctx.activeEmployeeId ?? null, null);
  });

  it("surfaces signed employeeId from cookie for later DB validation", async () => {
    const { state, organizationId, branchId } = mockEntitledHrUser();
    const client = createMockPlatformClient(state);
    const employeeId = "44444444-4444-4444-8444-444444444444";
    const value = encodePlatformContextCookie({
      organizationId,
      branchId,
      employeeId,
      branchSelected: true,
    });
    const ctx = await resolveHrRequestContext({
      cookieHeader: `${PLATFORM_CONTEXT_COOKIE_NAME}=${value}`,
      platformClient: client,
    });
    assert.equal(ctx.activeEmployeeId, employeeId);
  });

  it("ignores client-forged organizationId header", async () => {
    const { state, organizationId, branchId } = mockEntitledHrUser();
    const client = createMockPlatformClient(state);
    const forged = "99999999-9999-4999-8999-999999999999";
    await expectCode("CLIENT_ORG_MISMATCH", () =>
      resolveHrRequestContext({
        cookieHeader: cookieHeader(organizationId, branchId),
        platformClient: client,
        clientOrganizationId: forged,
      }),
    );
  });

  it("allows SUPER_ADMIN via platform_admin context only with matching cookie mode", async () => {
    const { state, organizationId, branchId } = mockEntitledHrUser({
      platformAdmin: true,
    });
    const client = createMockPlatformClient(state);
    const ctx = await resolveHrRequestContext({
      cookieHeader: cookieHeader(organizationId, branchId, "platform_admin"),
      platformClient: client,
    });
    assert.equal(ctx.contextMode, "platform_admin");
    assert.ok(ctx.platformRoles.includes("SUPER_ADMIN"));
  });

  it("allows SALES through a Platform-verified managed organization context", async () => {
    const { state, organizationId, branchId } = mockEntitledHrUser();
    state.me!.memberships = [];
    state.me!.platformRoles = ["SALES"];
    state.me!.contextMode = "managed_org";
    state.me!.permissions = ["hr.employee.read"];
    const client = createMockPlatformClient(state);

    const ctx = await resolveHrRequestContext({
      cookieHeader: cookieHeader(organizationId, branchId, "managed_org"),
      platformClient: client,
    });

    assert.equal(ctx.contextMode, "managed_org");
    assert.equal(ctx.organizationId, organizationId);
    assert.deepEqual(ctx.membershipRoles, []);
    assert.ok(ctx.permissions.includes("hr.employee.read"));
    assert.ok(ctx.entitlements[HR_ENTITLEMENTS.access]?.allowed);
  });
});
