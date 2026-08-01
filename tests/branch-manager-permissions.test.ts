import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { hrPermissionsForOrganizationRoles } from "../src/lib/hr/permissions";

const ROOT = path.resolve(__dirname, "..");

describe("BRANCH_MANAGER permissions", () => {
  it("grants approve codes without full org admin catalog", () => {
    const codes = hrPermissionsForOrganizationRoles(["BRANCH_MANAGER"]);
    assert.ok(codes.includes("hr.leave.approve"));
    assert.ok(codes.includes("hr.overtime.approve"));
    assert.ok(codes.includes("hr.attendance.manage"));
    assert.ok(codes.includes("hr.leave.self"));
    assert.ok(!codes.includes("hr.employee.read"));
    assert.ok(!codes.includes("hr.settings.manage"));
    assert.ok(!codes.includes("hr.payroll.approve"));
  });

  it("keeps OWNER/ADMIN as full catalog", () => {
    const owner = hrPermissionsForOrganizationRoles(["OWNER"]);
    assert.ok(owner.includes("hr.employee.read"));
    assert.ok(owner.includes("hr.leave.approve"));
  });

  it("leave SPA form uses method=post so nav overlay does not stick", () => {
    const leave = fs.readFileSync(
      path.join(ROOT, "src/components/hr/me-leave-workspace.tsx"),
      "utf8",
    );
    assert.match(leave, /method="post"/);
    const pending = fs.readFileSync(
      path.join(ROOT, "src/components/hr/navigation-pending.tsx"),
      "utf8",
    );
    assert.match(pending, /defaultPrevented/);
  });
});
