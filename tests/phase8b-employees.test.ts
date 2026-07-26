import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MASKED_VALUE } from "../src/lib/hr/audit";
import {
  createEmployee,
  deactivateEmployee,
  getEmployee,
  linkPlatformUser,
  listEmployees,
  unlinkPlatformUser,
  updateEmployee,
} from "../src/lib/hr/services/employees";
import { HR_PERMISSIONS } from "../src/lib/hr/permissions";
import {
  ACTOR_ID,
  adminContext,
  BRANCH_MAIN,
  BRANCH_OTHER,
  createHarness,
  employeeData,
  expectHrError,
  masterId,
  memberContext,
  ORG_B,
  PLATFORM_USER_ID,
} from "./helpers/hr-fixtures";

describe("Phase 8B employees", () => {
  it("creates an employee without any auth account", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();

    const employee = await createEmployee(repository, ctx, employeeData(store));

    assert.equal(employee.employeeCode, "EMP-0001");
    assert.equal(employee.displayName, "สมชาย ใจดี");
    assert.equal(employee.email, null);
    assert.equal(employee.platformUserId, null);
    assert.equal(employee.authUserId, null);
    assert.equal(employee.createdBy, ACTOR_ID);
    assert.ok(employee.isActive);

    const audit = await repository.audit.listByEntity(
      ctx.organizationId,
      "employee",
      employee.id,
    );
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actionCode, "employee.create");
  });

  it("normalizes the employee code and refuses duplicates", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();

    await createEmployee(
      repository,
      ctx,
      employeeData(store, { employeeCode: "emp-0002" }),
    );

    await expectHrError("DUPLICATE_CODE", () =>
      createEmployee(
        repository,
        ctx,
        employeeData(store, { employeeCode: "EMP-0002" }),
      ),
    );
  });

  it("rejects an inactive employment type", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const monthly = store.masters.employmentType.find(
      (row) => row.code === "MONTHLY",
    )!;
    monthly.isActive = false;

    await expectHrError("INACTIVE_MASTER", () =>
      createEmployee(repository, ctx, employeeData(store)),
    );
  });

  it("rejects an inactive department", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const department = await repository.departments.create({
      organizationId: ctx.organizationId,
      code: "OPS",
      nameTh: "ฝ่ายปฏิบัติการ",
      nameEn: "Operations",
      description: null,
      isActive: false,
    });

    await expectHrError("INACTIVE_ENTITY", () =>
      createEmployee(
        repository,
        ctx,
        employeeData(store, { departmentId: department.id }),
      ),
    );
  });

  it("updates an employee and records the change", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const employee = await createEmployee(repository, ctx, employeeData(store));

    const updated = await updateEmployee(repository, ctx, employee.id, {
      phone: "0899999999",
      email: "Somchai@Example.com",
      employeeStatusId: masterId(store, "employeeStatus", "SUSPENDED"),
    });

    assert.equal(updated.phone, "0899999999");
    assert.equal(updated.email, "somchai@example.com");
    assert.equal(
      updated.employeeStatusId,
      masterId(store, "employeeStatus", "SUSPENDED"),
    );

    const audit = await repository.audit.listByEntity(
      ctx.organizationId,
      "employee",
      employee.id,
    );
    assert.ok(audit.some((row) => row.actionCode === "employee.update"));
  });

  it("rejects a malformed email", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    await expectHrError("VALIDATION_ERROR", () =>
      createEmployee(repository, ctx, employeeData(store, { email: "nope" })),
    );
  });

  it("deactivates without deleting", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const employee = await createEmployee(repository, ctx, employeeData(store));

    const deactivated = await deactivateEmployee(repository, ctx, employee.id, {
      resignationDate: "2026-06-30",
    });

    assert.equal(deactivated.isActive, false);
    assert.equal(
      deactivated.employeeStatusId,
      masterId(store, "employeeStatus", "INACTIVE"),
    );
    assert.equal(
      deactivated.resignationDate?.toISOString().slice(0, 10),
      "2026-06-30",
    );
    assert.equal(store.employees.length, 1);
  });

  it("links and unlinks a platform user", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const employee = await createEmployee(repository, ctx, employeeData(store));

    const linked = await linkPlatformUser(repository, ctx, employee.id, {
      platformUserId: PLATFORM_USER_ID,
      platformUserOrganizationId: ctx.organizationId,
    });
    assert.equal(linked.platformUserId, PLATFORM_USER_ID);

    const unlinked = await unlinkPlatformUser(repository, ctx, employee.id);
    assert.equal(unlinked.platformUserId, null);
    assert.equal(unlinked.authUserId, null);
  });

  it("refuses to link the same platform user twice", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const first = await createEmployee(repository, ctx, employeeData(store));
    const second = await createEmployee(
      repository,
      ctx,
      employeeData(store, { employeeCode: "EMP-0002" }),
    );

    await linkPlatformUser(repository, ctx, first.id, {
      platformUserId: PLATFORM_USER_ID,
      platformUserOrganizationId: ctx.organizationId,
    });

    await expectHrError("DUPLICATE_PLATFORM_USER", () =>
      linkPlatformUser(repository, ctx, second.id, {
        platformUserId: PLATFORM_USER_ID,
        platformUserOrganizationId: ctx.organizationId,
      }),
    );
  });

  it("blocks a cross-organization link", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const employee = await createEmployee(repository, ctx, employeeData(store));

    const foreignCtx = adminContext({ organizationId: ORG_B });
    await expectHrError("CROSS_ORG_LINK", () =>
      linkPlatformUser(repository, foreignCtx, employee.id, {
        platformUserId: PLATFORM_USER_ID,
        platformUserOrganizationId: ORG_B,
      }),
    );

    await expectHrError("CROSS_ORG_LINK", () =>
      linkPlatformUser(repository, ctx, employee.id, {
        platformUserId: PLATFORM_USER_ID,
        platformUserOrganizationId: ORG_B,
      }),
    );
  });

  it("hides other tenants' employees behind NOT_FOUND", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const employee = await createEmployee(repository, ctx, employeeData(store));

    await expectHrError("NOT_FOUND", () =>
      getEmployee(repository, adminContext({ organizationId: ORG_B }), employee.id),
    );
  });

  it("keeps ordinary members on self-service permissions only", async () => {
    const { store, repository } = createHarness();
    const admin = adminContext();
    await createEmployee(repository, admin, employeeData(store));

    const member = memberContext();
    await expectHrError("FORBIDDEN", () => listEmployees(repository, member));
  });

  it("keeps a branch-scoped reader from reading another branch", async () => {
    const { store, repository } = createHarness();
    const admin = adminContext();
    await createEmployee(repository, admin, employeeData(store));
    const otherBranch = await createEmployee(
      repository,
      admin,
      employeeData(store, {
        employeeCode: "EMP-0009",
        branchId: BRANCH_OTHER,
      }),
    );

    const reader = {
      ...memberContext(),
      permissions: [HR_PERMISSIONS.employeeRead],
      branchIds: [BRANCH_MAIN],
      branchScope: "limited" as const,
    };
    const listed = await listEmployees(repository, reader);
    assert.equal(listed.total, 1);
    assert.equal(listed.rows[0].branchId, BRANCH_MAIN);

    await expectHrError("BRANCH_OUT_OF_SCOPE", () =>
      getEmployee(repository, reader, otherBranch.id),
    );
  });

  it("paginates and searches", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    for (let index = 1; index <= 5; index += 1) {
      await createEmployee(
        repository,
        ctx,
        employeeData(store, {
          employeeCode: `EMP-100${index}`,
          firstNameTh: `พนักงาน${index}`,
        }),
      );
    }

    const firstPage = await listEmployees(repository, ctx, { pageSize: 2 });
    assert.equal(firstPage.total, 5);
    assert.equal(firstPage.rows.length, 2);
    assert.equal(firstPage.pageCount, 3);

    const searched = await listEmployees(repository, ctx, {
      search: "EMP-1003",
    });
    assert.equal(searched.total, 1);
  });

  it("never writes a secret into the audit trail", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const employee = await createEmployee(
      repository,
      ctx,
      employeeData(store, { notes: "ปกติ" }),
    );

    const audit = await repository.audit.listByEntity(
      ctx.organizationId,
      "employee",
      employee.id,
    );
    const serialized = JSON.stringify(audit);
    assert.ok(!serialized.includes("token"));
    assert.ok(!serialized.includes(MASKED_VALUE));
  });
});
