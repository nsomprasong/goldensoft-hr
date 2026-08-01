import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HR_MASTER_KINDS } from "../src/lib/hr/repository/types";
import { seedMastersIntoRepository } from "../src/lib/hr/repository/seed-masters";
import { createMemoryHrRepository } from "../src/lib/hr/repository/memory-repository";
import {
  createEmptyHrMemoryStore,
  seedMemoryMasters,
} from "../src/lib/hr/repository/memory-store";
import {
  cleanupDevelopmentDemo,
  DEMO_EMPLOYEE_PREFIX,
  DEMO_MARKER_KEY,
  DEMO_PREFIX,
} from "../src/lib/seed/demo-dataset";
import { HR_MASTER_CATALOG } from "../src/lib/seed/master-data";
import { resolveSeedMode } from "../src/lib/seed/seed-mode";

type Call = { model: string; method: string; where: unknown };

/**
 * Minimal Prisma stand-in that records the filters cleanup would run, so the
 * test can prove nothing unscoped is ever deleted.
 */
function createRecordingPrisma(calls: Call[]) {
  const model = (name: string) => ({
    count: async ({ where }: { where: unknown }) => {
      calls.push({ model: name, method: "count", where });
      return 1;
    },
    deleteMany: async ({ where }: { where: unknown }) => {
      calls.push({ model: name, method: "deleteMany", where });
      return { count: 1 };
    },
  });

  return {
    department: model("department"),
    position: model("position"),
    workLocation: model("workLocation"),
    shift: model("shift"),
    overtimeRule: model("overtimeRule"),
    payrollSchedule: model("payrollSchedule"),
    payrollPeriod: model("payrollPeriod"),
    payslip: model("payslip"),
    payrollRun: model("payrollRun"),
    leaveBalanceTransaction: model("leaveBalanceTransaction"),
    employeeLeaveBalance: model("employeeLeaveBalance"),
    leaveRequest: model("leaveRequest"),
    overtimeRequest: model("overtimeRequest"),
    attendanceAdjustment: model("attendanceAdjustment"),
    shiftMismatchRequest: model("shiftMismatchRequest"),
    notification: model("notification"),
    notificationOutbox: model("notificationOutbox"),
    attendanceEvent: model("attendanceEvent"),
    attendanceDay: model("attendanceDay"),
    shiftAssignment: model("shiftAssignment"),
    schedulePeriod: model("schedulePeriod"),
    employeeRecurringPayItem: model("employeeRecurringPayItem"),
    leavePolicy: model("leavePolicy"),
    leaveType: model("leaveType"),
    holiday: model("holiday"),
    workCalendar: model("workCalendar"),
    employee: model("employee"),
    employeeCompensation: model("employeeCompensation"),
    demoSeedMarker: model("demoSeedMarker"),
  } as unknown as Parameters<typeof cleanupDevelopmentDemo>[0];
}

describe("Phase 8B master seeding", () => {
  it("is idempotent through the repository", async () => {
    const repository = createMemoryHrRepository(createEmptyHrMemoryStore());

    const first = await seedMastersIntoRepository(repository);
    const second = await seedMastersIntoRepository(repository);

    for (const kind of HR_MASTER_KINDS) {
      assert.equal(first[kind].created, HR_MASTER_CATALOG[kind].length);
      assert.equal(second[kind].created, 0);
      const rows = await repository.masters.list(kind);
      assert.equal(rows.length, HR_MASTER_CATALOG[kind].length);
    }
  });

  it("is idempotent directly on the memory store", () => {
    const store = createEmptyHrMemoryStore();
    seedMemoryMasters(store);
    const second = seedMemoryMasters(store);

    for (const kind of HR_MASTER_KINDS) {
      assert.equal(second[kind].created, 0);
      assert.equal(second[kind].total, HR_MASTER_CATALOG[kind].length);
      const codes = store.masters[kind].map((row) => row.code);
      assert.equal(new Set(codes).size, codes.length);
    }
  });

  it("keeps master ids stable across store instances", () => {
    const a = createEmptyHrMemoryStore();
    const b = createEmptyHrMemoryStore();
    seedMemoryMasters(a);
    seedMemoryMasters(b);

    assert.deepEqual(
      a.masters.employmentType.map((row) => row.id),
      b.masters.employmentType.map((row) => row.id),
    );
  });
});

describe("Phase 8B seed guards", () => {
  it("forbids the demo seed in production", () => {
    assert.throws(
      () => resolveSeedMode("development-demo", "production"),
      /forbidden in production/,
    );
  });

  it("allows the demo seed outside production", () => {
    assert.equal(
      resolveSeedMode("development-demo", "development"),
      "development-demo",
    );
    assert.equal(resolveSeedMode("system", "production"), "system");
  });

  it("rejects an unknown seed mode", () => {
    assert.throws(() => resolveSeedMode("wipe-everything", "development"), /Invalid SEED_MODE/);
  });
});

describe("Phase 8B demo cleanup", () => {
  const organizationId = "11111111-1111-4111-8111-111111111111";

  it("only ever deletes prefixed demo rows for one organization", async () => {
    const calls: Call[] = [];
    await cleanupDevelopmentDemo(createRecordingPrisma(calls), organizationId);

    const deletions = calls.filter((call) => call.method === "deleteMany");
    assert.ok(deletions.length > 8);

    for (const call of deletions.filter((call) =>
      ["employee", "payrollSchedule", "overtimeRule", "shift", "workLocation", "position", "department", "demoSeedMarker"].includes(call.model),
    )) {
      const where = call.where as {
        organizationId?: string;
        code?: { startsWith?: string };
        employeeCode?: { startsWith?: string };
        markerKey?: string;
      };
      assert.equal(where.organizationId, organizationId);

      if (call.model === "employee") {
        assert.equal(where.employeeCode?.startsWith, DEMO_EMPLOYEE_PREFIX);
      } else if (call.model === "demoSeedMarker") {
        assert.equal(where.markerKey, DEMO_MARKER_KEY);
      } else {
        assert.equal(where.code?.startsWith, DEMO_PREFIX);
      }
    }
  });

  it("counts without deleting in dry-run mode", async () => {
    const calls: Call[] = [];
    const counts = await cleanupDevelopmentDemo(
      createRecordingPrisma(calls),
      organizationId,
      { dryRun: true },
    );

    assert.equal(calls.filter((call) => call.method === "deleteMany").length, 0);
    assert.equal(counts.employees, 1);
  });

  it("refuses a non-UUID organization id", async () => {
    const calls: Call[] = [];
    await assert.rejects(
      () => cleanupDevelopmentDemo(createRecordingPrisma(calls), "not-a-uuid"),
      /organizationId must be a UUID/,
    );
    assert.equal(calls.length, 0);
  });
});
