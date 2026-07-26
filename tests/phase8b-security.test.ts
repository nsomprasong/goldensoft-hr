import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  requireHrApi,
  resolveAllowedBranchIds,
  setHrPlatformClientOverride,
  toHrError,
} from "../src/lib/hr/api";
import { HR_ENTITLEMENTS } from "../src/lib/hr/entitlements";
import { HR_PERMISSIONS } from "../src/lib/hr/permissions";
import { setHrRepositoryOverride } from "../src/lib/hr/repository";
import { listCompensations } from "../src/lib/hr/services/compensations";
import { createEmployee } from "../src/lib/hr/services/employees";
import {
  encodePlatformContextCookie,
  PLATFORM_CONTEXT_COOKIE_NAME,
} from "../src/lib/platform/context-cookie";
import {
  createMockPlatformClient,
  mockEntitledHrUser,
} from "../src/lib/platform/test-adapters";
import {
  adminContext,
  BRANCH_MAIN,
  BRANCH_OTHER,
  createHarness,
  employeeData,
  expectHrError,
  ORG_A,
} from "./helpers/hr-fixtures";

const SECRET = "phase8b-test-secret-key";
let previousSecret: string | undefined;
let previousMemoryFlag: string | undefined;

before(() => {
  previousSecret = process.env.PLATFORM_CONTEXT_COOKIE_SECRET;
  previousMemoryFlag = process.env.HR_USE_MEMORY_REPO;
  process.env.PLATFORM_CONTEXT_COOKIE_SECRET = SECRET;
  process.env.HR_USE_MEMORY_REPO = "true";
});

after(() => {
  if (previousSecret === undefined) {
    delete process.env.PLATFORM_CONTEXT_COOKIE_SECRET;
  } else {
    process.env.PLATFORM_CONTEXT_COOKIE_SECRET = previousSecret;
  }
  if (previousMemoryFlag === undefined) {
    delete process.env.HR_USE_MEMORY_REPO;
  } else {
    process.env.HR_USE_MEMORY_REPO = previousMemoryFlag;
  }
  setHrPlatformClientOverride(null);
  setHrRepositoryOverride(null);
});

function cookieHeader(organizationId: string, branchId: string | null): string {
  const value = encodePlatformContextCookie({ organizationId, branchId });
  return `${PLATFORM_CONTEXT_COOKIE_NAME}=${value}`;
}

function request(
  headers: Record<string, string> = {},
  url = "https://hr.local/api/hr/employees",
): Request {
  return new Request(url, { headers });
}

async function expectApiErrorCode(
  code: string,
  run: () => Promise<unknown>,
): Promise<void> {
  let captured: unknown;
  try {
    await run();
  } catch (error) {
    captured = error;
  }
  assert.notEqual(captured, undefined, `expected ${code} to be thrown`);
  assert.equal(toHrError(captured).code, code);
}

describe("Phase 8B API security", () => {
  it("rejects unauthenticated callers", async () => {
    const { repository } = createHarness();
    const platformClient = createMockPlatformClient({ authenticated: false });
    await expectApiErrorCode("UNAUTHENTICATED", () =>
      requireHrApi(request(), { platformClient, repository }),
    );
  });

  it("rejects organizations without the HR entitlement", async () => {
    const { repository } = createHarness();
    const { state, organizationId, branchId } = mockEntitledHrUser({
      organizationId: ORG_A,
      branchId: BRANCH_MAIN,
    });
    delete state.entitlements![`${organizationId}::${HR_ENTITLEMENTS.access}`];
    const platformClient = createMockPlatformClient(state);

    await expectApiErrorCode("PRODUCT_NOT_ENTITLED", () =>
      requireHrApi(
        request({ cookie: cookieHeader(organizationId, branchId) }),
        { platformClient, repository },
      ),
    );
  });

  it("rejects cross-tenant context", async () => {
    const { repository } = createHarness();
    const { state } = mockEntitledHrUser({
      organizationId: ORG_A,
      branchId: BRANCH_MAIN,
    });
    const foreignOrg = "44444444-4444-4444-8444-444444444444";
    state.me!.activeOrganization = { id: foreignOrg, name: "Foreign" };
    const platformClient = createMockPlatformClient(state);

    await expectApiErrorCode("FORBIDDEN", () =>
      requireHrApi(request({ cookie: cookieHeader(foreignOrg, null) }), {
        platformClient,
        repository,
      }),
    );
  });

  it("ignores a forged x-organization-id header", async () => {
    const { repository } = createHarness();
    const { state, organizationId, branchId } = mockEntitledHrUser({
      organizationId: ORG_A,
      branchId: BRANCH_MAIN,
    });
    const platformClient = createMockPlatformClient(state);

    const session = await requireHrApi(
      request({
        cookie: cookieHeader(organizationId, branchId),
        "x-organization-id": "deadbeef-dead-4bee-8bee-deadbeefdead",
      }),
      { platformClient, repository },
    );

    assert.equal(session.ctx.organizationId, ORG_A);
    assert.equal(session.service.organizationId, ORG_A);
  });

  it("keeps a member inside their own branch", async () => {
    const { repository } = createHarness();
    const { state, organizationId, branchId } = mockEntitledHrUser({
      organizationId: ORG_A,
      branchId: BRANCH_MAIN,
      organizationRoles: ["MEMBER"],
    });
    const platformClient = createMockPlatformClient(state);
    const headers = { cookie: cookieHeader(organizationId, branchId) };

    await expectApiErrorCode("BRANCH_OUT_OF_SCOPE", () =>
      requireHrApi(request(headers), {
        platformClient,
        repository,
        branchId: BRANCH_OTHER,
      }),
    );

    const session = await requireHrApi(request(headers), {
      platformClient,
      repository,
      branchId: BRANCH_MAIN,
    });
    assert.deepEqual(session.service.allowedBranchIds, [BRANCH_MAIN]);
  });

  it("gives administrators organization-wide branch scope", async () => {
    const { state, organizationId, branchId } = mockEntitledHrUser({
      organizationId: ORG_A,
      branchId: BRANCH_MAIN,
    });
    const platformClient = createMockPlatformClient(state);
    const { repository } = createHarness();
    const session = await requireHrApi(
      request({ cookie: cookieHeader(organizationId, branchId) }),
      { platformClient, repository },
    );
    assert.equal(resolveAllowedBranchIds(session.ctx), null);
  });

  it("denies a member every write permission", async () => {
    const { repository } = createHarness();
    const { state, organizationId, branchId } = mockEntitledHrUser({
      organizationId: ORG_A,
      branchId: BRANCH_MAIN,
      organizationRoles: ["MEMBER"],
    });
    const platformClient = createMockPlatformClient(state);

    await expectApiErrorCode("FORBIDDEN", () =>
      requireHrApi(
        request({ cookie: cookieHeader(organizationId, branchId) }),
        {
          platformClient,
          repository,
          permission: HR_PERMISSIONS.employeeCreate,
        },
      ),
    );
  });

  it("never grants compensation access through an admin role", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const employee = await createEmployee(
      repository,
      ctx,
      employeeData(store),
    );

    assert.ok(!ctx.permissions.includes(HR_PERMISSIONS.compensationRead));
    assert.ok(!ctx.permissions.includes(HR_PERMISSIONS.compensationManage));
    await expectHrError("FORBIDDEN", () =>
      listCompensations(repository, ctx, employee.id),
    );
  });

  it("honours the repository and platform test overrides", async () => {
    const { repository } = createHarness();
    const { state, organizationId, branchId } = mockEntitledHrUser({
      organizationId: ORG_A,
      branchId: BRANCH_MAIN,
    });
    setHrPlatformClientOverride(createMockPlatformClient(state));
    setHrRepositoryOverride(repository);

    const session = await requireHrApi(
      request({ cookie: cookieHeader(organizationId, branchId) }),
    );
    assert.equal(session.repository, repository);

    setHrPlatformClientOverride(null);
    setHrRepositoryOverride(null);
  });
});
