import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HR_ENTITLEMENTS } from "../src/lib/hr/entitlements";
import { HR_PERMISSIONS } from "../src/lib/hr/permissions";
import {
  HR_ROUTE_PREFIX,
  HR_ROUTE_REGISTRY,
  hrNavRegistry,
  hrPath,
} from "../src/lib/hr/routes";
import {
  isHrStandaloneDebugShell,
  resolveHrShellMode,
} from "../src/lib/hr/shell-mode";
import { PLATFORM_CONTEXT_COOKIE_NAME } from "../src/lib/platform/context-cookie";

describe("Phase 8B Unified Shell compatibility", () => {
  it("keeps the Platform context cookie name shared (no second cookie)", () => {
    assert.equal(PLATFORM_CONTEXT_COOKIE_NAME, "gs_platform_ctx");
  });

  it("registers canonical /hr business routes", () => {
    assert.equal(HR_ROUTE_PREFIX, "/hr");
    const paths = HR_ROUTE_REGISTRY.map((r) => r.path);
    for (const required of [
      "/hr",
      "/hr/employees",
      "/hr/employees/new",
      "/hr/employees/[id]",
      "/hr/settings/departments",
      "/hr/settings/positions",
      "/hr/settings/shifts",
      "/hr/settings/payroll-schedules",
      "/hr/payroll/periods",
    ]) {
      assert.ok(paths.includes(required), `missing ${required}`);
    }
    for (const route of HR_ROUTE_REGISTRY) {
      assert.ok(route.path.startsWith("/hr"), route.path);
      assert.ok(route.requiredEntitlements.includes(HR_ENTITLEMENTS.access));
      assert.ok(route.labelTh.length > 0);
    }
  });

  it("attaches permissions and entitlements on every nav entry", () => {
    for (const route of hrNavRegistry()) {
      assert.ok(route.nav);
      assert.ok(Array.isArray(route.requiredPermissions));
      assert.ok(route.requiredEntitlements.length >= 1);
    }
    assert.ok(
      hrNavRegistry().some((r) =>
        r.requiredPermissions.includes(HR_PERMISSIONS.employeeRead),
      ),
    );
  });

  it("builds concrete paths from the registry", () => {
    assert.equal(hrPath("employeesDetail", { id: "abc" }), "/hr/employees/abc");
    assert.equal(
      hrPath("payrollPeriodDetail", { id: "p1" }),
      "/hr/payroll/periods/p1",
    );
  });

  it("defaults standalone debug shell off in production", () => {
    assert.equal(
      isHrStandaloneDebugShell({ NODE_ENV: "production" }),
      false,
    );
    assert.equal(
      resolveHrShellMode({ NODE_ENV: "production" }),
      "product",
    );
  });

  it("allows explicit debug shell and embedded product mode", () => {
    assert.equal(
      isHrStandaloneDebugShell({
        NODE_ENV: "production",
        HR_STANDALONE_DEBUG: "true",
      }),
      true,
    );
    assert.equal(
      isHrStandaloneDebugShell({
        NODE_ENV: "development",
        HR_EMBEDDED_IN_CUSTOMER_APP: "true",
      }),
      false,
    );
    assert.equal(
      isHrStandaloneDebugShell({
        NODE_ENV: "development",
        HR_STANDALONE_DEBUG: "false",
      }),
      false,
    );
    assert.equal(
      isHrStandaloneDebugShell(
        { NODE_ENV: "development" },
        new Headers({ "x-gs-customer-shell": "1" }),
      ),
      false,
    );
  });

  it("keeps migration SQL free of UI shell concerns", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        "..",
        "prisma/migrations/0001_hr_core/migration.sql",
      ),
      "utf8",
    );
    assert.match(sql, /CREATE SCHEMA IF NOT EXISTS "hr"/i);
    assert.doesNotMatch(sql, /login|sidebar|header|gs_platform_ctx|goldensoft-app/i);
  });
});
