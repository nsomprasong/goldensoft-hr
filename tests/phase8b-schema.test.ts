import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(__dirname, "..");
const SCHEMA_PATH = path.join(ROOT, "prisma/schema.prisma");
const MIGRATION_PATH = path.join(
  ROOT,
  "prisma/migrations/0001_hr_core/migration.sql",
);

const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
const migration = fs.readFileSync(MIGRATION_PATH, "utf8");
/** Comments describe the safety rules, so scan executable SQL only. */
const migrationSql = migration.replace(/--[^\n]*/g, " ");

const EXPECTED_MODELS = [
  "EmploymentType",
  "EmployeeStatus",
  "ShiftType",
  "PayFrequency",
  "WageType",
  "OvertimeRateType",
  "PayrollPeriodStatus",
  "AuditActionType",
  "Department",
  "Position",
  "WorkLocation",
  "Employee",
  "EmployeeBranchAssignment",
  "EmployeeCompensation",
  "OvertimeRule",
  "Shift",
  "PayrollSchedule",
  "PayrollPeriod",
  "AuditLog",
  "DemoSeedMarker",
];

const MASTER_CODES: Record<string, string[]> = {
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

const AUDIT_ACTION_CODES = [
  "employee.create",
  "employee.update",
  "employee.deactivate",
  "employee.link_user",
  "employee.unlink_user",
  "compensation.add",
  "department.create",
  "department.update",
  "department.deactivate",
  "position.create",
  "position.update",
  "position.deactivate",
  "shift.create",
  "shift.update",
  "shift.deactivate",
  "payroll_schedule.create",
  "payroll_schedule.update",
  "payroll_period.create",
  "payroll_period.status_change",
];

describe("Phase 8B Prisma schema", () => {
  it("declares only the hr schema", () => {
    assert.match(schema, /schemas\s*=\s*\["hr"\]/);
  });

  it("defines every expected model exactly once", () => {
    for (const model of EXPECTED_MODELS) {
      const matches = schema.match(new RegExp(`^model ${model} \\{`, "gm"));
      assert.equal(matches?.length, 1, `expected one model ${model}`);
    }
  });

  it("puts every model in the hr schema", () => {
    const modelCount = schema.match(/^model /gm)?.length ?? 0;
    const schemaAttributes = schema.match(/@@schema\("hr"\)/g)?.length ?? 0;
    assert.ok(
      modelCount >= EXPECTED_MODELS.length,
      `expected at least ${EXPECTED_MODELS.length} models, got ${modelCount}`,
    );
    assert.equal(schemaAttributes, modelCount);
  });

  it("uses master tables instead of enums", () => {
    assert.doesNotMatch(schema, /^enum /m);
  });

  it("keeps organization / branch / user references soft", () => {
    for (const field of [
      "organizationId",
      "branchId",
      "platformUserId",
      "authUserId",
    ]) {
      assert.match(schema, new RegExp(`\\b${field}\\b`));
    }
    // Relations may only target HR models, never platform/auth tables.
    assert.doesNotMatch(schema, /@relation\([^)]*references:\s*\[id\][^)]*auth/i);
  });

  it("scopes employee uniqueness per organization", () => {
    assert.match(schema, /@@unique\(\[organizationId, employeeCode\]\)/);
    assert.match(schema, /@@unique\(\[organizationId, platformUserId\]\)/);
    assert.match(schema, /@@unique\(\[organizationId, authUserId\]\)/);
  });
});

describe("Phase 8B migration preview", () => {
  it("creates the hr schema and no other", () => {
    assert.match(migrationSql, /CREATE SCHEMA IF NOT EXISTS "hr";/);
    const qualified = new Set(
      [...migrationSql.matchAll(/"([a-z0-9_]+)"\./g)].map((match) => match[1]),
    );
    assert.deepEqual([...qualified], ["hr"]);
  });

  it("contains no enum or destructive statements", () => {
    assert.doesNotMatch(migrationSql, /CREATE\s+TYPE/i);
    assert.doesNotMatch(migrationSql, /AS\s+ENUM/i);
    assert.doesNotMatch(migrationSql, /\bDROP\b/i);
    assert.doesNotMatch(migrationSql, /TRUNCATE/i);
  });

  it("guards compensation amount and geofence radius", () => {
    assert.match(migration, /CHECK \("amount" >= 0\)/);
    assert.match(migration, /CHECK \("geofence_radius_meters" > 0\)/);
  });

  it("seeds every master code idempotently", () => {
    for (const [table, codes] of Object.entries(MASTER_CODES)) {
      assert.match(
        migration,
        new RegExp(`INSERT INTO "hr"\\."${table}"`),
        `expected a seed for ${table}`,
      );
      for (const code of codes) {
        assert.ok(
          migration.includes(`'${code}'`),
          `expected master code ${code} for ${table}`,
        );
      }
    }
    const onConflict = migration.match(/ON CONFLICT \("code"\) DO NOTHING/g);
    assert.equal(onConflict?.length, Object.keys(MASTER_CODES).length + 1);
  });

  it("seeds the full audit action vocabulary", () => {
    for (const code of AUDIT_ACTION_CODES) {
      assert.ok(
        migration.includes(`'${code}'`),
        `expected audit action type ${code}`,
      );
    }
  });
});

describe("Phase 8B project wiring", () => {
  it("commits the public Supabase CA bundle", () => {
    const certPath = path.join(ROOT, "certs/prod-ca-2021.crt");
    assert.ok(fs.existsSync(certPath), "certs/prod-ca-2021.crt should exist");
    const content = fs.readFileSync(certPath, "utf8");
    assert.match(content, /BEGIN CERTIFICATE/);
    assert.doesNotMatch(content, /PRIVATE KEY/);
  });

  it("documents HR env keys without real values", () => {
    const example = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
    for (const key of [
      "APP_CODE=HR",
      "EXPECTED_SUPABASE_PROJECT_REF=",
      "BLOCKED_LEGACY_SUPABASE_PROJECT_REF=",
      "SUPABASE_DB_CA_CERT_PATH=certs/prod-ca-2021.crt",
      "DATABASE_URL=",
      "DIRECT_URL=",
      "SEED_MODE=system",
    ]) {
      assert.ok(example.includes(key), `expected ${key} in .env.example`);
    }
    assert.match(example, /^DATABASE_URL=$/m);
    assert.match(example, /^DIRECT_URL=$/m);
  });

  it("exposes the Phase 8B database scripts", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    for (const script of [
      "db:preflight",
      "db:verify",
      "db:migration:check",
      "db:generate",
      "db:validate",
      "seed:hr",
      "seed:hr:demo",
      "seed:hr:demo:cleanup",
    ]) {
      assert.ok(pkg.scripts[script], `expected npm script ${script}`);
    }
  });
});
