import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCanManageOrganizationOwnerEmployment,
  isGoldenSoftPlatformStaff,
} from "../src/lib/hr/authorize";
import { HrError } from "../src/lib/hr/errors";
import {
  createEmployee,
  deactivateEmployee,
  reactivateEmployee,
} from "../src/lib/hr/services/employees";
import {
  adminContext,
  createHarness,
  employeeData,
  masterId,
} from "./helpers/hr-fixtures";

describe("organization OWNER employment lock", () => {
  it("treats any platform role as GoldenSoft Platform staff", () => {
    assert.equal(
      isGoldenSoftPlatformStaff({
        organizationId: "org",
        branchId: null,
        permissions: [],
        platformRoles: [],
        contextMode: "membership",
      }),
      false,
    );
    assert.equal(
      isGoldenSoftPlatformStaff({
        organizationId: "org",
        branchId: null,
        permissions: [],
        platformRoles: ["SUPPORT"],
        contextMode: "platform_admin",
      }),
      true,
    );
  });

  it("blocks org admins from toggling OWNER employment", () => {
    assert.throws(
      () =>
        assertCanManageOrganizationOwnerEmployment(
          {
            organizationId: "org",
            branchId: null,
            permissions: ["hr.employee.deactivate"],
            platformRoles: [],
            contextMode: "membership",
          },
          true,
        ),
      (error: unknown) => {
        assert.ok(error instanceof HrError);
        assert.equal(error.code, "FORBIDDEN");
        assert.equal(
          (error.details as { code?: string } | undefined)?.code,
          "OWNER_EMPLOYMENT_LOCKED",
        );
        return true;
      },
    );
  });

  it("allows Platform staff to toggle OWNER employment", () => {
    assert.doesNotThrow(() =>
      assertCanManageOrganizationOwnerEmployment(
        {
          organizationId: "org",
          branchId: null,
          permissions: ["hr.employee.deactivate"],
          platformRoles: ["SUPER_ADMIN"],
          contextMode: "platform_admin",
        },
        true,
      ),
    );
  });

  it("does not lock non-OWNER employees", () => {
    assert.doesNotThrow(() =>
      assertCanManageOrganizationOwnerEmployment(
        {
          organizationId: "org",
          branchId: null,
          permissions: ["hr.employee.deactivate"],
          platformRoles: [],
          contextMode: "membership",
        },
        false,
      ),
    );
  });
});

describe("employee reactivate", () => {
  it("reactivates a soft-deactivated employee", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const employee = await createEmployee(
      repository,
      ctx,
      employeeData(store),
    );
    await deactivateEmployee(repository, ctx, employee.id, {
      resignationDate: "2026-06-30",
    });

    const reactivated = await reactivateEmployee(
      repository,
      ctx,
      employee.id,
      {},
    );

    assert.equal(reactivated.isActive, true);
    assert.equal(
      reactivated.employeeStatusId,
      masterId(store, "employeeStatus", "ACTIVE"),
    );
    assert.equal(reactivated.resignationDate, null);
    assert.equal(reactivated.terminatedAt, null);

    const audit = await repository.audit.listByEntity(
      ctx.organizationId,
      "employee",
      employee.id,
    );
    assert.ok(
      audit.some((row) => row.actionCode === "employee.employment_reactivated"),
    );
  });
});
