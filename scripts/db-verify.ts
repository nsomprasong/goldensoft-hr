import {
  checkHrMigrationApplied,
  HR_MIGRATION_NAME,
  type SqlQuery,
} from "./db-preflight";

// Env is loaded by the db-preflight import (project files win over ambient stubs).

export const HR_SCHEMA = "hr";

/** Master / lookup tables created and seeded by 0001_hr_core. */
export const MASTER_TABLES = [
  "employment_types",
  "employee_statuses",
  "shift_types",
  "pay_frequencies",
  "wage_types",
  "overtime_rate_types",
  "payroll_period_statuses",
  "audit_action_types",
] as const;

export const OPERATIONAL_TABLES = [
  "departments",
  "positions",
  "work_locations",
  "employees",
  "employee_branch_assignments",
  "employee_compensations",
  "overtime_rules",
  "shifts",
  "payroll_schedules",
  "payroll_periods",
  "audit_logs",
  "demo_seed_markers",
] as const;

export const HR_TABLES = [...MASTER_TABLES, ...OPERATIONAL_TABLES] as const;

export const EXPECTED_HR_TABLE_COUNT = HR_TABLES.length;

export const EXPECTED_MASTER_CODES: Record<string, readonly string[]> = {
  employment_types: ["DAILY", "MONTHLY", "CONTRACT", "TEMPORARY"],
  employee_statuses: [
    "ACTIVE",
    "INACTIVE",
    "RESIGNED",
    "TERMINATED",
    "SUSPENDED",
  ],
  shift_types: ["REGULAR", "NIGHT", "SPLIT", "OFF", "LEAVE"],
  pay_frequencies: ["SEMIMONTHLY", "MONTHLY", "WEEKLY", "DAILY"],
  wage_types: ["DAILY", "MONTHLY", "HOURLY"],
  overtime_rate_types: ["NORMAL_DAY", "HOLIDAY", "REST_DAY", "SPECIAL"],
  payroll_period_statuses: [
    "DRAFT",
    "OPEN",
    "CALCULATING",
    "REVIEW",
    "APPROVED",
    "PAID",
    "LOCKED",
  ],
};

const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdent(ident: string): string {
  if (!SAFE_IDENT.test(ident)) {
    throw new Error(`Unsafe SQL identifier rejected: ${ident}`);
  }
  return `"${ident}"`;
}

export type VerifyCheck = {
  name: string;
  ok: boolean;
  count?: number;
  detail?: string;
};

export type VerifyResult = {
  ok: boolean;
  /** True when 0001_hr_core has not been applied yet — checks are skipped, not failed. */
  skipped: boolean;
  checks: VerifyCheck[];
};

async function countHrTables(
  query: SqlQuery,
  tableNames: readonly string[],
): Promise<number> {
  const result = await query(
    `
    SELECT COUNT(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = 'hr'
      AND table_type = 'BASE TABLE'
      AND table_name = ANY($1::text[])
    `,
    [tableNames as unknown as string[]],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function countMasterTablesWithData(query: SqlQuery): Promise<{
  withData: number;
  total: number;
}> {
  let withData = 0;
  for (const table of MASTER_TABLES) {
    const result = await query(
      `SELECT COUNT(*)::int AS count FROM "hr".${quoteIdent(table)}`,
    );
    if (Number(result.rows[0]?.count ?? 0) >= 1) withData += 1;
  }
  return { withData, total: MASTER_TABLES.length };
}

async function countExpectedCodes(
  query: SqlQuery,
  table: string,
  codes: readonly string[],
): Promise<number> {
  const result = await query(
    `
    SELECT COUNT(*)::int AS count
    FROM "hr".${quoteIdent(table)}
    WHERE "code" = ANY($1::text[])
    `,
    [codes as unknown as string[]],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function countRows(query: SqlQuery, table: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM "hr".${quoteIdent(table)}`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Read-only HR verification (no PII / secrets in the result).
 * Returns `skipped: true` when 0001_hr_core has not been applied yet.
 */
export async function verifyHrDatabase(query: SqlQuery): Promise<VerifyResult> {
  const checks: VerifyCheck[] = [];

  const ping = await query("SELECT 1::int AS ok");
  const connected = Number(ping.rows[0]?.ok) === 1;
  checks.push({
    name: "database_connection",
    ok: connected,
    count: connected ? 1 : 0,
  });

  const schema = await query(
    `SELECT COUNT(*)::int AS count FROM information_schema.schemata WHERE schema_name = 'hr'`,
  );
  const schemaExists = Number(schema.rows[0]?.count ?? 0) >= 1;

  const migration = await checkHrMigrationApplied(query);
  checks.push({
    name: `migration_${HR_MIGRATION_NAME}`,
    ok: migration.applied,
    count: migration.appliedCount,
    detail: migration.applied
      ? `successful=${migration.appliedCount};rolled_back=${migration.rolledBackCount};unresolved=${migration.unresolvedCount}`
      : migration.reason,
  });

  if (!migration.applied) {
    // Not applied yet is the expected Phase 8B state — report, do not fail.
    checks.push({
      name: "schema_hr_exists",
      ok: true,
      count: schemaExists ? 1 : 0,
      detail: schemaExists ? "present" : "absent (migration not applied)",
    });
    return { ok: true, skipped: true, checks };
  }

  checks.push({
    name: "schema_hr_exists",
    ok: schemaExists,
    count: schemaExists ? 1 : 0,
  });

  const tableCount = await countHrTables(query, HR_TABLES);
  checks.push({
    name: "hr_tables",
    ok: tableCount === EXPECTED_HR_TABLE_COUNT,
    count: tableCount,
    detail: `${tableCount}/${EXPECTED_HR_TABLE_COUNT}`,
  });

  const masters = await countMasterTablesWithData(query);
  checks.push({
    name: "master_tables_with_data",
    ok: masters.withData === masters.total,
    count: masters.withData,
    detail: `${masters.withData}/${masters.total}`,
  });

  for (const [table, codes] of Object.entries(EXPECTED_MASTER_CODES)) {
    const found = await countExpectedCodes(query, table, codes);
    checks.push({
      name: `codes_${table}`,
      ok: found === codes.length,
      count: found,
      detail: `${found}/${codes.length}`,
    });
  }

  const auditActionTypes = await countRows(query, "audit_action_types");
  checks.push({
    name: "audit_action_types",
    ok: auditActionTypes >= 1,
    count: auditActionTypes,
  });

  return {
    ok: checks.every((check) => check.ok),
    skipped: false,
    checks,
  };
}

function printChecks(result: VerifyResult): void {
  for (const check of result.checks) {
    const status = check.ok ? "PASS" : "FAIL";
    const countPart = check.count === undefined ? "" : ` count=${check.count}`;
    const detailPart = check.detail ? ` (${check.detail})` : "";
    console.log(`${check.name}: ${status}${countPart}${detailPart}`);
  }
  if (result.skipped) {
    console.log(
      `verify_result: SKIPPED (${HR_MIGRATION_NAME} not applied — nothing to verify yet)`,
    );
    return;
  }
  console.log(`verify_result: ${result.ok ? "PASS" : "FAIL"}`);
}

async function main() {
  const { assertSafeEnvironment, requireSafeEnvironment } = await import(
    "../src/lib/env/guard"
  );
  const {
    buildDatabasePoolConfig,
    buildTrustedPgSsl,
    loadSupabaseDbCaCertificate,
  } = await import("../src/lib/db/ca-certificate");
  const { Pool } = await import("pg");

  const projectRoot = process.cwd();
  const guard = assertSafeEnvironment({ projectRoot });
  if (!guard.ok) {
    console.error(`[ENV_GUARD] ${guard.code}: ${guard.reason}`);
    process.exit(1);
  }
  requireSafeEnvironment({ projectRoot });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required for db:verify");
    process.exit(1);
  }

  const { content } = loadSupabaseDbCaCertificate(
    process.env.SUPABASE_DB_CA_CERT_PATH ?? "",
    projectRoot,
  );
  const ssl = buildTrustedPgSsl(content);
  const pool = new Pool(buildDatabasePoolConfig(databaseUrl, ssl, { max: 1 }));

  try {
    const result = await verifyHrDatabase(async (text, values) =>
      pool.query(text, values),
    );
    printChecks(result);
    if (!result.ok) {
      process.exit(1);
    }
  } finally {
    await pool.end().catch(() => undefined);
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").endsWith("scripts/db-verify.ts");

if (isDirectRun) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "db:verify failed";
    console.error(
      "db:verify failed:",
      message
        .replace(/:[^:@/]+@/g, ":***@")
        .replace(/-----BEGIN[\s\S]*?-----END[^-]+-----/g, "[redacted-pem]"),
    );
    process.exit(1);
  });
}
