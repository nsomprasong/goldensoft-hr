import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Structural checks for the Phase 8B HR UI. Files are read as text so the suite
 * stays runnable without a browser, a database, or a Next.js build.
 */

const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "src/app");
const COMPONENTS = path.join(ROOT, "src/components");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(ROOT, relativePath));
}

const PAGES = [
  "src/app/hr/page.tsx",
  "src/app/hr/employees/page.tsx",
  "src/app/hr/employees/new/page.tsx",
  "src/app/hr/employees/[id]/page.tsx",
  "src/app/hr/employees/[id]/edit/page.tsx",
  "src/app/hr/settings/departments/page.tsx",
  "src/app/hr/settings/positions/page.tsx",
  "src/app/hr/settings/shifts/page.tsx",
  "src/app/hr/settings/overtime-rules/page.tsx",
  "src/app/hr/settings/payroll-schedules/page.tsx",
  "src/app/hr/payroll/periods/page.tsx",
  "src/app/hr/payroll/periods/[id]/page.tsx",
];

/** Phase 8B core + HR 100% suite pages (allowed inventory). */
const HR100_PAGES = [
  "src/app/hr/settings/page.tsx",
  "src/app/hr/me/page.tsx",
  "src/app/hr/me/attendance/page.tsx",
  "src/app/hr/me/schedule/page.tsx",
  "src/app/hr/me/leave/page.tsx",
  "src/app/hr/me/overtime/page.tsx",
  "src/app/hr/me/payslips/page.tsx",
  "src/app/hr/me/payslips/[id]/page.tsx",
  "src/app/hr/schedules/page.tsx",
  "src/app/hr/schedules/[id]/page.tsx",
  "src/app/hr/schedules/[id]/shifts/[shiftId]/page.tsx",
  "src/app/hr/calendars/page.tsx",
  "src/app/hr/locations/page.tsx",
  "src/app/hr/attendance/page.tsx",
  "src/app/hr/attendance/exceptions/page.tsx",
  "src/app/hr/attendance/adjustments/page.tsx",
  "src/app/hr/leave/page.tsx",
  "src/app/hr/leave/history/page.tsx",
  "src/app/hr/leave/balances/page.tsx",
  "src/app/hr/settings/leave-entitlements/page.tsx",
  "src/app/hr/settings/payroll-deductions/page.tsx",
  "src/app/hr/overtime/page.tsx",
  "src/app/hr/overtime/history/page.tsx",
  "src/app/hr/approvals/page.tsx",
  "src/app/hr/approvals/history/page.tsx",
  "src/app/hr/compensation/page.tsx",
  "src/app/hr/pay-items/page.tsx",
  "src/app/hr/payroll/runs/page.tsx",
  "src/app/hr/payroll/runs/[id]/page.tsx",
  "src/app/hr/payroll/review/page.tsx",
  "src/app/hr/payslips/page.tsx",
  "src/app/hr/payslips/[id]/page.tsx",
  "src/app/hr/advances/page.tsx",
  "src/app/hr/reports/page.tsx",
];

const FORMS = [
  "src/components/hr/employee-form.tsx",
  "src/components/hr/department-form.tsx",
  "src/components/hr/position-form.tsx",
  "src/components/hr/shift-form.tsx",
  "src/components/hr/overtime-rule-form.tsx",
  "src/components/hr/payroll-schedule-form.tsx",
  "src/components/hr/compensation-form.tsx",
  "src/components/hr/payroll-period-form.tsx",
  "src/components/hr/payroll-period-status-form.tsx",
];

const THAI = /[\u0E00-\u0E7F]/;

describe("Phase 8B routes", () => {
  it("ships every planned page", () => {
    for (const page of PAGES) {
      assert.ok(exists(page), `expected page ${page}`);
    }
  });

  it("guards every page with requireHrPage", () => {
    for (const page of PAGES) {
      const source = read(page);
      assert.match(
        source,
        /requireHrPage\(/,
        `${page} should authenticate through requireHrPage`,
      );
    }
  });

  it("requires an explicit HR permission outside the dashboard", () => {
    // A page may accept any one of several codes, so the value is either a
    // single code or an array literal of them.
    for (const page of PAGES.filter((p) => p !== "src/app/hr/page.tsx")) {
      assert.match(
        read(page),
        /permission:\s*(HR_PERMISSIONS\.|\[\s*HR_PERMISSIONS\.)/,
        `${page} should require an HR_PERMISSIONS code`,
      );
    }
  });

  it("renders every page inside the HR shell", () => {
    for (const page of PAGES) {
      const source = read(page);
      // Redirect-only pages do not render chrome.
      if (/redirect\(/.test(source) && !/<HrShell/.test(source)) continue;
      assert.match(source, /<HrShell/, `${page} should render HrShell`);
    }
  });

  it("keeps user-facing copy in Thai", () => {
    for (const page of [...PAGES, ...FORMS]) {
      const source = read(page);
      if (/redirect\(/.test(source) && !THAI.test(source)) continue;
      assert.ok(THAI.test(source), `${page} should contain Thai copy`);
    }
  });
});

describe("Phase 8B actions are real", () => {
  it("wires every form to an /api/hr route", () => {
    for (const form of FORMS) {
      const source = read(form);
      assert.match(
        source,
        /submitHrJson\(\s*[`"']\/api\/hr\//,
        `${form} should submit to a real /api/hr route`,
      );
    }
  });

  it("submits with a real HTTP method", () => {
    for (const form of FORMS) {
      assert.match(
        read(form),
        /"(POST|PATCH|PUT|DELETE)"/,
        `${form} should use an explicit HTTP method`,
      );
    }
  });

  it("has no placeholder or disabled-only actions", () => {
    for (const file of [...PAGES, ...FORMS]) {
      const source = read(file);
      assert.doesNotMatch(source, /TODO|coming soon|เร็ว ๆ นี้|ยังไม่เปิดใช้งาน/i);
      assert.doesNotMatch(
        source,
        /onClick=\{\s*\(\)\s*=>\s*\{\s*\}\s*\}/,
        `${file} should not contain empty click handlers`,
      );
      assert.doesNotMatch(
        source,
        /href="#"/,
        `${file} should not contain placeholder links`,
      );
      assert.doesNotMatch(
        source,
        /alert\(['"`]/,
        `${file} should not fake feedback with window.alert`,
      );
    }
  });

  it("only calls /api/hr paths that actually have a route handler", () => {
    const missing: string[] = [];
    for (const form of FORMS) {
      const source = read(form);
      for (const match of source.matchAll(/\/api\/hr\/[A-Za-z0-9\-_/$.{}]*/g)) {
        const normalized = match[0]
          .replace(/\$\{[^}]*\}/g, "[id]")
          .replace(/\/+$/, "");
        const segments = normalized.split("/").slice(3);
        // The generic toggle builds its resource from a prop, so skip those.
        if (segments[0] === "[id]") continue;
        const route = path.join(
          "src/app/api/hr",
          ...segments,
          "route.ts",
        );
        if (!exists(route)) missing.push(`${form} → ${normalized}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  it("covers every resource the toggle button can deactivate", () => {
    const source = read("src/components/hr/toggle-active-button.tsx");
    const resources = [
      "employees",
      "departments",
      "positions",
      "shifts",
      "overtime-rules",
      "payroll-schedules",
    ];
    for (const resource of resources) {
      assert.ok(source.includes(`"${resource}"`), `expected ${resource}`);
      assert.ok(
        exists(`src/app/api/hr/${resource}/[id]/route.ts`),
        `expected an API route for ${resource}`,
      );
    }
    assert.match(source, /"DELETE"/);
    assert.match(source, /\/api\/hr\/employees\/\$\{id\}\/deactivate/);
  });

  it("performs mutations through fetch, never a form action attribute", () => {
    assert.match(
      read("src/components/hr/form-utils.ts"),
      /await fetch\(url, \{/,
      "submitHrJson should call fetch",
    );
    for (const form of FORMS) {
      assert.doesNotMatch(
        read(form),
        /action="\/(?!api\/hr)/,
        "mutating forms must not post to a non-API path",
      );
    }
  });

  it("navigates search and pagination through real GET links", () => {
    const employees = read("src/app/hr/employees/page.tsx");
    assert.match(employees, /method="get"/);
    assert.match(employees, /action="\/hr\/employees"/);
    assert.match(employees, /name="employeeStatusId"/);
    assert.match(employees, /name="employmentTypeId"/);
    assert.match(employees, /pageHref\(params, result\.page - 1\)/);
    assert.match(employees, /pageHref\(params, result\.page \+ 1\)/);
  });
});

describe("Phase 8B permission gating", () => {
  it("gates compensation under employment behind hr.compensation.read", () => {
    const detail = read("src/app/hr/employees/[id]/page.tsx");
    const employment = read("src/components/hr/employee-tab-sections.tsx");
    assert.match(detail, /HR_PERMISSIONS\.compensationRead/);
    assert.match(detail, /documents/);
    assert.match(
      detail,
      /activeTab === "employment"/,
      "compensation lives under the employment tab",
    );
    assert.match(
      employment,
      /canReadCompensation/,
      "compensation history must require the read permission",
    );
    assert.match(
      employment,
      /canManageCompensation/,
      "compensation form must require the manage permission",
    );
  });

  it("declares fine-grained HR permission codes", () => {
    const permissions = read("src/lib/hr/permissions.ts");
    for (const code of [
      "hr.employee.read",
      "hr.employee.create",
      "hr.employee.update",
      "hr.employee.deactivate",
      "hr.employee.link_user",
      "hr.compensation.read",
      "hr.compensation.manage",
      "hr.department.manage",
      "hr.position.manage",
      "hr.shift.manage",
      "hr.payroll_schedule.manage",
      "hr.payroll_period.manage",
    ]) {
      assert.ok(permissions.includes(code), `expected permission ${code}`);
    }
    assert.doesNotMatch(
      permissions,
      /MEMBER_PERMISSIONS[^;]*compensation/s,
      "plain members must never receive compensation access",
    );
  });

  it("hides navigation links the user cannot open", () => {
    const frame = read("src/components/hr/product-frame.tsx");
    assert.match(frame, /canHr\(ctx, route\.requiredPermissions\)/);
    assert.match(frame, /hrNavRegistry/);
    const routes = read("src/lib/hr/routes.ts");
    for (const label of [
      "แดชบอร์ด",
      "พนักงาน",
      "แผนก",
      "ตำแหน่ง",
      "กะงาน",
      "กฎ OT",
      "รอบจ่าย",
      "งวดเงินเดือน",
    ]) {
      assert.ok(routes.includes(label), `expected nav label ${label}`);
    }
  });

  it("only renders management controls for permitted roles", () => {
    const workspaces: Record<string, string> = {
      "src/app/hr/settings/shifts/page.tsx":
        "src/components/hr/shifts-workspace.tsx",
    };
    for (const page of [
      "src/app/hr/settings/departments/page.tsx",
      "src/app/hr/settings/positions/page.tsx",
      "src/app/hr/settings/shifts/page.tsx",
      "src/app/hr/settings/overtime-rules/page.tsx",
      "src/app/hr/settings/payroll-schedules/page.tsx",
    ]) {
      const source = read(page);
      assert.match(source, /canHr\(ctx, HR_PERMISSIONS\.\w+Manage\)/, page);
      const workspacePath = workspaces[page];
      const gateSource = workspacePath
        ? `${source}\n${read(workspacePath)}`
        : source;
      assert.match(gateSource, /canManage \?/, page);
    }
  });
});

describe("Phase 8B validation feedback", () => {
  it("validates client-side before calling the API", () => {
    for (const form of FORMS) {
      const source = read(form);
      assert.match(
        source,
        /setErrors?\(/,
        `${form} should track field-level errors`,
      );
      assert.match(
        source,
        /noValidate/,
        `${form} should own its validation messages`,
      );
    }
  });

  it("auto-generates business codes instead of asking users to type them", () => {
    // Employee form never surfaces codes in UI; server assigns employeeCode.
    const employeeForm = read("src/components/hr/employee-form.tsx");
    assert.doesNotMatch(
      employeeForm,
      /employeeCode|รหัสพนักงาน|validateCode\(/,
      "employee form must not show or require codes",
    );

    for (const form of [
      "src/components/hr/department-form.tsx",
      "src/components/hr/position-form.tsx",
      "src/components/hr/shift-form.tsx",
      "src/components/hr/overtime-rule-form.tsx",
      "src/components/hr/payroll-schedule-form.tsx",
    ]) {
      const source = read(form);
      assert.match(source, /สร้างอัตโนมัติ/, form);
      assert.doesNotMatch(
        source,
        /validateCode\(values\.(?:code|employeeCode)\)/,
        `${form} must not require a manual code on create`,
      );
    }
  });

  it("shows Thai success and error feedback", () => {
    for (const form of FORMS) {
      const source = read(form);
      assert.match(
        source,
        /kind: "error"/,
        `${form} should surface an error state`,
      );
      assert.match(
        source,
        /Alert kind=\{feedback\.kind\}/,
        `${form} should render an inline alert`,
      );
    }
  });

  it("renders field errors with an accessible role", () => {
    const field = read("src/components/hr/field.tsx");
    assert.match(field, /className="field-error"/);
    assert.match(field, /role="alert"/);
    assert.match(field, /aria-invalid/);
  });

  it("maps server validation errors back onto fields", () => {
    const utils = read("src/components/hr/form-utils.ts");
    assert.match(utils, /fieldErrors/);
    assert.match(utils, /issues/);
    assert.match(utils, /ข้อมูลไม่ถูกต้อง/);
  });
});

describe("Phase 8B resilience without the migration", () => {
  it("keeps reads fail-safe and typed", () => {
    const data = read("src/lib/hr/data.ts");
    assert.match(data, /ฐานข้อมูล HR ยังไม่พร้อม — รออนุมัติ migration/);
    assert.match(data, /catch \(error\)/);
    assert.match(data, /available: false/);
  });

  it("tells the user when HR data is not ready", () => {
    for (const page of PAGES) {
      const source = read(page);
      if (/redirect\(/.test(source) && !/DatabaseUnavailableNotice/.test(source)) {
        continue;
      }
      assert.match(
        source,
        /DatabaseUnavailableNotice/,
        `${page} should render the migration notice`,
      );
    }
  });
});

describe("Phase 8B layout and styling", () => {
  it("loads the global stylesheet from the root layout", () => {
    const layout = read("src/app/layout.tsx");
    assert.match(layout, /import "\.\/globals\.css"/);
    assert.match(layout, /lang="th"/);
    assert.match(layout, /viewport/);
  });

  it("uses a Thai-first font stack instead of the Next.js default", () => {
    const layout = read("src/app/layout.tsx");
    const tokens = read("src/app/design-tokens.css");
    const css = read("src/app/globals.css");
    assert.match(layout, /from "next\/font\/google"/);
    assert.match(layout, /Anuphan/);
    assert.match(layout, /Prompt/);
    assert.match(tokens, /Anuphan/);
    assert.match(css, /--hr-font:\s*var\(--font-family-sans\)/);
    assert.doesNotMatch(layout, /fonts\.googleapis\.com/);
  });

  it("is responsive between 375px and 1440px", () => {
    const css = read("src/app/globals.css");
    const queries = css.match(/@media \(max-width: \d+px\)/g) ?? [];
    assert.ok(queries.length >= 3, "expected mobile/tablet breakpoints");
    assert.match(css, /--hr-content-max:\s*var\(--content-max\)/);
    assert.match(css, /max-width: var\(--hr-content-max\)/);
    assert.match(css, /overflow-x: auto/);
    assert.match(css, /minmax\(/);
  });

  it("keeps the sticky header clear of page content", () => {
    const css = read("src/app/globals.css");
    assert.match(css, /\.hr-header \{[^}]*position: sticky/s);
    assert.match(css, /scroll-padding-top/);
    // The mobile menu expands in flow (details/summary), so it cannot overlay.
    assert.match(
      css,
      /\.hr-product-nav-mobile \.hr-product-nav \{[^}]*flex-direction: column/s,
    );
    const frame = read("src/components/hr/product-frame.tsx");
    assert.match(frame, /showProductNav/);
    assert.match(frame, /hr-product-nav-mobile/);
    assert.match(frame, /เมนู HR/);
    const shell = read("src/components/hr-shell.tsx");
    assert.match(shell, /Debug Shell/);
    assert.match(shell, /standalone_debug/);
    assert.match(shell, /showProductNav=\{false\}/);
    // Sticky page header only — overlays/FAB/pending may use fixed.
    assert.doesNotMatch(
      css,
      /\.hr-header\s*\{[^}]*position:\s*fixed/s,
      "hr-header must stay sticky, not fixed",
    );
  });
});

describe("Phase 8B.3 product UI contract", () => {
  it("defines Thai-safe typography, density, and sRGB tokens", () => {
    const tokens = read("src/app/design-tokens.css");
    for (const token of [
      "--font-family-sans",
      "--font-size-page-title",
      "--font-size-body",
      "--font-size-label",
      "--line-height-normal",
      "--control-height",
      "--page-gutter",
      "--radius-lg",
      "--shadow-sm",
    ]) {
      assert.match(tokens, new RegExp(`${token}:`), `missing ${token}`);
    }
    const normal = Number(
      tokens.match(/--line-height-normal:\s*([\d.]+)/)?.[1],
    );
    assert.ok(normal >= 1.5);
    assert.doesNotMatch(tokens, /color-mix|oklch/);
  });

  it("scopes product element styles away from Customer Shell markup", () => {
    const css = read("src/app/globals.css");
    assert.match(css, /\.hr-root h1/);
    assert.match(css, /\.hr-root a/);
    assert.match(css, /\.hr-root table/);
    assert.match(css, /\.hr-root input/);
    assert.doesNotMatch(css, /\n(?:h1|a|table|label|input),?\s*\{/);
    const frame = read("src/components/hr/product-frame.tsx");
    assert.match(frame, /className="hr-root hr-product-frame"/);
    assert.match(css, /\.hr-product-body \{[^}]*max-width:[^}]*padding:/s);
  });

  it("keeps product pages free of hard-coded font families", () => {
    const pages = PAGES.map(read).join("\n");
    assert.doesNotMatch(pages, /fontFamily|font-family/);
    assert.doesNotMatch(pages, /bg-\$\{|text-\$\{|border-\$\{/);
  });
});

describe("Phase 8B project wiring", () => {
  it("keeps HR pages behind the middleware auth default", () => {
    const middleware = read("middleware.ts");
    const publicPrefixes = middleware.match(/PUBLIC_PREFIXES = \[(.*?)\]/s)?.[1] ?? "";
    for (const guarded of ["/hr", "/employees", "/settings", "/payroll"]) {
      assert.ok(
        !publicPrefixes.includes(`"${guarded}"`) &&
          !publicPrefixes.includes(`'${guarded}'`),
        `${guarded} must not be public`,
      );
    }
  });

  it("runs the UI suite from npm test", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    assert.match(pkg.scripts.test, /phase8b-ui\.test\.ts/);
  });

  it("does not leave stray page files outside the planned routes", () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === "page.tsx") {
          found.push(path.relative(ROOT, full).split(path.sep).join("/"));
        }
      }
    };
    walk(APP);

    const allowed = new Set([
      ...PAGES,
      ...HR100_PAGES,
      "src/app/page.tsx",
      "src/app/login/page.tsx",
      "src/app/access/page.tsx",
      "src/app/forbidden/page.tsx",
      "src/app/select-organization/page.tsx",
      "src/app/employees/page.tsx",
      "src/app/employees/new/page.tsx",
      "src/app/employees/[id]/page.tsx",
      "src/app/employees/[id]/edit/page.tsx",
      "src/app/settings/departments/page.tsx",
      "src/app/settings/positions/page.tsx",
      "src/app/settings/shifts/page.tsx",
      "src/app/settings/overtime-rules/page.tsx",
      "src/app/settings/payroll-schedules/page.tsx",
      "src/app/payroll/periods/page.tsx",
      "src/app/payroll/periods/[id]/page.tsx",
      "src/app/branches/[branchId]/page.tsx",
      "src/app/hr/branches/[branchId]/page.tsx",
    ]);
    for (const page of found) {
      assert.ok(allowed.has(page), `unexpected page ${page}`);
    }
    for (const page of HR100_PAGES) {
      assert.ok(exists(page), `expected HR100 page ${page}`);
    }
  });

  it("keeps shared HR form components together", () => {
    for (const form of FORMS) {
      assert.ok(
        form.startsWith("src/components/hr/"),
        `${form} should live under src/components/hr`,
      );
      assert.match(read(form), /^"use client";/);
    }
    assert.ok(fs.existsSync(path.join(COMPONENTS, "hr-shell.tsx")));
    assert.ok(fs.existsSync(path.join(COMPONENTS, "hr", "product-frame.tsx")));
    assert.ok(exists("src/lib/hr/routes.ts"));
    assert.ok(exists("docs/adr-unified-customer-shell.md"));
  });
});
