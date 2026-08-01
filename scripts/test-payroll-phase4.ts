/**
 * Phase 4 payroll smoke against login-test tenant.
 *
 *   npm run seed:login-test
 *   npx tsx scripts/test-payroll-phase4.ts
 */
import { createHmac } from "node:crypto";

import { loadProjectEnv } from "./load-project-env";

loadProjectEnv(process.cwd());

const HR = (process.env.ACCEPTANCE_HR_BASE_URL ?? "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);
const ORG_CODE = "TEST-PLUKPRAEW";
const OWNER_EMAIL = "plukpraew.owner@example.com";
const STAFF_EMAIL = "plukpraew.hq.staff1@example.com";

type Step = { name: string; ok: boolean; detail?: string };

function signBridge(payload: Record<string, unknown>): string {
  const secret = process.env.PLATFORM_CONTEXT_COOKIE_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error("PLATFORM_CONTEXT_COOKIE_SECRET missing");
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

const PAYROLL_PERMS = [
  "hr.payroll.read",
  "hr.payroll.calculate",
  "hr.payroll.review",
  "hr.payroll.approve",
  "hr.payroll.mark_paid",
  "hr.payroll.lock",
  "hr.payroll.manage",
  "hr.payslip.read",
  "hr.payslip.self",
  "hr.settings.manage",
  "hr.payroll_period.read",
  "hr.access",
];

async function createPrisma() {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@prisma/client");
  const { Pool } = await import("pg");
  const {
    buildDatabasePoolConfig,
    buildTrustedPgSsl,
    loadSupabaseDbCaCertificate,
  } = await import("../src/lib/db/ca-certificate");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL missing");
  const { content } = loadSupabaseDbCaCertificate(
    process.env.SUPABASE_DB_CA_CERT_PATH ?? "",
    process.cwd(),
  );
  const pool = new Pool(
    buildDatabasePoolConfig(databaseUrl, buildTrustedPgSsl(content), { max: 2 }),
  );
  return {
    prisma: new PrismaClient({ adapter: new PrismaPg(pool) }),
    pool,
  };
}

async function main() {
  const steps: Step[] = [];
  const record = (name: string, ok: boolean, detail?: string) => {
    steps.push({ name, ok, detail });
    console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  };

  const { prisma, pool } = await createPrisma();
  try {
    const org = await pool.query<{ id: string; display_name: string }>(
      `select id, display_name from platform.organizations
       where customer_code = $1 and deleted_at is null limit 1`,
      [ORG_CODE],
    );
    const organization = org.rows[0];
    if (!organization) throw new Error(`Org ${ORG_CODE} not found — seed login-test first`);

    const settings = await pool.query(
      `select tax_rate_percent, social_security_rate_percent, social_security_max_amount
       from hr.payroll_deduction_settings where organization_id = $1`,
      [organization.id],
    );
    record(
      "deduction settings seeded",
      settings.rowCount === 1 && Number(settings.rows[0].tax_rate_percent) === 3,
      settings.rows[0]
        ? `tax=${settings.rows[0].tax_rate_percent} sso=${settings.rows[0].social_security_rate_percent}`
        : "missing — run npm run seed:login-test",
    );

    const payslips = await pool.query(
      `select count(*)::int as n from hr.payslips p
       join hr.payroll_run_employees re on re.id = p.payroll_run_employee_id
       join hr.payroll_runs r on r.id = re.payroll_run_id
       where r.organization_id = $1 and p.issued_at is not null`,
      [organization.id],
    );
    record(
      "issued payslips exist",
      (payslips.rows[0]?.n ?? 0) >= 5,
      `count=${payslips.rows[0]?.n ?? 0}`,
    );

    async function loadUser(email: string) {
      const profile = await pool.query<{
        id: string;
        auth_user_id: string;
        email: string;
        display_name: string;
        status_code: string;
      }>(
        `select up.id, up.auth_user_id, up.email, up.display_name, s.code as status_code
         from platform.user_profiles up
         join platform.user_profile_statuses s on s.id = up.status_id
         where lower(up.email) = lower($1) and up.deleted_at is null
         limit 1`,
        [email],
      );
      const user = profile.rows[0];
      if (!user?.auth_user_id) throw new Error(`User ${email} not found`);
      const employee = await prisma.employee.findFirst({
        where: { organizationId: organization.id, authUserId: user.auth_user_id },
        select: { branchId: true },
      });
      return { user, branchId: employee?.branchId ?? null };
    }

    const owner = await loadUser(OWNER_EMAIL);
    const staff = await loadUser(STAFF_EMAIL);

    const {
      encodePlatformContextCookie,
      PLATFORM_CONTEXT_COOKIE_NAME,
    } = await import("../src/lib/platform/context-cookie");

    function headersFor(
      user: Awaited<ReturnType<typeof loadUser>>,
      roles: string[],
      permissions: string[],
    ) {
      const cookie = `${PLATFORM_CONTEXT_COOKIE_NAME}=${encodePlatformContextCookie({
        organizationId: organization.id,
        branchId: user.branchId,
        mode: "membership",
      })}`;
      const bridge = signBridge({
        issuedAt: Date.now(),
        user: { id: user.user.auth_user_id, email: user.user.email },
        profile: {
          displayName: user.user.display_name,
          email: user.user.email,
          statusCode: user.user.status_code,
        },
        platformRoles: [],
        contextMode: "membership",
        organizationId: organization.id,
        organizationName: organization.display_name,
        branchId: user.branchId,
        branchName: "HQ",
        membership: {
          organizationId: organization.id,
          organizationName: organization.display_name,
          organizationStatus: "ACTIVE",
          roles,
          branches: user.branchId
            ? [{ id: user.branchId, name: "สำนักงานใหญ่", code: "HQ" }]
            : [],
        },
        permissions,
        entitlements: [
          {
            code: "hr.access",
            productCode: "GOLDENSOFT_HR",
            allowed: true,
            value: null,
            subscriptionStatus: "ACTIVE",
            expiresAt: null,
          },
          {
            code: "hr.payroll",
            productCode: "GOLDENSOFT_HR",
            allowed: true,
            value: null,
            subscriptionStatus: "ACTIVE",
            expiresAt: null,
          },
        ],
      });
      return {
        cookie,
        accept: "application/json",
        "content-type": "application/json",
        "x-gs-customer-shell": "1",
        "x-gs-platform-bootstrap": bridge,
      };
    }

    async function api(
      path: string,
      user: Awaited<ReturnType<typeof loadUser>>,
      roles: string[],
      permissions: string[],
    ) {
      const res = await fetch(`${HR}${path}`, {
        headers: headersFor(user, roles, permissions),
        cache: "no-store",
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text.slice(0, 200) };
      }
      return { status: res.status, json, text };
    }

    const runs = await api(
      "/api/hr/payroll/runs",
      owner,
      ["OWNER"],
      PAYROLL_PERMS,
    );
    const runList = Array.isArray(runs.json) ? runs.json : null;
    record(
      "GET payroll/runs",
      runs.status === 200 && Array.isArray(runList) && runList.length >= 1,
      `status=${runs.status} n=${Array.isArray(runList) ? runList.length : "?"}`,
    );

    const orgSlips = await api(
      "/api/hr/payslips",
      owner,
      ["OWNER"],
      PAYROLL_PERMS,
    );
    const slipList = Array.isArray(orgSlips.json) ? orgSlips.json : null;
    record(
      "GET payslips (org)",
      orgSlips.status === 200 && Array.isArray(slipList) && slipList.length >= 1,
      `status=${orgSlips.status} n=${Array.isArray(slipList) ? slipList.length : "?"}`,
    );

    const meSlips = await api(
      "/api/hr/payslips/self",
      staff,
      ["EMPLOYEE"],
      ["hr.payslip.self", "hr.access"],
    );
    const meList = Array.isArray(meSlips.json) ? meSlips.json : null;
    record(
      "GET payslips/self (นภา)",
      meSlips.status === 200 && Array.isArray(meList) && meList.length >= 1,
      `status=${meSlips.status} n=${Array.isArray(meList) ? meList.length : "?"}`,
    );

    const ded = await api(
      "/api/hr/payroll/deduction-settings",
      owner,
      ["OWNER"],
      PAYROLL_PERMS,
    );
    const dedRow = ded.json as { taxRatePercent?: number };
    record(
      "GET deduction-settings",
      ded.status === 200 && Number(dedRow?.taxRatePercent) === 3,
      `status=${ded.status} tax=${dedRow?.taxRatePercent}`,
    );

    const page = await fetch(`${HR}/hr/payroll/runs`, {
      headers: headersFor(owner, ["OWNER"], PAYROLL_PERMS),
      cache: "no-store",
    });
    const html = await page.text();
    record(
      "UI /hr/payroll/runs",
      page.status === 200 && html.includes("ประมวลผลเงินเดือน"),
      `status=${page.status}`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }

  const failed = steps.filter((s) => !s.ok);
  if (failed.length) {
    console.error(`\n${failed.length} failed`);
    process.exit(1);
  }
  console.log(`\nAll ${steps.length} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
