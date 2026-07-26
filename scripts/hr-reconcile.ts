/** Read-only consistency checks for the HR operations suite. */
export {};

async function main() {
  const { loadProjectEnv } = await import("./load-project-env");
  loadProjectEnv(process.cwd());
  const { Pool } = await import("pg");
  const {
    buildDatabasePoolConfig,
    buildTrustedPgSsl,
    loadSupabaseDbCaCertificate,
  } = await import("../src/lib/db/ca-certificate");
  const { assertSafeEnvironment, requireSafeEnvironment } = await import(
    "../src/lib/env/guard"
  );

  const projectRoot = process.cwd();
  const guard = assertSafeEnvironment({ projectRoot });
  if (!guard.ok) throw new Error(`[ENV_GUARD] ${guard.code}: ${guard.reason}`);
  requireSafeEnvironment({ projectRoot });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for hr:reconcile");

  const { content } = loadSupabaseDbCaCertificate(
    process.env.SUPABASE_DB_CA_CERT_PATH ?? "",
    projectRoot,
  );
  const pool = new Pool(
    buildDatabasePoolConfig(process.env.DATABASE_URL, buildTrustedPgSsl(content), {
      max: 1,
    }),
  );
  try {
    const checks = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS count FROM (
          SELECT employee_id, work_date FROM hr.attendance_days
          GROUP BY employee_id, work_date HAVING COUNT(*) > 1
        ) duplicates
      `),
      pool.query(`
        SELECT COUNT(*)::int AS count FROM hr.employee_leave_balances
        WHERE available_balance <> opening_balance + accrued_balance - used_balance + adjusted_balance
      `),
      pool.query(`
        SELECT COUNT(*)::int AS count FROM (
          SELECT employee_id FROM hr.employee_work_locations
          WHERE is_primary = true AND effective_to IS NULL
          GROUP BY employee_id HAVING COUNT(*) > 1
        ) duplicates
      `),
    ]);
    const names = [
      "attendance_day_uniqueness",
      "leave_balance_math",
      "current_primary_work_location",
    ];
    const results = checks.map((result, index) => {
      const count = Number(result.rows[0]?.count ?? 0);
      return { name: names[index], ok: count === 0, count };
    });
    for (const result of results) {
      console.log(`${result.name}: ${result.ok ? "PASS" : "FAIL"} count=${result.count}`);
    }
    if (results.some((result) => !result.ok)) process.exitCode = 1;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("hr:reconcile failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
