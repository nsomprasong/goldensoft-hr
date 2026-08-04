import assert from "node:assert/strict";
import { describe, it, before, after, beforeEach } from "node:test";

import {
  assertBranchBelongsToOrganization,
  assertEmployeeBelongsToAuth,
  resolvePostLoginContext,
} from "../src/lib/hr/active-context";
import {
  decodePlatformContextCookie,
  encodePlatformContextCookie,
} from "../src/lib/platform/context-cookie";
import {
  assertNoActiveAuthCollision,
  completeEmployeeActivation,
  probeAuthAccountByPhone,
  resetActivationStoreForTests,
  startEmployeeActivation,
  upsertMemoryAuthPhone,
  clearMemoryAuthPhoneDirectory,
} from "../src/lib/hr/services/employee-activation";
import {
  createEmployee,
  deactivateEmployee,
  linkPlatformUser,
} from "../src/lib/hr/services/employees";
import {
  ACTOR_ID,
  adminContext,
  createHarness,
  employeeData,
  expectHrError,
  masterId,
  PLATFORM_USER_ID,
} from "./helpers/hr-fixtures";

const COOKIE_SECRET = "multi-org-auth-employee-test-secret";
const previousCookieSecret = process.env.PLATFORM_CONTEXT_COOKIE_SECRET;

describe("multi-org auth ↔ employee", () => {
  beforeEach(() => {
    resetActivationStoreForTests();
    clearMemoryAuthPhoneDirectory();
  });

  before(() => {
    process.env.PLATFORM_CONTEXT_COOKIE_SECRET = COOKIE_SECRET;
  });

  after(() => {
    if (previousCookieSecret === undefined) {
      delete process.env.PLATFORM_CONTEXT_COOKIE_SECRET;
    } else {
      process.env.PLATFORM_CONTEXT_COOKIE_SECRET = previousCookieSecret;
    }
  });

  it("allows the same auth across two organizations", async () => {
    const { store, repository } = createHarness();
    const authUserId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const platformUserB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

    const empA = await createEmployee(
      repository,
      adminContext(),
      employeeData(store),
    );
    await linkPlatformUser(repository, adminContext(), empA.id, {
      platformUserId: PLATFORM_USER_ID,
      authUserId,
      platformUserOrganizationId: adminContext().organizationId,
    });

    const empB = await createEmployee(
      repository,
      adminContext({ organizationId: "99999999-9999-4999-8999-999999999999" }),
      employeeData(store, {
        employeeCode: "EMP-B001",
        phone: "0800000099",
      }),
    );
    await linkPlatformUser(
      repository,
      adminContext({ organizationId: "99999999-9999-4999-8999-999999999999" }),
      empB.id,
      {
        platformUserId: platformUserB,
        authUserId,
        platformUserOrganizationId: "99999999-9999-4999-8999-999999999999",
      },
    );

    assert.equal(empA.organizationId !== empB.organizationId, true);
    const againA = await repository.employees.findByAuthUserId(
      empA.organizationId,
      authUserId,
      { activeOnly: true },
    );
    const againB = await repository.employees.findByAuthUserId(
      empB.organizationId,
      authUserId,
      { activeOnly: true },
    );
    assert.equal(againA?.id, empA.id);
    assert.equal(againB?.id, empB.id);
  });

  it("blocks two active employees with the same auth in one org", async () => {
    const { store, repository } = createHarness();
    const authUserId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const first = await createEmployee(
      repository,
      adminContext(),
      employeeData(store),
    );
    await linkPlatformUser(repository, adminContext(), first.id, {
      platformUserId: PLATFORM_USER_ID,
      authUserId,
      platformUserOrganizationId: adminContext().organizationId,
    });

    const second = await createEmployee(
      repository,
      adminContext(),
      employeeData(store, { employeeCode: "EMP-0002", phone: "0800000002" }),
    );

    await expectHrError("DUPLICATE_AUTH_USER", () =>
      linkPlatformUser(repository, adminContext(), second.id, {
        platformUserId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        authUserId,
        platformUserOrganizationId: adminContext().organizationId,
      }),
    );

    await assert.rejects(
      () =>
        assertNoActiveAuthCollision(
          repository,
          adminContext().organizationId,
          authUserId,
          second.id,
        ),
    );
  });

  it("allows rehire after deactivate while keeping prior auth history", async () => {
    const { store, repository } = createHarness();
    const authUserId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const first = await createEmployee(
      repository,
      adminContext(),
      employeeData(store),
    );
    await linkPlatformUser(repository, adminContext(), first.id, {
      platformUserId: PLATFORM_USER_ID,
      authUserId,
      platformUserOrganizationId: adminContext().organizationId,
    });
    await deactivateEmployee(repository, adminContext(), first.id);

    const rehired = await createEmployee(
      repository,
      adminContext(),
      employeeData(store, { employeeCode: "EMP-0002", phone: "0800000002" }),
    );
    const linked = await linkPlatformUser(
      repository,
      adminContext(),
      rehired.id,
      {
        platformUserId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        authUserId,
        platformUserOrganizationId: adminContext().organizationId,
      },
    );
    assert.equal(linked.authUserId, authUserId);
    assert.ok(linked.isActive);

    const history = await repository.employees.findByAuthUserId(
      adminContext().organizationId,
      authUserId,
      { activeOnly: false },
    );
    assert.ok(history);
  });

  it("creates with NO_NOTIFICATION and keeps account not linked", async () => {
    const { store, repository } = createHarness();
    const employee = await createEmployee(
      repository,
      adminContext(),
      employeeData(store, { onboardingMethodCode: "NO_NOTIFICATION" }),
    );
    assert.equal(employee.authUserId, null);
    const notLinked = masterId(store, "employeeAccountAccessStatus", "NOT_LINKED");
    assert.equal(employee.accountAccessStatusId, notLinked);
  });

  it("OTP activation links auth after mock token verify", async () => {
    const { store, repository } = createHarness();
    const employee = await createEmployee(
      repository,
      adminContext(),
      employeeData(store, { onboardingMethodCode: "OTP_VERIFICATION" }),
    );
    const challenge = await startEmployeeActivation(
      repository,
      adminContext(),
      employee.id,
      "OTP_VERIFICATION",
    );
    assert.ok(challenge.mockToken);

    const linked = await completeEmployeeActivation(
      repository,
      adminContext(),
      {
        employeeId: employee.id,
        token: challenge.mockToken!,
        platformUserId: PLATFORM_USER_ID,
        authUserId: ACTOR_ID,
        platformUserOrganizationId: adminContext().organizationId,
      },
    );
    assert.equal(linked.authUserId, ACTOR_ID);
    const active = masterId(store, "employeeAccountAccessStatus", "ACTIVE");
    assert.equal(linked.accountAccessStatusId, active);
  });

  it("phone probe returns only exists=true without org leakage", async () => {
    const { repository } = createHarness();
    upsertMemoryAuthPhone("0812345678", {
      authUserId: ACTOR_ID,
      platformUserId: PLATFORM_USER_ID,
    });
    const hit = await probeAuthAccountByPhone(
      repository,
      adminContext(),
      "0812345678",
    );
    assert.deepEqual(hit, { exists: true });
    const miss = await probeAuthAccountByPhone(
      repository,
      adminContext(),
      "0899999999",
    );
    assert.deepEqual(miss, { exists: false });
  });

  it("auto-selects single org / single branch context", () => {
    const resolved = resolvePostLoginContext([
      {
        organizationId: "org-1",
        branchIds: ["br-1"],
        employeeIds: ["emp-1"],
      },
    ]);
    assert.equal(resolved.autoSelected, true);
    assert.equal(resolved.organizationId, "org-1");
    assert.equal(resolved.branchId, "br-1");
    assert.equal(resolved.employeeId, "emp-1");
  });

  it("does not auto-select when multiple organizations exist", () => {
    const resolved = resolvePostLoginContext([
      { organizationId: "org-1", branchIds: ["br-1"], employeeIds: ["e1"] },
      { organizationId: "org-2", branchIds: ["br-2"], employeeIds: ["e2"] },
    ]);
    assert.equal(resolved.autoSelected, false);
    assert.equal(resolved.organizationId, "");
  });

  it("rejects employee context that does not belong to auth", () => {
    assert.equal(
      assertEmployeeBelongsToAuth({
        employee: {
          id: "e1",
          organizationId: "org-1",
          authUserId: "auth-other",
          isActive: true,
        },
        organizationId: "org-1",
        authUserId: "auth-1",
      }),
      false,
    );
  });

  it("rejects forged employeeId from another organization", () => {
    assert.equal(
      assertEmployeeBelongsToAuth({
        employee: {
          id: "e-foreign",
          organizationId: "org-other",
          authUserId: "auth-1",
          isActive: true,
        },
        organizationId: "org-1",
        authUserId: "auth-1",
      }),
      false,
    );
  });

  it("rejects TERMINATED or INACTIVE employees as active context", () => {
    assert.equal(
      assertEmployeeBelongsToAuth({
        employee: {
          id: "e1",
          organizationId: "org-1",
          authUserId: "auth-1",
          isActive: true,
          employeeStatusCode: "TERMINATED",
        },
        organizationId: "org-1",
        authUserId: "auth-1",
      }),
      false,
    );
    assert.equal(
      assertEmployeeBelongsToAuth({
        employee: {
          id: "e1",
          organizationId: "org-1",
          authUserId: "auth-1",
          isActive: false,
          employeeStatusCode: "INACTIVE",
        },
        organizationId: "org-1",
        authUserId: "auth-1",
      }),
      false,
    );
  });

  it("rejects branch claims that cross organizations", () => {
    assert.equal(
      assertBranchBelongsToOrganization({
        branch: { id: "br-1", organizationId: "org-other" },
        organizationId: "org-1",
        allowedBranchIds: ["br-1"],
      }),
      false,
    );
    assert.equal(
      assertBranchBelongsToOrganization({
        branch: { id: "br-1", organizationId: "org-1" },
        organizationId: "org-1",
        allowedBranchIds: ["br-2"],
      }),
      false,
    );
    assert.equal(
      assertBranchBelongsToOrganization({
        branch: { id: "br-1", organizationId: "org-1" },
        organizationId: "org-1",
        allowedBranchIds: ["br-1"],
      }),
      true,
    );
  });

  it("prefers an explicit employee when switching org without logout", () => {
    const resolved = resolvePostLoginContext(
      [
        {
          organizationId: "org-1",
          branchIds: ["br-1"],
          employeeIds: ["emp-1"],
        },
        {
          organizationId: "org-2",
          branchIds: ["br-2a", "br-2b"],
          employeeIds: ["emp-2"],
        },
      ],
      {
        organizationId: "org-2",
        branchId: "br-2b",
        employeeId: "emp-2",
      },
    );
    assert.equal(resolved.organizationId, "org-2");
    assert.equal(resolved.branchId, "br-2b");
    assert.equal(resolved.employeeId, "emp-2");
    assert.equal(resolved.autoSelected, false);
  });

  it("ignores preferred employeeId that is not in the selected org", () => {
    const resolved = resolvePostLoginContext(
      [
        {
          organizationId: "org-1",
          branchIds: ["br-1"],
          employeeIds: ["emp-1"],
        },
      ],
      { organizationId: "org-1", employeeId: "emp-forged" },
    );
    assert.equal(resolved.employeeId, "emp-1");
  });

  it("decodes legacy context cookies without employeeId", () => {
    const raw = encodePlatformContextCookie({
      organizationId: "11111111-1111-4111-8111-111111111111",
      branchId: null,
    });
    const decoded = decodePlatformContextCookie(raw);
    assert.ok(decoded);
    assert.equal(decoded.employeeId, undefined);
    assert.equal(decoded.branchSelected, undefined);
  });

  it("keeps tenant isolation across org options for the same auth", () => {
    const resolvedA = resolvePostLoginContext(
      [
        { organizationId: "org-a", branchIds: ["ba"], employeeIds: ["ea"] },
        { organizationId: "org-b", branchIds: ["bb"], employeeIds: ["eb"] },
      ],
      { organizationId: "org-a" },
    );
    const resolvedB = resolvePostLoginContext(
      [
        { organizationId: "org-a", branchIds: ["ba"], employeeIds: ["ea"] },
        { organizationId: "org-b", branchIds: ["bb"], employeeIds: ["eb"] },
      ],
      { organizationId: "org-b" },
    );
    assert.equal(resolvedA.employeeId, "ea");
    assert.equal(resolvedB.employeeId, "eb");
    assert.notEqual(resolvedA.organizationId, resolvedB.organizationId);
  });
});
