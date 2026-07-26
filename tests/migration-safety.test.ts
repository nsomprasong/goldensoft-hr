import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  checkAdditiveMigrationSql,
  checkMigrationSql,
} from "../src/lib/db/migration-safety";

const ROOT = path.resolve(__dirname, "..");
const INITIAL_MIGRATION = path.join(
  ROOT,
  "prisma/migrations/0001_hr_core/migration.sql",
);

describe("HR migration safety", () => {
  it("accepts the checked-in initial migration", () => {
    const sql = fs.readFileSync(INITIAL_MIGRATION, "utf8");
    const result = checkMigrationSql(sql);
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
    assert.deepEqual(result.schemasTouched, ["hr"]);
  });

  it("marks the initial migration as preview only", () => {
    const sql = fs.readFileSync(INITIAL_MIGRATION, "utf8");
    assert.match(sql, /PREVIEW ONLY/i);
    assert.match(sql, /Do NOT apply without explicit approval/i);
  });

  it("rejects PostgreSQL enums", () => {
    const sql = `
      CREATE SCHEMA IF NOT EXISTS "hr";
      CREATE TYPE "hr"."employee_status" AS ENUM ('ACTIVE');
      CREATE TABLE "hr"."employment_types" ("id" UUID NOT NULL);
    `;
    const result = checkMigrationSql(sql);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((error) => error.includes("CREATE TYPE")),
      "expected CREATE TYPE to be rejected",
    );
  });

  it("rejects DDL that leaves the hr schema", () => {
    const sql = `
      CREATE SCHEMA IF NOT EXISTS "hr";
      CREATE TABLE "platform"."organizations" ("id" UUID NOT NULL);
    `;
    const result = checkMigrationSql(sql);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((error) => error.includes("platform")),
      "expected the platform schema to be rejected",
    );
  });

  it("rejects unqualified statements", () => {
    const sql = `
      CREATE SCHEMA IF NOT EXISTS "hr";
      CREATE TABLE "employees" ("id" UUID NOT NULL);
    `;
    const result = checkMigrationSql(sql);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((error) => error.includes("not qualified")),
      "expected unqualified DDL to be rejected",
    );
  });

  it("rejects DROP TABLE in additive migrations", () => {
    const sql = `DROP TABLE "hr"."employees";`;
    const result = checkAdditiveMigrationSql(sql);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("DROP TABLE")));
  });

  it("accepts an additive ALTER inside hr", () => {
    const sql = `ALTER TABLE "hr"."employees" ADD COLUMN IF NOT EXISTS "nickname" TEXT;`;
    const result = checkAdditiveMigrationSql(sql);
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
  });

  it("ignores schema names that only appear in comments", () => {
    const sql = `
      -- Soft reference to platform organizations and auth users (no FK).
      ALTER TABLE "hr"."employees" ADD COLUMN IF NOT EXISTS "nickname" TEXT;
    `;
    const result = checkAdditiveMigrationSql(sql);
    assert.deepEqual(result.errors, []);
  });
});
