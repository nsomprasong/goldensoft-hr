import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(__dirname, "..");
const LEGACY = path.resolve(ROOT, "..", "resident-legacy-reference");

describe("Legacy untouched", () => {
  it("does not nest or modify the resident legacy reference from HR", () => {
    // HR must not vendor legacy source (always check).
    assert.equal(fs.existsSync(path.join(ROOT, "resident-legacy-reference")), false);
    assert.equal(fs.existsSync(path.join(ROOT, "REFERENCE ONLY - Resident Legacy")), false);
    // Sibling folder exists only in the local suite checkout.
    if (!fs.existsSync(LEGACY)) return;
    assert.ok(fs.existsSync(path.join(LEGACY, "package.json")));
  });

  it("keeps HR product code and entitlement names fail-closed by default catalog", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "src/lib/hr/entitlements.ts"),
      "utf8",
    );
    assert.match(source, /hr\.access/);
    assert.match(source, /GOLDENSOFT_HR/);
    assert.doesNotMatch(source, /allowAllOrganizations|ALLOW_ALL/);
  });
});
