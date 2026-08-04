/**
 * Preflight read-only checks before applying migration 0017.
 * Never mutates data. Mirrors db-preflight TLS/env loading.
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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

const parsed = new URL(databaseUrl);
const projectHint = parsed.username.includes(".")
  ? parsed.username.split(".")[1]
  : null;
console.log(
  JSON.stringify({
    using: "DATABASE_URL",
    host: parsed.hostname,
    port: parsed.port,
    database: parsed.pathname.replace(/^\//, ""),
    user: parsed.username,
    projectHint,
  }),
);

const configuredCaPath = process.env.SUPABASE_DB_CA_CERT_PATH ?? "";
const { content } = loadSupabaseDbCaCertificate(configuredCaPath, process.cwd());
const ssl = buildTrustedPgSsl(content);
const pool = new Pool(buildDatabasePoolConfig(databaseUrl, ssl, { max: 1 }));

async function q<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

async function main() {
  const snap = await q<{
    employee_count: number;
    active_employees: number;
    with_auth: number;
    has_account_access_master: number;
    has_onboarding_master: number;
    has_activation_status_master: number;
    has_challenges: number;
    has_partial_auth_idx: number;
    has_partial_platform_idx: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM hr.employees) AS employee_count,
      (SELECT COUNT(*)::int FROM hr.employees WHERE is_active = true) AS active_employees,
      (SELECT COUNT(*)::int FROM hr.employees WHERE auth_user_id IS NOT NULL) AS with_auth,
      (SELECT COUNT(*)::int FROM information_schema.tables
        WHERE table_schema='hr' AND table_name='employee_account_access_statuses') AS has_account_access_master,
      (SELECT COUNT(*)::int FROM information_schema.tables
        WHERE table_schema='hr' AND table_name='employee_onboarding_methods') AS has_onboarding_master,
      (SELECT COUNT(*)::int FROM information_schema.tables
        WHERE table_schema='hr' AND table_name='employee_activation_statuses') AS has_activation_status_master,
      (SELECT COUNT(*)::int FROM information_schema.tables
        WHERE table_schema='hr' AND table_name='employee_activation_challenges') AS has_challenges,
      (SELECT COUNT(*)::int FROM pg_indexes
        WHERE schemaname='hr' AND indexname='employees_org_auth_active_uidx') AS has_partial_auth_idx,
      (SELECT COUNT(*)::int FROM pg_indexes
        WHERE schemaname='hr' AND indexname='employees_org_platform_user_active_uidx') AS has_partial_platform_idx
  `);
  console.log("SNAPSHOT", JSON.stringify(snap[0], null, 2));

  const localLike = await q<{ migration_name: string; finished: boolean }>(`
    SELECT migration_name, finished_at IS NOT NULL AS finished
    FROM _prisma_migrations
    WHERE migration_name IN (
      '0015_face_matching',
      '0016_tax_sso_depth',
      '0017_multi_org_auth_employee'
    )
    OR migration_name LIKE '0017%'
    ORDER BY migration_name
  `);
  console.log("RECENT_HR_MIGRATIONS", JSON.stringify(localLike, null, 2));

  const authDup = await q(`
    SELECT organization_id::text AS organization_id,
           auth_user_id::text AS auth_user_id,
           COUNT(*)::int AS n
    FROM hr.employees
    WHERE is_active = true AND auth_user_id IS NOT NULL
    GROUP BY organization_id, auth_user_id
    HAVING COUNT(*) > 1
  `);
  console.log("AUTH_DUP_COUNT", authDup.length);
  if (authDup.length) console.log("AUTH_DUPS", JSON.stringify(authDup));

  const platDup = await q(`
    SELECT organization_id::text AS organization_id,
           platform_user_id::text AS platform_user_id,
           COUNT(*)::int AS n
    FROM hr.employees
    WHERE is_active = true AND platform_user_id IS NOT NULL
    GROUP BY organization_id, platform_user_id
    HAVING COUNT(*) > 1
  `);
  console.log("PLATFORM_DUP_COUNT", platDup.length);
  if (platDup.length) console.log("PLATFORM_DUPS", JSON.stringify(platDup));

  const schemas = await q(`
    SELECT nspname FROM pg_namespace
    WHERE nspname IN ('hr','public','platform','auth','legacy','resident')
    ORDER BY 1
  `);
  console.log("SCHEMAS", JSON.stringify(schemas));

  const recovery = await q(`
    SELECT
      current_setting('server_version') AS pg_version,
      current_database() AS database,
      current_user AS db_user
  `);
  console.log("RECOVERY_HINTS", JSON.stringify(recovery[0], null, 2));

  const caPath = path.resolve(process.cwd(), "certs/prod-ca-2021.crt");
  console.log(
    "RECOVERY_MECHANISM",
    JSON.stringify({
      managedSupabaseProject: projectHint,
      matchesDeployerExample: projectHint === "horyhrnqbeaivdztekfv",
      localCaPresent: fs.existsSync(caPath),
      note: "Managed Supabase backups / PITR via project dashboard",
    }),
  );

  const sql = fs.readFileSync(
    "prisma/migrations/0017_multi_org_auth_employee/migration.sql",
    "utf8",
  );
  const sqlFlags = {
    dropTable: /DROP\s+TABLE/i.test(sql),
    dropColumn: /DROP\s+COLUMN/i.test(sql),
    truncate: /TRUNCATE/i.test(sql),
    delete: /\bDELETE\s+FROM\b/i.test(sql),
    dropIndex: /DROP\s+INDEX/i.test(sql),
    update: /\bUPDATE\b/i.test(sql),
  };
  console.log("SQL_FLAGS", JSON.stringify(sqlFlags));

  const pendingOnly = await q<{ pending: string[] }>(`
    SELECT ARRAY(
      SELECT m FROM unnest(ARRAY[
        '0017_multi_org_auth_employee'
      ]) AS m
      WHERE NOT EXISTS (
        SELECT 1 FROM _prisma_migrations pm
        WHERE pm.migration_name = m
          AND pm.finished_at IS NOT NULL
          AND pm.rolled_back_at IS NULL
      )
    ) AS pending
  `);
  console.log("PENDING_APPROVED", JSON.stringify(pendingOnly[0]));

  const blockers: string[] = [];
  if (authDup.length) blockers.push("active auth duplicates exist");
  if (platDup.length) blockers.push("active platform_user duplicates exist");
  if (
    localLike.some(
      (r) =>
        r.migration_name === "0017_multi_org_auth_employee" && r.finished,
    )
  ) {
    blockers.push("0017 already applied");
  }
  if (projectHint !== "horyhrnqbeaivdztekfv") {
    blockers.push(`unexpected project ref: ${projectHint}`);
  }
  if (!fs.existsSync(caPath)) {
    blockers.push("TLS CA certificate missing");
  }

  if (blockers.length) {
    console.error("BLOCKERS", blockers.join("; "));
    process.exit(3);
  }
  console.log("PREFLIGHT_OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
