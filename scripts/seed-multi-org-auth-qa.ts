/**
 * HR multi-org Auth ↔ Employee QA addon.
 *
 *   npm run seed:multi-org-auth-qa
 *
 * Prerequisites:
 *   - Platform: seed:full-qa + seed:multi-org-auth-qa
 *   - HR: seed:full-qa (positions/depts)
 */
export {};

async function main() {
  const { loadProjectEnv } = await import("./load-project-env");
  loadProjectEnv(process.cwd());
  process.env.APP_CODE = "HR";

  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@prisma/client");
  const { Pool } = await import("pg");

  const {
    buildDatabasePoolConfig,
    buildTrustedPgSsl,
    loadSupabaseDbCaCertificate,
  } = await import("../src/lib/db/ca-certificate");
  const { assertSafeEnvironment, requireSafeEnvironment } = await import(
    "../src/lib/env/guard"
  );
  const { seedHrMasters } = await import("../src/lib/seed/master-data");
  const {
    seedMultiOrgAuthQaHr,
    MULTI_ORG_QA_PASSWORD,
  } = await import("../src/lib/seed/multi-org-auth-qa-dataset");

  const projectRoot = process.cwd();
  const guard = assertSafeEnvironment({ projectRoot });
  if (!guard.ok) {
    console.error(`[ENV_GUARD] ${guard.code}: ${guard.reason}`);
    process.exit(1);
  }
  requireSafeEnvironment({ projectRoot });

  if (process.env.NODE_ENV === "production") {
    console.error("seed:multi-org-auth-qa forbidden in production");
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ต้องกำหนด DATABASE_URL ใน .env.local");
    process.exit(1);
  }

  const { content } = loadSupabaseDbCaCertificate(
    process.env.SUPABASE_DB_CA_CERT_PATH ?? "",
    projectRoot,
  );
  const ssl = buildTrustedPgSsl(content);
  const pool = new Pool(buildDatabasePoolConfig(databaseUrl, ssl, { max: 1 }));
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    await seedHrMasters(prisma);
    const result = await seedMultiOrgAuthQaHr(prisma);
    console.log(
      JSON.stringify(
        {
          password: MULTI_ORG_QA_PASSWORD,
          employees: result.employees,
        },
        null,
        2,
      ),
    );
    console.log("\nSee docs/MULTI_ORG_AUTH_QA_DATASET.md");
    console.log(`Password (linked Auth): ${MULTI_ORG_QA_PASSWORD}`);
  } finally {
    await prisma.$disconnect();
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    message
      .replace(/:[^:@/]+@/g, ":***@")
      .replace(/-----BEGIN[\s\S]*?-----END[^-]+-----/g, "[redacted-pem]"),
  );
  process.exit(1);
});
