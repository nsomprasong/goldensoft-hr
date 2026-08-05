export {};

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
  const { requireSafeEnvironment } = await import("../src/lib/env/guard");
  const { seedStandardPositions, STANDARD_POSITIONS } = await import(
    "../src/lib/seed/master-data"
  );

  const projectRoot = process.cwd();
  requireSafeEnvironment({ projectRoot });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const { content } = loadSupabaseDbCaCertificate(
    process.env.SUPABASE_DB_CA_CERT_PATH,
    projectRoot,
  );
  const pool = new Pool(
    buildDatabasePoolConfig(databaseUrl, buildTrustedPgSsl(content), { max: 1 }),
  );
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    await seedStandardPositions(prisma);
    const tenant = await prisma.$queryRaw<Array<{ organization_id: string; hq_branch_id: string }>>`
      SELECT o.id::text AS organization_id,b.id::text AS hq_branch_id
      FROM platform.organizations o
      JOIN platform.branches b ON b.organization_id=o.id AND b.code='HQ'
      WHERE o.customer_code='TEST-PLUKPRAEW'
      LIMIT 1
    `;
    if (!tenant[0]) throw new Error("Deterministic test organization/HQ branch missing");
    const customType = await prisma.positionType.findUniqueOrThrow({ where: { code: "ORGANIZATION_CUSTOM" } });
    const organizationScope = await prisma.positionScopeType.findUniqueOrThrow({ where: { code: "ORGANIZATION" } });
    const branchScope = await prisma.positionScopeType.findUniqueOrThrow({ where: { code: "BRANCH" } });
    await prisma.position.upsert({
      where: { organizationId_code: { organizationId: tenant[0].organization_id, code: "TEST_ORG_POSITION" } },
      create: {
        organizationId: tenant[0].organization_id,
        code: "TEST_ORG_POSITION",
        nameTh: "ตำแหน่งทดสอบระดับองค์กร",
        nameEn: "Test organization position",
        positionTypeId: customType.id,
        scopeTypeId: organizationScope.id,
        isSystemStandard: false,
        isActive: true,
      },
      update: {
        branchId: null,
        positionTypeId: customType.id,
        scopeTypeId: organizationScope.id,
        isActive: true,
      },
    });
    await prisma.position.upsert({
      where: { organizationId_code: { organizationId: tenant[0].organization_id, code: "TEST_BRANCH_POSITION" } },
      create: {
        organizationId: tenant[0].organization_id,
        branchId: tenant[0].hq_branch_id,
        code: "TEST_BRANCH_POSITION",
        nameTh: "ตำแหน่งทดสอบระดับสาขา",
        nameEn: "Test branch position",
        positionTypeId: customType.id,
        scopeTypeId: branchScope.id,
        isSystemStandard: false,
        isActive: true,
      },
      update: {
        branchId: tenant[0].hq_branch_id,
        positionTypeId: customType.id,
        scopeTypeId: branchScope.id,
        isActive: true,
      },
    });
    const count = await prisma.position.count({
      where: {
        organizationId: null,
        branchId: null,
        isSystemStandard: true,
      },
    });
    if (count !== STANDARD_POSITIONS.length) {
      throw new Error(`Expected ${STANDARD_POSITIONS.length} global positions, found ${count}`);
    }
    console.log(JSON.stringify({ globalStandardPositions: count, deterministicCustomPositions: 2, idempotentKeys: ["immutableCode", "organizationId+code"] }));
  } finally {
    await prisma.$disconnect();
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Standard position seed failed");
  process.exit(1);
});
