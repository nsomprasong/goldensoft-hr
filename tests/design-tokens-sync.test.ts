import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const HR_ROOT = path.resolve(__dirname, "..");
const APP_TOKENS = path.resolve(
  HR_ROOT,
  "..",
  "goldensoft-app",
  "src",
  "app",
  "design-tokens.css",
);
const HR_TOKENS = path.join(HR_ROOT, "src", "app", "design-tokens.css");

describe("design-tokens sync", () => {
  it("keeps HR tokens identical to the app canonical file", () => {
    assert.ok(fs.existsSync(APP_TOKENS), "app design-tokens.css missing");
    assert.ok(fs.existsSync(HR_TOKENS), "HR design-tokens.css missing");
    const app = fs.readFileSync(APP_TOKENS);
    const hr = fs.readFileSync(HR_TOKENS);
    const appHash = crypto.createHash("sha256").update(app).digest("hex");
    const hrHash = crypto.createHash("sha256").update(hr).digest("hex");
    assert.equal(
      hrHash,
      appHash,
      "HR tokens drifted — run npm run sync:design-tokens",
    );
  });

  it("exposes sync:design-tokens script", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(HR_ROOT, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    assert.ok(pkg.scripts?.["sync:design-tokens"]);
    assert.ok(
      fs.existsSync(path.join(HR_ROOT, "scripts", "sync-design-tokens.js")),
    );
  });
});
