/**
 * Static safety checks for GoldenSoft HR migration SQL.
 *
 * These run offline (npm run db:migration:check) and never connect to a database.
 * HR owns exactly one schema: "hr". Platform / Auth / other product schemas are
 * referenced only through soft UUID columns, never through DDL or foreign keys.
 */
const ALLOWED_SCHEMA = "hr";

const FORBIDDEN_SCHEMAS = [
  "auth",
  "public",
  "platform",
  "resident_v2",
  "qrstation",
] as const;

const REQUIRED_MASTER_TABLES = [
  "employment_types",
  "employee_statuses",
  "shift_types",
  "pay_frequencies",
  "wage_types",
  "overtime_rate_types",
  "payroll_period_statuses",
  "audit_action_types",
];

const SCHEMA_QUALIFIED_STATEMENTS =
  /\b(CREATE\s+(UNIQUE\s+)?(TABLE|INDEX)|ALTER\s+TABLE|INSERT\s+INTO)\b/i;

export type MigrationCheckResult = {
  ok: boolean;
  errors: string[];
  schemasTouched: string[];
};

/**
 * Remove `--` line comments and block comments so documentation prose cannot
 * trip (or mask) the DDL pattern checks below.
 */
function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

function collectSchemasTouched(sql: string): Set<string> {
  const schemasTouched = new Set<string>();
  for (const match of sql.matchAll(/"([a-z0-9_]+)"\./gi)) {
    schemasTouched.add(match[1]!.toLowerCase());
  }
  return schemasTouched;
}

function rejectForbiddenSchemas(sql: string, errors: string[]): void {
  for (const forbidden of FORBIDDEN_SCHEMAS) {
    const ddl = new RegExp(
      String.raw`\b(CREATE|ALTER|DROP|TRUNCATE)\s+(TABLE|SCHEMA|TYPE|INDEX|ENUM|VIEW|FUNCTION|POLICY)[^;]*\b${forbidden}\b`,
      "i",
    );
    if (ddl.test(sql)) {
      errors.push(`Forbidden DDL targeting schema/object ${forbidden}`);
    }
  }
}

function rejectEnums(sql: string, errors: string[]): void {
  if (/CREATE\s+TYPE\b/i.test(sql)) {
    errors.push("Migration must not contain CREATE TYPE (no PostgreSQL enums)");
  }
  if (/\bAS\s+ENUM\b/i.test(sql)) {
    errors.push("Migration must not contain AS ENUM");
  }
}

/** Every table-touching statement must be explicitly qualified with the hr schema. */
function requireHrQualifiedStatements(sql: string, errors: string[]): void {
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    if (!SCHEMA_QUALIFIED_STATEMENTS.test(statement)) continue;
    if (statement.includes(`"${ALLOWED_SCHEMA}".`)) continue;
    const preview = statement.slice(0, 80).replace(/\s+/g, " ");
    errors.push(`Statement is not qualified with "hr": ${preview}`);
  }
}

function rejectDestructiveStatements(sql: string, errors: string[]): void {
  if (/\bDROP\s+TABLE\b/i.test(sql)) {
    errors.push("Migration must not DROP TABLE");
  }
  if (/\bDROP\s+COLUMN\b/i.test(sql)) {
    errors.push("Migration must not DROP COLUMN");
  }
  if (/\bDROP\s+SCHEMA\b/i.test(sql)) {
    errors.push("Migration must not DROP SCHEMA");
  }
  if (/\bTRUNCATE\b/i.test(sql)) {
    errors.push("Migration must not TRUNCATE");
  }
}

/** Safety check for the initial HR migration (0001): creates schema hr and its core tables. */
export function checkMigrationSql(sql: string): MigrationCheckResult {
  const errors: string[] = [];
  const executable = stripSqlComments(sql);
  const schemasTouched = collectSchemasTouched(executable);

  if (!sql.trim()) {
    errors.push("Migration SQL is empty");
  }

  if (!/CREATE\s+SCHEMA\s+(IF\s+NOT\s+EXISTS\s+)?"?hr"?/i.test(executable)) {
    errors.push('Migration must create schema "hr"');
  }

  rejectEnums(executable, errors);
  rejectDestructiveStatements(executable, errors);
  rejectForbiddenSchemas(executable, errors);
  requireHrQualifiedStatements(executable, errors);

  for (const schema of schemasTouched) {
    if (schema !== ALLOWED_SCHEMA) {
      errors.push(`Migration touches unexpected schema: ${schema}`);
    }
  }

  if (!/CREATE\s+TABLE\b/i.test(executable)) {
    errors.push("Initial migration must CREATE TABLE");
  }

  if (/\bALTER\s+TABLE\b[^;]*\bDROP\b/i.test(executable)) {
    errors.push("Initial migration must not drop anything");
  }

  for (const table of REQUIRED_MASTER_TABLES) {
    if (!executable.includes(`"${table}"`)) {
      errors.push(`Missing master table in migration: ${table}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    schemasTouched: [...schemasTouched],
  };
}

/**
 * Safety check for follow-up additive migrations (ALTER / CREATE INDEX / CREATE TABLE).
 * Must stay inside the hr schema and must not introduce enums or drop anything.
 */
export function checkAdditiveMigrationSql(sql: string): MigrationCheckResult {
  const errors: string[] = [];
  const executable = stripSqlComments(sql);
  const schemasTouched = collectSchemasTouched(executable);

  if (!sql.trim()) {
    errors.push("Migration SQL is empty");
  }

  rejectEnums(executable, errors);
  rejectDestructiveStatements(executable, errors);
  rejectForbiddenSchemas(executable, errors);
  requireHrQualifiedStatements(executable, errors);

  for (const schema of schemasTouched) {
    if (schema !== ALLOWED_SCHEMA) {
      errors.push(`Migration touches unexpected schema: ${schema}`);
    }
  }

  if (
    !/\bALTER\s+TABLE\b/i.test(executable) &&
    !/\bCREATE\s+(UNIQUE\s+)?INDEX\b/i.test(executable) &&
    !/\bCREATE\s+TABLE\b/i.test(executable)
  ) {
    errors.push(
      "Additive migration must ALTER TABLE, CREATE TABLE, or CREATE INDEX",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    schemasTouched: [...schemasTouched],
  };
}
