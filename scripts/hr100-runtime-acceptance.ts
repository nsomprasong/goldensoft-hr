/**
 * HR 100% final runtime release gate.
 *
 * Runs against local Platform, HR, and Customer App instances. It only creates
 * ACCEPTANCE-* data in RESORT-DEMO and never changes local environment files.
 */
import { chromium, type Page } from "playwright";

import { loadProjectEnv } from "./load-project-env";

loadProjectEnv(process.cwd());
process.env.ALLOW_TEST_AUTH = "true";
process.env.APP_CODE = "HR";

type Step = { name: string; ok: boolean; detail?: string; ms?: number };

const PLATFORM = process.env.PLATFORM_BASE_URL ?? "http://127.0.0.1:3000";
const HR = process.env.ACCEPTANCE_HR_BASE_URL ?? "http://127.0.0.1:3001";
const APP = process.env.ACCEPTANCE_APP_URL ?? "http://127.0.0.1:3002";
const WARM_LIMIT = Number(process.env.ACCEPTANCE_WARM_DEV_MS ?? "3500");
const DEMO = {
  resort: "54acc3c9-c043-428c-857a-465095658d72",
  resortBranch: "2db1bedd-c9fc-49d1-b218-b9c875f832e7",
  company: "85f37a86-091a-4efb-abda-5f6eba103e9d",
};
const prefix = `ACCEPTANCE-HR100-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16)}`;

async function waitFor(url: string, label: string, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.status < 500) return;
    } catch {
      // The development server may still be compiling.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${label} is not ready at ${url}`);
}

async function loadSuperAdmin() {
  const { Pool } = await import("pg");
  const {
    buildDatabasePoolConfig,
    buildTrustedPgSsl,
    loadSupabaseDbCaCertificate,
  } = await import("../src/lib/db/ca-certificate");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const { content } = loadSupabaseDbCaCertificate(
    process.env.SUPABASE_DB_CA_CERT_PATH ?? "",
    process.cwd(),
  );
  const pool = new Pool(
    buildDatabasePoolConfig(process.env.DATABASE_URL, buildTrustedPgSsl(content), {
      max: 1,
    }),
  );
  try {
    const result = await pool.query<{ auth_user_id: string; email: string }>(`
      select up.auth_user_id, up.email
      from platform.user_profiles up
      join platform.platform_role_assignments pra on pra.user_profile_id = up.id
      join platform.platform_roles pr on pr.id = pra.role_id
      where pra.revoked_at is null and pr.code = 'SUPER_ADMIN' and up.deleted_at is null
      order by up.created_at asc
      limit 1
    `);
    if (!result.rows[0]) throw new Error("No active SUPER_ADMIN fixture");
    return { authUserId: result.rows[0].auth_user_id, email: result.rows[0].email };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function loadHolidayTypeId() {
  const { Pool } = await import("pg");
  const {
    buildDatabasePoolConfig,
    buildTrustedPgSsl,
    loadSupabaseDbCaCertificate,
  } = await import("../src/lib/db/ca-certificate");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const { content } = loadSupabaseDbCaCertificate(
    process.env.SUPABASE_DB_CA_CERT_PATH ?? "",
    process.cwd(),
  );
  const pool = new Pool(
    buildDatabasePoolConfig(process.env.DATABASE_URL, buildTrustedPgSsl(content), {
      max: 1,
    }),
  );
  try {
    const result = await pool.query<{ id: string }>(
      "select id from hr.holiday_types where is_active = true order by created_at asc limit 1",
    );
    return result.rows[0]?.id;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function contextCookie() {
  const { encodePlatformContextCookie, PLATFORM_CONTEXT_COOKIE_NAME } =
    await import("../src/lib/platform/context-cookie");
  return `${PLATFORM_CONTEXT_COOKIE_NAME}=${encodePlatformContextCookie({
    organizationId: DEMO.resort,
    branchId: DEMO.resortBranch,
    mode: "platform_admin",
  })}`;
}

function ids(value: unknown) {
  const rows = (value as { rows?: Array<{ id?: string }> })?.rows ?? [];
  return rows.map((row) => row.id).filter((id): id is string => Boolean(id)).sort();
}

async function noOverflow(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
  );
}

async function main() {
  const steps: Step[] = [];
  const record = (name: string, ok: boolean, detail?: string, ms?: number) => {
    steps.push({ name, ok, detail, ms });
    console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}${ms == null ? "" : ` (${ms}ms)`}`);
  };
  const writeResults = async () => {
    const fs = await import("node:fs");
    const failed = steps.filter((step) => !step.ok);
    fs.mkdirSync("docs", { recursive: true });
    fs.writeFileSync("docs/hr100-runtime-acceptance.results.json", JSON.stringify({
      generatedAt: new Date().toISOString(), platform: PLATFORM, hr: HR, app: APP,
      demoOrganizationId: DEMO.resort, prefix, warmLimitMs: WARM_LIMIT, steps,
      passed: failed.length === 0,
    }, null, 2));
  };

  try {
    await Promise.all([
      waitFor(`${PLATFORM}/api/health`, "Platform"),
      waitFor(`${HR}/login`, "HR"),
      waitFor(`${APP}/`, "Customer App"),
    ]);
    const admin = await loadSuperAdmin();
    const holidayTypeId = await loadHolidayTypeId();
    const cookie = await contextCookie();
    const headers: Record<string, string> = {
      "content-type": "application/json",
      cookie,
      "x-test-auth-user-id": admin.authUserId,
      "x-test-auth-email": admin.email,
    };
    const api = async (method: string, path: string, body?: unknown, customHeaders = headers) => {
      const started = Date.now();
      const response = await fetch(`${HR}${path}`, {
        method, headers: customHeaders,
        body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store",
      });
      const text = await response.text();
      let json: unknown = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
      return { response, json, ms: Date.now() - started };
    };
    const apiOk = async (name: string, method: string, path: string, body?: unknown) => {
      const result = await api(method, path, body);
      record(name, result.response.ok, `status=${result.response.status}`, result.ms);
      return result;
    };

    const unauthenticated = await fetch(`${HR}/api/hr/employees`, { cache: "no-store" });
    record("Security: unauthenticated employees denied", unauthenticated.status === 401, `status=${unauthenticated.status}`);
    const baseline = await api("GET", "/api/hr/employees?take=20");
    const forged = await api("GET", "/api/hr/employees?take=20", undefined, {
      ...headers, "x-organization-id": DEMO.company,
    });
    record(
      "Security: forged organization header cannot leak data",
      baseline.response.ok && forged.response.ok && JSON.stringify(ids(baseline.json)) === JSON.stringify(ids(forged.json)),
      `baseline=${ids(baseline.json).length} forged=${ids(forged.json).length}`,
    );

    const mastersResult = await apiOk("API: masters", "GET", "/api/hr/masters");
    const masters = (mastersResult.json as { masters?: Record<string, Array<{ id: string; code: string }>> }).masters ?? {};
    const master = (kind: string, code: string) => masters[kind]?.find((row) => row.code === code)?.id;
    const employmentTypeId = master("employmentType", "MONTHLY") ?? masters.employmentType?.[0]?.id;
    const employeeStatusId = master("employeeStatus", "ACTIVE") ?? masters.employeeStatus?.[0]?.id;
    const shiftTypeId = master("shiftType", "REGULAR") ?? masters.shiftType?.[0]?.id;
    const payFrequencyId = master("payFrequency", "SEMIMONTHLY") ?? masters.payFrequency?.[0]?.id;
    if (!employmentTypeId || !employeeStatusId || !shiftTypeId || !holidayTypeId || !payFrequencyId) {
      throw new Error(`Demo masters required for HR100 are missing: ${Object.keys(masters).join(",")}`);
    }

    const employee = await api("POST", "/api/hr/employees", {
      employeeCode: `${prefix}-E`.slice(0, 40), branchId: DEMO.resortBranch,
      employmentTypeId, employeeStatusId, firstNameTh: "ทดสอบ", lastNameTh: "HR100",
      displayName: "ทดสอบ HR100", phone: "0890000100", hireDate: "2026-01-01",
    });
    const employeeId = (employee.json as { employee?: { id?: string } }).employee?.id;
    record("API: acceptance employee create", employee.response.status === 201 && Boolean(employeeId), `status=${employee.response.status}`);
    if (!employeeId) throw new Error("Could not create acceptance employee");

    const location = await api("POST", "/api/hr/work-locations", {
      branchId: DEMO.resortBranch, code: `${prefix}-LOC`.slice(0, 40), name: "สถานที่ทดสอบ HR100",
      latitude: 13.7563, longitude: 100.5018, geofenceRadiusMeters: 100,
    });
    const locationId = (location.json as { id?: string }).id;
    record("API: work location create", location.response.status === 201 && Boolean(locationId), `status=${location.response.status}`);
    const locations = await apiOk("API: work location list", "GET", "/api/hr/work-locations");

    const calendar = await api("POST", "/api/hr/calendars", {
      branchId: DEMO.resortBranch, code: `${prefix}-CAL`.slice(0, 40), name: "ปฏิทินทดสอบ HR100",
      timezone: "Asia/Bangkok", workDays: [1, 2, 3, 4, 5],
    });
    const calendarId = (calendar.json as { id?: string }).id;
    record("API: calendar create", calendar.response.status === 201 && Boolean(calendarId), `status=${calendar.response.status}`);
    const holiday = await api("POST", "/api/hr/holidays", {
      workCalendarId: calendarId, holidayTypeId, holidayDate: "2026-12-30",
      name: "วันหยุดทดสอบ HR100", isPaid: true,
    });
    record("API: holiday create", holiday.response.status === 201, `status=${holiday.response.status}`);

    const shift = await api("POST", "/api/hr/shifts", {
      branchId: DEMO.resortBranch, code: `${prefix}-SHIFT`.slice(0, 40), name: "กะทดสอบ HR100",
      shiftTypeId, startTime: "08:00", endTime: "17:00", breakMinutes: 60,
    });
    const shiftId = (shift.json as { shift?: { id?: string } }).shift?.id;
    record("API: shift create", shift.response.status === 201 && Boolean(shiftId), `status=${shift.response.status}`);
    const schedule = await api("POST", "/api/hr/schedules", {
      branchId: DEMO.resortBranch, code: `${prefix}-SCH`.slice(0, 40), name: "ตารางทดสอบ HR100",
      periodStart: "2026-11-01", periodEnd: "2026-11-07", timezone: "Asia/Bangkok",
    });
    const scheduleId = (schedule.json as { id?: string }).id;
    record("API: schedule period create", schedule.response.ok && Boolean(scheduleId), `status=${schedule.response.status}`);
    const assignment = await api("POST", `/api/hr/schedules/${scheduleId}`, {
      action: "assign", confirm: true, employeeId, workDate: "2026-11-01", shiftId, workLocationId: locationId,
    });
    record("API: schedule shift assignment confirmed", assignment.response.ok, `status=${assignment.response.status}`);
    const published = await api("POST", `/api/hr/schedules/${scheduleId}`, { action: "publish", confirm: true });
    record("API: schedule publish confirmed", published.response.ok, `status=${published.response.status}`);

    await apiOk("API: attendance days list", "GET", "/api/hr/attendance/days?from=2026-01-01&to=2026-12-31");
    const leaveTypes = await apiOk("API: leave types list", "GET", "/api/hr/leave/types");
    const leaveType = (leaveTypes.json as Array<{ id: string; unitId: string }>)?.[0];
    const leave = leaveType ? await api("POST", "/api/hr/leave/requests", {
      employeeId, leaveTypeId: leaveType.id, startDate: "2026-12-01", endDate: "2026-12-01",
      startUnitId: leaveType.unitId, endUnitId: leaveType.unitId, requestedAmount: 1, reason: "ทดสอบ HR100",
    }) : null;
    record("API: leave request submit", Boolean(leave && leave.response.status === 201), leave ? `status=${leave.response.status}` : "no demo leave type");
    await apiOk("API: leave balances list", "GET", `/api/hr/leave/balances?employeeId=${employeeId}`);

    const overtime = await api("POST", "/api/hr/overtime/requests", {
      employeeId, branchId: DEMO.resortBranch, workDate: "2026-12-02",
      startAt: "2026-12-02T09:00:00+07:00", endAt: "2026-12-02T11:00:00+07:00", reason: "ทดสอบ HR100",
    });
    record("API: overtime request submit", overtime.response.status === 201, `status=${overtime.response.status}`);

    const payrollSchedule = await api("POST", "/api/hr/payroll-schedules", {
      code: `${prefix}-PAY`.slice(0, 40), name: "รอบจ่ายทดสอบ HR100", payFrequencyId,
      periodStartRule: "SEMIMONTHLY:1-16", periodEndRule: "SEMIMONTHLY:17-EOM",
      paymentDayRule: "END_OF_PERIOD", timezone: "Asia/Bangkok",
    });
    const payrollScheduleId = (payrollSchedule.json as { payrollSchedule?: { id?: string } }).payrollSchedule?.id;
    record("API: payroll schedule create", payrollSchedule.response.status === 201 && Boolean(payrollScheduleId), `status=${payrollSchedule.response.status}`);
    const period = payrollScheduleId ? await api("POST", "/api/hr/payroll-periods", {
      payrollScheduleId, periodStart: "2026-10-01", periodEnd: "2026-10-15", paymentDate: "2026-10-15",
    }) : null;
    const payrollPeriodId = (period?.json as { payrollPeriod?: { id?: string } } | undefined)?.payrollPeriod?.id;
    record("API: payroll period create", Boolean(period && period.response.status === 201 && payrollPeriodId), `status=${period?.response.status ?? "skipped"}`);
    const run = payrollPeriodId ? await api("POST", "/api/hr/payroll/runs", { payrollPeriodId }) : null;
    record("API: payroll run create", Boolean(run?.response.ok), `status=${run?.response.status ?? "skipped"}`);

    await apiOk("API: approvals inbox", "GET", "/api/hr/approvals");
    await apiOk("API: notifications list", "GET", "/api/hr/notifications");
    await apiOk("API: attendance report", "GET", "/api/hr/reports/attendance");
    const profile = await api("GET", "/api/hr/me/profile");
    record("API: self-service profile", profile.response.ok || profile.response.status === 404, `status=${profile.response.status}${profile.response.status === 404 ? " (no linked employee)" : ""}`);

    const browser = await chromium.launch({ headless: true });
    try {
      const anonymous = await browser.newContext();
      const anonymousPage = await anonymous.newPage();
      await anonymousPage.goto(`${APP}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      const anonymousUrl = new URL(anonymousPage.url());
      record("Security: Customer App redirects anonymous user to Platform login",
        anonymousUrl.origin === PLATFORM && anonymousUrl.pathname === "/login",
        anonymousPage.url());
      await anonymous.close();

      const context = await browser.newContext({ extraHTTPHeaders: {
        "x-test-auth-user-id": admin.authUserId, "x-test-auth-email": admin.email,
      } });
      const contextResponse = await context.request.post(`${APP}/api/session/context`, {
        data: { organizationId: DEMO.resort, branchId: DEMO.resortBranch, mode: "platform_admin" },
      });
      record("Browser: demo HR context bootstrap", contextResponse.ok(), `status=${contextResponse.status()}`);
      const bootstrap = await context.request.get(`${PLATFORM}/api/customer/bootstrap`);
      const bootstrapBody = await bootstrap.json().catch(() => null) as {
        organizationId?: string | null;
        products?: Array<{ productCode: string; allowed: boolean }>;
        entitlements?: Array<{ productCode: string; code: string; allowed: boolean }>;
      } | null;
      const hrEntitled = Boolean(
        bootstrapBody?.products?.some((row) => row.productCode === "GOLDENSOFT_HR" && row.allowed) &&
        bootstrapBody.entitlements?.some((row) =>
          row.productCode === "GOLDENSOFT_HR" && row.code === "hr.access" && row.allowed,
        ),
      );
      record(
        "Browser: RESORT-DEMO is HR-entitled from bootstrap",
        bootstrap.ok() && bootstrapBody?.organizationId === DEMO.resort && hrEntitled,
        `status=${bootstrap.status()} organization=${bootstrapBody?.organizationId ?? "none"}`,
      );
      const page = await context.newPage();
      const routes = [
        "/hr", "/hr/employees", "/hr/schedules", "/hr/attendance", "/hr/leave",
        "/hr/overtime", "/hr/approvals", "/hr/payroll/runs", "/hr/payslips",
        "/hr/reports", "/hr/me", "/hr/me/attendance",
      ];
      for (const route of routes) {
        const started = Date.now();
        const response = await page.goto(`${APP}${route}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
        const body = await page.locator("body").innerText().catch(() => "");
        const fatal = /application error|internal server error|chunkloaderror/i.test(body);
        record(`Browser: ${route}`, Boolean(response && response.status() < 500 && !fatal && (/[ก-๙]/.test(body) || await page.locator("main").count() > 0)),
          `status=${response?.status()} ${Date.now() - started}ms`);
      }
      for (const route of ["/hr", "/hr/employees"]) {
        await page.goto(`${APP}${route}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
        const started = Date.now();
        await page.goto(`${APP}${route}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
        const ms = Date.now() - started;
        record(`Performance: warm ${route} <= ${WARM_LIMIT}ms`, ms <= WARM_LIMIT, `${ms}ms`, ms);
      }
      for (const route of ["/hr", "/hr/me"]) {
        await page.goto(`${APP}${route}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
        const checks: Record<number, boolean> = {};
        for (const width of [375, 768, 1024, 1440]) checks[width] = await noOverflow(page, width);
        record(`Responsive: ${route} has no horizontal overflow`, Object.values(checks).every(Boolean), JSON.stringify(checks));
      }
      await context.close();
    } finally {
      await browser.close();
    }
  } catch (error) {
    record("Suite setup/execution", false, error instanceof Error ? error.message : String(error));
  } finally {
    await writeResults();
  }

  const failed = steps.filter((step) => !step.ok);
  console.log(`\n=== HR100 SUMMARY ${steps.length - failed.length}/${steps.length} passed ===`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
