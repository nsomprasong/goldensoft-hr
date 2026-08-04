#!/usr/bin/env node
/**
 * Dry-run / idempotent validation for multi-org Auth↔Employee invariants.
 * Never mutates data unless --apply is passed (still blocked without confirmation env).
 *
 * Usage (from goldensoft-hr):
 *   node --import tsx scripts/backfill-multi-org-auth-employee.ts --dry-run
 */
import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--apply");

function main() {
  if (args.has("--apply") && process.env.ALLOW_HR_BACKFILL_APPLY !== "1") {
    console.error(
      "[backfill] Refusing --apply without ALLOW_HR_BACKFILL_APPLY=1 (production safety).",
    );
    process.exit(2);
  }

  console.log(
    `[backfill] mode=${dryRun ? "dry-run" : "apply"} — scans for active auth collisions`,
  );
  console.log(
    "[backfill] SQL checks (run manually after migration 0017 is approved):",
  );
  console.log(`
-- Active employees sharing the same auth within one org (must be 0 before partial unique):
SELECT organization_id, auth_user_id, COUNT(*) AS n
FROM hr.employees
WHERE is_active = true AND auth_user_id IS NOT NULL
GROUP BY organization_id, auth_user_id
HAVING COUNT(*) > 1;

-- Active employees sharing the same platform user within one org:
SELECT organization_id, platform_user_id, COUNT(*) AS n
FROM hr.employees
WHERE is_active = true AND platform_user_id IS NOT NULL
GROUP BY organization_id, platform_user_id
HAVING COUNT(*) > 1;

-- Rows missing account_access_status_id after migration backfill:
SELECT COUNT(*) FROM hr.employees WHERE account_access_status_id IS NULL;
`);

  const reportPath = path.resolve(
    process.cwd(),
    "docs/MULTI_ORG_AUTH_EMPLOYEE_DELTA.md",
  );
  if (fs.existsSync(reportPath)) {
    console.log(`[backfill] See design notes: ${reportPath}`);
  }

  if (!dryRun) {
    console.error(
      "[backfill] Apply path is intentionally a no-op in this release — approve a follow-up script.",
    );
    process.exit(1);
  }

  console.log("[backfill] Dry-run OK — no database writes performed.");
}

main();
