/**
 * Development demo seed for HR.
 * SEED_MODE=development-demo required. Forbidden in production.
 *
 * Targets — supply exactly one of the two forms:
 *   1. SEED_DEMO_TARGETS — JSON array of { organizationId, branchId },
 *      at most 3 entries, e.g.
 *        [{"organizationId":"…","branchId":"…"},{"organizationId":"…","branchId":"…"}]
 *   2. SEED_ORGANIZATION_ID + SEED_BRANCH_ID — a single organization.
 *
 * Optional:
 *   SEED_ACTOR_ID — auth user recorded as created_by / updated_by
 *
 * The Platform demo tenants this seed is meant for are RESORT-DEMO,
 * COMPANY-DEMO and STATION-DEMO. GOLDENSOFT is the real internal organization
 * and must never be passed here — demo rows carry the DEMO_ prefix and are
 * removed wholesale by seed:hr:demo:cleanup, which is not something real tenant
 * data should ever be exposed to.
 */
export {};

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const MAX_TARGETS = 3;

type DemoTarget = { organizationId: string; branchId: string };

function parseTargets(): DemoTarget[] {
  const raw = process.env.SEED_DEMO_TARGETS?.trim();

  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("SEED_DEMO_TARGETS must be valid JSON");
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(
        "SEED_DEMO_TARGETS must be a non-empty JSON array of { organizationId, branchId }",
      );
    }
    if (parsed.length > MAX_TARGETS) {
      throw new Error(
        `SEED_DEMO_TARGETS accepts at most ${MAX_TARGETS} organizations`,
      );
    }
    return parsed.map((entry, index) => {
      const target = entry as Partial<DemoTarget>;
      if (!target?.organizationId || !target?.branchId) {
        throw new Error(
          `SEED_DEMO_TARGETS[${index}] needs both organizationId and branchId`,
        );
      }
      return {
        organizationId: target.organizationId,
        branchId: target.branchId,
      };
    });
  }

  const organizationId = process.env.SEED_ORGANIZATION_ID;
  const branchId = process.env.SEED_BRANCH_ID;
  if (!organizationId || !branchId) {
    throw new Error(
      "Provide SEED_DEMO_TARGETS, or SEED_ORGANIZATION_ID and SEED_BRANCH_ID",
    );
  }
  return [{ organizationId, branchId }];
}

async function main() {
  const { loadProjectEnv } = await import("./load-project-env");
  loadProjectEnv(process.cwd());

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
  const { resolveSeedMode } = await import("../src/lib/seed/seed-mode");
  const { seedHrMasters } = await import("../src/lib/seed/master-data");
  const { seedDevelopmentDemo } = await import("../src/lib/seed/demo-dataset");

  const projectRoot = process.cwd();
  const guard = assertSafeEnvironment({ projectRoot });
  if (!guard.ok) {
    console.error(`[ENV_GUARD] ${guard.code}: ${guard.reason}`);
    process.exit(1);
  }
  requireSafeEnvironment({ projectRoot });

  if (process.env.NODE_ENV === "production") {
    console.error("seed:hr:demo forbidden in production");
    process.exit(1);
  }

  process.env.SEED_MODE = process.env.SEED_MODE ?? "development-demo";
  const mode = resolveSeedMode();
  if (mode !== "development-demo") {
    console.error(
      `seed:hr:demo requires SEED_MODE=development-demo (got ${mode})`,
    );
    process.exit(1);
  }

  let targets: DemoTarget[];
  try {
    targets = parseTargets();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
    return;
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
    console.log(
      `Seeding HR demo dataset (mode=${mode}, organizations=${targets.length})`,
    );
    await seedHrMasters(prisma);

    const actorId = process.env.SEED_ACTOR_ID ?? NIL_UUID;
    for (const target of targets) {
      const counts = await seedDevelopmentDemo(prisma, {
        organizationId: target.organizationId,
        branchId: target.branchId,
        actorId,
      });
      console.log(
        JSON.stringify(
          { organizationId: target.organizationId, counts },
          null,
          2,
        ),
      );
    }
    console.log("HR demo seed complete (no Auth users created)");
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
