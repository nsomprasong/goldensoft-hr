/**
 * Smoke: employee submits leave → branch manager (or org admin) approves with name.
 *
 * Uses Platform bootstrap bridge (no ALLOW_TEST_AUTH on the running HR server).
 *
 *   npx tsx scripts/test-leave-branch-approval.ts
 */
import { createHmac, randomUUID } from "node:crypto";

import { loadProjectEnv } from "./load-project-env";

loadProjectEnv(process.cwd());

const HR = (
  process.env.ACCEPTANCE_HR_BASE_URL ?? "http://127.0.0.1:3001"
).replace(/\/$/, "");
const ORG_CODE = "TEST-PLUKPRAEW";
const STAFF_EMAIL = "plukpraew.b1.staff1@example.com";
const HQ_STAFF_EMAIL = "plukpraew.hq.staff2@example.com";
const MANAGER_EMAIL = "plukpraew.b1.manager@example.com";
const OWNER_EMAIL = "plukpraew.owner@example.com";

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

async function createPool() {
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
  return new Pool(
    buildDatabasePoolConfig(databaseUrl, buildTrustedPgSsl(content), {
      max: 2,
    }),
  );
}

async function loadUser(pool: Awaited<ReturnType<typeof createPool>>, email: string) {
  const result = await pool.query<{
    id: string;
    auth_user_id: string;
    email: string;
    display_name: string;
    status_code: string;
    organization_id: string;
    organization_name: string;
    branch_id: string | null;
    branch_name: string | null;
    branch_code: string | null;
    role_codes: string[];
  }>(
    `select
       up.id,
       up.auth_user_id,
       up.email,
       up.display_name,
       s.code as status_code,
       o.id as organization_id,
       o.display_name as organization_name,
       b.id as branch_id,
       b.name as branch_name,
       b.code as branch_code,
       coalesce(
         array_agg(distinct r.code) filter (where r.code is not null),
         '{}'::text[]
       ) as role_codes
     from platform.user_profiles up
     join platform.user_profile_statuses s on s.id = up.status_id
     join platform.organization_memberships m on m.user_profile_id = up.id
     join platform.organizations o on o.id = m.organization_id
     left join platform.organization_membership_roles mr
       on mr.membership_id = m.id and mr.revoked_at is null
     left join platform.organization_roles r on r.id = mr.role_id
     left join platform.organization_membership_branch_scopes bs
       on bs.membership_id = m.id
     left join platform.branches b on b.id = bs.branch_id
     where lower(up.email) = lower($1)
       and up.deleted_at is null
       and o.customer_code = $2
       and o.deleted_at is null
     group by up.id, s.code, o.id, b.id
     limit 1`,
    [email, ORG_CODE],
  );
  const row = result.rows[0];
  if (!row?.auth_user_id) {
    throw new Error(`User ${email} not found in ${ORG_CODE}`);
  }
  return row;
}

function permissionsForRoles(roles: string[]): string[] {
  if (roles.includes("OWNER") || roles.includes("ADMIN")) {
    return [
      "hr.employee.read",
      "hr.approval.read",
      "hr.leave.approve",
      "hr.overtime.approve",
      "hr.attendance.manage",
      "hr.leave.self",
      "hr.schedule.read",
      "hr.attendance.self",
      "hr.overtime.self",
      "hr.payslip.self",
    ];
  }
  if (roles.includes("BRANCH_MANAGER")) {
    return [
      "hr.schedule.read",
      "hr.attendance.self",
      "hr.leave.self",
      "hr.overtime.self",
      "hr.payslip.self",
      "hr.approval.read",
      "hr.leave.read",
      "hr.leave.approve",
      "hr.overtime.read",
      "hr.overtime.approve",
      "hr.attendance.read",
      "hr.attendance.manage",
    ];
  }
  return [
    "hr.schedule.read",
    "hr.attendance.self",
    "hr.leave.self",
    "hr.overtime.self",
    "hr.payslip.self",
  ];
}

function bridgeFor(user: Awaited<ReturnType<typeof loadUser>>) {
  const roles = user.role_codes ?? [];
  return signBridge({
    issuedAt: Date.now(),
    user: { id: user.auth_user_id, email: user.email },
    profile: {
      displayName: user.display_name,
      email: user.email,
      statusCode: user.status_code,
    },
    platformRoles: [],
    contextMode: "membership",
    organizationId: user.organization_id,
    organizationName: user.organization_name,
    branchId: user.branch_id,
    branchName: user.branch_name,
    membership: {
      organizationId: user.organization_id,
      organizationName: user.organization_name,
      organizationStatus: "ACTIVE",
      roles,
      branches: user.branch_id
        ? [
            {
              id: user.branch_id,
              name: user.branch_name ?? "สาขา",
              code: user.branch_code ?? "BR",
            },
          ]
        : [],
    },
    permissions: permissionsForRoles(roles),
    entitlements: [
      {
        code: "hr.access",
        productCode: "GOLDENSOFT_HR",
        allowed: true,
        value: null,
        subscriptionStatus: "ACTIVE",
        expiresAt: null,
      },
    ],
  });
}

async function main() {
  const steps: Step[] = [];
  const record = (name: string, ok: boolean, detail?: string) => {
    steps.push({ name, ok, detail });
    console.log(
      `[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`,
    );
  };

  const pool = await createPool();
  try {
    const {
      encodePlatformContextCookie,
      PLATFORM_CONTEXT_COOKIE_NAME,
    } = await import("../src/lib/platform/context-cookie");

    const staff = await loadUser(pool, STAFF_EMAIL);
    const hqStaff = await loadUser(pool, HQ_STAFF_EMAIL);
    const manager = await loadUser(pool, MANAGER_EMAIL);
    const owner = await loadUser(pool, OWNER_EMAIL);

    record(
      "Manager is BRANCH_MANAGER",
      manager.role_codes.includes("BRANCH_MANAGER"),
      manager.role_codes.join(","),
    );
    record(
      "Staff and manager share BRANCH01",
      Boolean(staff.branch_id) && staff.branch_id === manager.branch_id,
      `staff=${staff.branch_code} manager=${manager.branch_code}`,
    );
    record(
      "HQ staff is outside manager branch",
      Boolean(hqStaff.branch_id) && hqStaff.branch_id !== manager.branch_id,
      `hq=${hqStaff.branch_code} manager=${manager.branch_code}`,
    );

    const leaveType = await pool.query<{ id: string; name: string }>(
      `select id, name from hr.leave_types
       where organization_id = $1 and is_active = true
       order by name
       limit 1`,
      [staff.organization_id],
    );
    const type = leaveType.rows[0];
    if (!type) throw new Error("No leave type for org");

    const unit = await pool.query<{ id: string }>(
      `select id from hr.leave_units where code = 'DAY' limit 1`,
    );
    const unitId = unit.rows[0]?.id;
    if (!unitId) throw new Error("DAY leave unit missing");

    async function apiAs(
      user: Awaited<ReturnType<typeof loadUser>>,
      method: string,
      path: string,
      body?: unknown,
    ) {
      const cookie = `${PLATFORM_CONTEXT_COOKIE_NAME}=${encodePlatformContextCookie({
        organizationId: user.organization_id,
        branchId: user.branch_id,
        mode: "membership",
      })}`;
      const res = await fetch(`${HR}${path}`, {
        method,
        headers: {
          cookie,
          accept: "application/json",
          "content-type": "application/json",
          "x-gs-customer-shell": "1",
          "x-gs-platform-bootstrap": bridgeFor(user),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text.slice(0, 400) };
      }
      return { res, json };
    }

    // Far-future unique day avoids overlap with leftover seed/smoke leaves.
    const dayOffset = 200 + Math.floor(Math.random() * 400);
    const leaveDay = new Date(Date.UTC(2026, 0, 1 + dayOffset));
    const startDate = leaveDay.toISOString().slice(0, 10);
    const endDate = startDate;
    const hqDay = new Date(Date.UTC(2026, 0, 2 + dayOffset));
    const hqStartDate = hqDay.toISOString().slice(0, 10);

    const submit = await apiAs(staff, "POST", "/api/hr/leave/requests", {
      leaveTypeId: type.id,
      startDate,
      endDate,
      startUnitId: unitId,
      endUnitId: unitId,
      reason: "smoke-test leave submit",
      idempotencyKey: randomUUID(),
    });
    const leaveId =
      typeof submit.json?.id === "string"
        ? submit.json.id
        : typeof submit.json?.leave?.id === "string"
          ? submit.json.leave.id
          : null;
    record(
      "Staff submits leave",
      submit.res.status === 201 && Boolean(leaveId),
      `HTTP ${submit.res.status} id=${leaveId ?? "?"} err=${submit.json?.error?.message ?? ""}`,
    );
    if (!leaveId) {
      throw new Error("Leave submit failed — cannot continue");
    }

    const managerInbox = await apiAs(manager, "GET", "/api/hr/approvals");
    const managerLeave = Array.isArray(managerInbox.json?.leave)
      ? managerInbox.json.leave
      : [];
    const managerSees = managerLeave.some(
      (row: { id?: string }) => row.id === leaveId,
    );
    record(
      "Branch manager inbox includes branch leave",
      managerInbox.res.status === 200 && managerSees,
      `HTTP ${managerInbox.res.status} count=${managerLeave.length}`,
    );

    const ownerInbox = await apiAs(owner, "GET", "/api/hr/approvals");
    const ownerLeave = Array.isArray(ownerInbox.json?.leave)
      ? ownerInbox.json.leave
      : [];
    const ownerSees = ownerLeave.some(
      (row: { id?: string }) => row.id === leaveId,
    );
    record(
      "Org owner inbox includes branch leave",
      ownerInbox.res.status === 200 && ownerSees,
      `HTTP ${ownerInbox.res.status} count=${ownerLeave.length}`,
    );

    const hqSubmit = await apiAs(hqStaff, "POST", "/api/hr/leave/requests", {
      leaveTypeId: type.id,
      startDate: hqStartDate,
      endDate: hqStartDate,
      startUnitId: unitId,
      endUnitId: unitId,
      reason: "smoke-test HQ leave must stay HQ-scoped",
      idempotencyKey: randomUUID(),
    });
    const hqLeaveId =
      typeof hqSubmit.json?.id === "string"
        ? hqSubmit.json.id
        : typeof hqSubmit.json?.leave?.id === "string"
          ? hqSubmit.json.leave.id
          : null;
    record(
      "HQ staff submits leave",
      hqSubmit.res.status === 201 && Boolean(hqLeaveId),
      `HTTP ${hqSubmit.res.status} id=${hqLeaveId ?? "?"}`,
    );

    if (hqLeaveId) {
      const mgrInboxCross = await apiAs(manager, "GET", "/api/hr/approvals");
      const mgrInboxRows = Array.isArray(mgrInboxCross.json?.leave)
        ? mgrInboxCross.json.leave
        : [];
      record(
        "Branch manager inbox hides HQ leave",
        mgrInboxCross.res.status === 200 &&
          !mgrInboxRows.some((row: { id?: string }) => row.id === hqLeaveId),
        `HTTP ${mgrInboxCross.res.status} count=${mgrInboxRows.length}`,
      );

      const mgrLeaveList = await apiAs(
        manager,
        "GET",
        "/api/hr/leave/requests",
      );
      const mgrListRows = Array.isArray(mgrLeaveList.json)
        ? mgrLeaveList.json
        : Array.isArray(mgrLeaveList.json?.items)
          ? mgrLeaveList.json.items
          : Array.isArray(mgrLeaveList.json?.requests)
            ? mgrLeaveList.json.requests
            : [];
      record(
        "Branch manager leave list hides HQ leave",
        mgrLeaveList.res.status === 200 &&
          !mgrListRows.some((row: { id?: string }) => row.id === hqLeaveId),
        `HTTP ${mgrLeaveList.res.status} count=${mgrListRows.length}`,
      );

      await pool.query(
        `delete from hr.leave_requests where id = $1::uuid`,
        [hqLeaveId],
      );
    }

    const approve = await apiAs(manager, "POST", "/api/hr/leave/requests", {
      action: "approve",
      id: leaveId,
    });
    const reviewedByName =
      typeof approve.json?.reviewedByName === "string"
        ? approve.json.reviewedByName.trim()
        : "";
    record(
      "Branch manager approves leave",
      approve.res.status === 200 || approve.res.status === 201,
      `HTTP ${approve.res.status} by=${reviewedByName || "?"}`,
    );
    record(
      "Approval stores reviewer display name",
      reviewedByName.length > 0 &&
        reviewedByName.includes(manager.display_name.split(" ")[0]!),
      reviewedByName || "missing reviewedByName",
    );

    const named = await pool.query<{ reviewed_by_name: string | null }>(
      `select reviewed_by_name from hr.leave_requests where id = $1::uuid`,
      [leaveId],
    );
    record(
      "DB reviewed_by_name persisted",
      Boolean(named.rows[0]?.reviewed_by_name?.trim()),
      named.rows[0]?.reviewed_by_name ?? "null",
    );
  } catch (error) {
    record(
      "Script error",
      false,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    await pool.end();
  }

  const failed = steps.filter((step) => !step.ok);
  console.log(
    `\n${steps.length - failed.length}/${steps.length} passed` +
      (failed.length ? ` · ${failed.length} failed` : ""),
  );
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
