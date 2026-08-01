/**
 * End-to-end GPS clock tests for login-test employee EMP-0004 (นภา).
 *
 * Uses a signed Platform bootstrap bridge — does not require ALLOW_TEST_AUTH
 * on the running HR server.
 *
 *   npx tsx scripts/test-attendance-gps.ts
 */
import { createHmac, randomUUID } from "node:crypto";

import { loadProjectEnv } from "./load-project-env";

loadProjectEnv(process.cwd());

const HR = (process.env.ACCEPTANCE_HR_BASE_URL ?? "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);
const ORG_CODE = "TEST-PLUKPRAEW";
const EMPLOYEE_EMAIL = "plukpraew.hq.staff1@example.com";

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
      [EMPLOYEE_EMAIL],
    );
    const user = profile.rows[0];
    if (!user?.auth_user_id) {
      throw new Error(`User ${EMPLOYEE_EMAIL} not found`);
    }

    const employee = await prisma.employee.findFirst({
      where: {
        organizationId: organization.id,
        authUserId: user.auth_user_id,
      },
      select: { id: true, employeeCode: true, branchId: true },
    });
    if (!employee) throw new Error("HR employee not linked for นภา");

    const location = await prisma.workLocation.findFirst({
      where: {
        organizationId: organization.id,
        code: "TEST_HQ",
        isActive: true,
      },
    });
    if (
      !location ||
      location.latitude == null ||
      location.longitude == null
    ) {
      throw new Error("TEST_HQ work location missing coordinates");
    }

    const link = await prisma.employeeWorkLocation.findFirst({
      where: {
        employeeId: employee.id,
        workLocationId: location.id,
        isPrimary: true,
      },
    });
    record(
      "Employee linked to TEST_HQ",
      Boolean(link),
      link ? location.id : "missing employeeWorkLocation",
    );

    const {
      encodePlatformContextCookie,
      PLATFORM_CONTEXT_COOKIE_NAME,
    } = await import("../src/lib/platform/context-cookie");
    const cookie = `${PLATFORM_CONTEXT_COOKIE_NAME}=${encodePlatformContextCookie({
      organizationId: organization.id,
      branchId: employee.branchId,
      mode: "membership",
    })}`;

    const bridge = signBridge({
      issuedAt: Date.now(),
      user: { id: user.auth_user_id, email: user.email },
      profile: {
        displayName: user.display_name,
        email: user.email,
        statusCode: user.status_code,
      },
      platformRoles: [],
      contextMode: "membership",
      organizationId: organization.id,
      organizationName: organization.display_name,
      branchId: employee.branchId,
      branchName: "HQ",
      membership: {
        organizationId: organization.id,
        organizationName: organization.display_name,
        organizationStatus: "ACTIVE",
        roles: ["EMPLOYEE"],
        branches: [
          { id: employee.branchId, name: "HQ", code: "HQ" },
        ],
      },
      permissions: [
        "hr.schedule.read",
        "hr.attendance.self",
        "hr.leave.self",
        "hr.overtime.self",
        "hr.payslip.self",
      ],
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
          code: "hr.employee_limit",
          productCode: "GOLDENSOFT_HR",
          allowed: true,
          value: "50",
          subscriptionStatus: "ACTIVE",
          expiresAt: null,
        },
      ],
    });

    const headers: Record<string, string> = {
      cookie,
      accept: "application/json",
      "content-type": "application/json",
      "x-gs-customer-shell": "1",
      "x-gs-platform-bootstrap": bridge,
    };

    async function api(method: string, path: string, body?: unknown) {
      const res = await fetch(`${HR}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text.slice(0, 300) };
      }
      return { res, json };
    }

    // Health
    {
      const ready = await fetch(`${HR}/hr/me/attendance`, { cache: "no-store" });
      record("HR service reachable", ready.status < 500, `status=${ready.status}`);
    }

    // GET today
    const list = await api("GET", "/api/hr/attendance/clock");
    const listBody = list.json as {
      workLocation?: { code?: string; geofenceRadiusMeters?: number };
      days?: Array<{
        workDate?: string;
        clockInAt?: string | null;
        clockOutAt?: string | null;
      }>;
      error?: { message?: string };
    };
    record(
      "GET attendance/clock",
      list.res.ok,
      list.res.ok
        ? `location=${listBody.workLocation?.code ?? "?"} days=${listBody.days?.length ?? 0}`
        : JSON.stringify(listBody.error ?? listBody).slice(0, 200),
    );

    const lat = Number(location.latitude);
    const lng = Number(location.longitude);
    // 1×1 JPEG for punch evidence (Phase 2 / 1C)
    const photoBase64 =
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z";

    // Reject without photo
    const noPhoto = await api("POST", "/api/hr/attendance/clock", {
      action: "clockIn",
      idempotencyKey: randomUUID(),
      latitude: lat,
      longitude: lng,
      accuracyMeters: 10,
      workLocationId: location.id,
    });
    record(
      "POST clockIn without photo rejected",
      noPhoto.res.status >= 400,
      `status=${noPhoto.res.status}`,
    );

    // Inside geofence
    const inside = await api("POST", "/api/hr/attendance/clock", {
      action: "clockIn",
      idempotencyKey: randomUUID(),
      latitude: lat,
      longitude: lng,
      accuracyMeters: 10,
      workLocationId: location.id,
      photoBase64,
    });
    record(
      "POST clockIn inside geofence",
      inside.res.status === 201 || inside.res.ok,
      `status=${inside.res.status} ${JSON.stringify((inside.json as { error?: unknown })?.error ?? { id: (inside.json as { id?: string })?.id }).slice(0, 180)}`,
    );

    // Outside geofence
    const outside = await api("POST", "/api/hr/attendance/clock", {
      action: "clockIn",
      idempotencyKey: randomUUID(),
      latitude: lat - 0.01,
      longitude: lng,
      accuracyMeters: 10,
      workLocationId: location.id,
      photoBase64,
    });
    const outsideBody = outside.json as { error?: { message?: string; code?: string } };
    const outsideBlocked =
      outside.res.status === 403 ||
      outsideBody.error?.code === "FORBIDDEN" ||
      /นอกพื้นที่|OUTSIDE/i.test(outsideBody.error?.message ?? "");
    record(
      "POST clockIn outside geofence rejected",
      outsideBlocked,
      `status=${outside.res.status} ${outsideBody.error?.message ?? JSON.stringify(outsideBody).slice(0, 160)}`,
    );

    // clockOut inside
    const out = await api("POST", "/api/hr/attendance/clock", {
      action: "clockOut",
      idempotencyKey: randomUUID(),
      latitude: lat,
      longitude: lng,
      accuracyMeters: 10,
      workLocationId: location.id,
    });
    record(
      "POST clockOut inside geofence",
      out.res.status === 201 || out.res.ok,
      `status=${out.res.status}`,
    );

    // List again
    const list2 = await api("GET", "/api/hr/attendance/clock");
    const days =
      (list2.json as { days?: Array<{ clockInAt?: string | null }> })?.days ??
      [];
    record(
      "GET shows day summary after clock",
      list2.res.ok && days.length >= 1 && Boolean(days[0]?.clockInAt),
      `days=${days.length} clockIn=${days[0]?.clockInAt ? "yes" : "no"}`,
    );
  } finally {
    await prisma.$disconnect().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }

  const failed = steps.filter((s) => !s.ok);
  console.log("\n---");
  console.log(`Passed ${steps.length - failed.length}/${steps.length}`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
