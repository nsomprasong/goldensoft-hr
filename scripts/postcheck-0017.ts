/**
 * Post-apply verification for migration 0017 (read-only).
 */
import fs from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import {
  buildDatabasePoolConfig,
  buildTrustedPgSsl,
  loadSupabaseDbCaCertificate,
} from "../src/lib/db/ca-certificate";
import { loadProjectEnv } from "./load-project-env";

loadProjectEnv(process.cwd());

const databaseUrl = process.env.DATABASE_URL!;
const configuredCaPath = process.env.SUPABASE_DB_CA_CERT_PATH ?? "";
const { content } = loadSupabaseDbCaCertificate(configuredCaPath, process.cwd());
const ssl = buildTrustedPgSsl(content);
const pool = new Pool(buildDatabasePoolConfig(databaseUrl, ssl, { max: 1 }));

async function q<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
  return (await pool.query(sql)).rows as T[];
}

async function main() {
  const beforePath = path.resolve("docs/.migration-0017-before.json");
  // optional; we pass expected before count via env if present
  const expectedBefore = Number(process.env.EMPLOYEE_COUNT_BEFORE ?? "75");

  const migration = await q<{
    migration_name: string;
    finished: boolean;
    rolled_back: boolean;
  }>(`
    SELECT migration_name,
           finished_at IS NOT NULL AS finished,
           rolled_back_at IS NOT NULL AS rolled_back
    FROM _prisma_migrations
    WHERE migration_name = '0017_multi_org_auth_employee'
  `);
  console.log("MIGRATION_ROW", JSON.stringify(migration));

  const objects = await q(`
    SELECT
      (SELECT COUNT(*)::int FROM information_schema.tables
        WHERE table_schema='hr' AND table_name='employee_account_access_statuses') AS account_access_table,
      (SELECT COUNT(*)::int FROM information_schema.tables
        WHERE table_schema='hr' AND table_name='employee_onboarding_methods') AS onboarding_table,
      (SELECT COUNT(*)::int FROM information_schema.tables
        WHERE table_schema='hr' AND table_name='employee_activation_statuses') AS activation_status_table,
      (SELECT COUNT(*)::int FROM information_schema.tables
        WHERE table_schema='hr' AND table_name='employee_activation_challenges') AS challenges_table,
      (SELECT COUNT(*)::int FROM pg_indexes
        WHERE schemaname='hr' AND indexname='employees_org_auth_active_uidx') AS partial_auth_idx,
      (SELECT COUNT(*)::int FROM pg_indexes
        WHERE schemaname='hr' AND indexname='employees_org_platform_user_active_uidx') AS partial_platform_idx,
      (SELECT COUNT(*)::int FROM pg_indexes
        WHERE schemaname='hr' AND indexname='employees_organization_id_auth_user_id_key') AS old_auth_unique,
      (SELECT COUNT(*)::int FROM pg_indexes
        WHERE schemaname='hr' AND indexname='employees_organization_id_platform_user_id_key') AS old_platform_unique
  `);
  console.log("OBJECTS", JSON.stringify(objects[0], null, 2));

  const columns = await q(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema='hr' AND table_name='employees'
      AND column_name IN (
        'account_access_status_id',
        'onboarding_method_id',
        'account_activated_at',
        'account_disabled_at'
      )
    ORDER BY column_name
  `);
  console.log("EMPLOYEE_COLUMNS", JSON.stringify(columns, null, 2));

  const masters = await q(`
    SELECT 'account_access' AS kind, code, COUNT(*)::int AS n
    FROM hr.employee_account_access_statuses
    GROUP BY code
    UNION ALL
    SELECT 'onboarding', code, COUNT(*)::int
    FROM hr.employee_onboarding_methods
    GROUP BY code
    UNION ALL
    SELECT 'activation_status', code, COUNT(*)::int
    FROM hr.employee_activation_statuses
    GROUP BY code
    ORDER BY 1, 2
  `);
  console.log("MASTERS", JSON.stringify(masters, null, 2));

  const fks = await q(`
    SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'hr'
      AND tc.table_name = 'employee_activation_challenges'
      AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.constraint_name
  `);
  console.log("CHALLENGE_FKS", JSON.stringify(fks, null, 2));

  const counts = await q<{
    employee_count: number;
    active_employees: number;
    with_auth: number;
    null_access_status: number;
    access_active: number;
    access_not_linked: number;
    access_disabled: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM hr.employees) AS employee_count,
      (SELECT COUNT(*)::int FROM hr.employees WHERE is_active = true) AS active_employees,
      (SELECT COUNT(*)::int FROM hr.employees WHERE auth_user_id IS NOT NULL) AS with_auth,
      (SELECT COUNT(*)::int FROM hr.employees WHERE account_access_status_id IS NULL) AS null_access_status,
      (SELECT COUNT(*)::int FROM hr.employees e
        JOIN hr.employee_account_access_statuses s ON s.id = e.account_access_status_id
        WHERE s.code = 'ACTIVE') AS access_active,
      (SELECT COUNT(*)::int FROM hr.employees e
        JOIN hr.employee_account_access_statuses s ON s.id = e.account_access_status_id
        WHERE s.code = 'NOT_LINKED') AS access_not_linked,
      (SELECT COUNT(*)::int FROM hr.employees e
        JOIN hr.employee_account_access_statuses s ON s.id = e.account_access_status_id
        WHERE s.code = 'DISABLED') AS access_disabled
  `);
  console.log("COUNTS", JSON.stringify(counts[0], null, 2));
  console.log("EXPECTED_BEFORE", expectedBefore);

  const authDup = await q(`
    SELECT COUNT(*)::int AS n FROM (
      SELECT 1
      FROM hr.employees
      WHERE is_active = true AND auth_user_id IS NOT NULL
      GROUP BY organization_id, auth_user_id
      HAVING COUNT(*) > 1
    ) d
  `);
  const platDup = await q(`
    SELECT COUNT(*)::int AS n FROM (
      SELECT 1
      FROM hr.employees
      WHERE is_active = true AND platform_user_id IS NOT NULL
      GROUP BY organization_id, platform_user_id
      HAVING COUNT(*) > 1
    ) d
  `);
  console.log("DUP_AUTH", authDup[0]);
  console.log("DUP_PLATFORM", platDup[0]);

  const sample = await q(`
    SELECT id::text, employee_code, is_active, auth_user_id IS NOT NULL AS has_auth,
           account_access_status_id IS NOT NULL AS has_access_status
    FROM hr.employees
    ORDER BY created_at
    LIMIT 5
  `);
  console.log("SAMPLE_EMPLOYEES", JSON.stringify(sample, null, 2));

  const failures: string[] = [];
  if (!migration[0]?.finished || migration[0]?.rolled_back) {
    failures.push("0017 not finished cleanly");
  }
  const o = objects[0]!;
  if (
    !o.account_access_table ||
    !o.onboarding_table ||
    !o.activation_status_table ||
    !o.challenges_table
  ) {
    failures.push("missing master/challenge tables");
  }
  if (!o.partial_auth_idx || !o.partial_platform_idx) {
    failures.push("missing partial unique indexes");
  }
  if (o.old_auth_unique || o.old_platform_unique) {
    failures.push("old full unique indexes still present");
  }
  if (columns.length !== 4 || columns.some((c) => c.is_nullable !== "YES")) {
    failures.push("employee additive columns missing or not nullable");
  }
  if (Number(counts[0]!.employee_count) < expectedBefore) {
    failures.push(
      `employee count decreased: before=${expectedBefore} after=${counts[0]!.employee_count}`,
    );
  }
  if (Number(counts[0]!.null_access_status) !== 0) {
    failures.push("some employees still lack account_access_status_id");
  }
  if (Number(authDup[0]!.n) !== 0 || Number(platDup[0]!.n) !== 0) {
    failures.push("duplicates present after migration");
  }

  // Master codes expected
  const codes = new Set(masters.map((m) => `${m.kind}:${m.code}`));
  for (const needed of [
    "account_access:NOT_LINKED",
    "account_access:PENDING_ACTIVATION",
    "account_access:ACTIVE",
    "account_access:DISABLED",
    "onboarding:OTP_VERIFICATION",
    "onboarding:INVITATION",
    "onboarding:NO_NOTIFICATION",
    "activation_status:PENDING",
    "activation_status:VERIFIED",
    "activation_status:EXPIRED",
    "activation_status:CANCELLED",
  ]) {
    if (!codes.has(needed)) failures.push(`missing master ${needed}`);
  }
  if (masters.some((m) => Number(m.n) !== 1)) {
    failures.push("duplicate master codes");
  }

  if (failures.length) {
    console.error("POSTCHECK_FAIL", failures.join("; "));
    process.exit(3);
  }
  console.log("POSTCHECK_OK");
  if (fs.existsSync(beforePath)) {
    // noop placeholder for optional artifact
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
