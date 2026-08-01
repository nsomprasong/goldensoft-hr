import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MASKED_VALUE, sanitizeAuditPayload } from "../src/lib/hr/audit";
import {
  addCompensation,
  getCurrentCompensation,
  listCompensations,
} from "../src/lib/hr/services/compensations";
import { createEmployee } from "../src/lib/hr/services/employees";
import {
  adminContext,
  createHarness,
  employeeData,
  expectHrError,
  masterId,
  memberContext,
  payrollOfficerContext,
} from "./helpers/hr-fixtures";

async function seedEmployee() {
  const harness = createHarness();
  const employee = await createEmployee(
    harness.repository,
    adminContext(),
    employeeData(harness.store),
  );
  return { ...harness, employee, ctx: payrollOfficerContext() };
}

describe("Phase 8B compensation", () => {
  it("adds the first compensation record as current", async () => {
    const { store, repository, employee, ctx } = await seedEmployee();

    const created = await addCompensation(repository, ctx, employee.id, {
      wageTypeId: masterId(store, "wageType", "MONTHLY"),
      amount: 35000,
      effectiveFrom: "2026-01-01",
    });

    assert.equal(created.amount, 35000);
    assert.equal(created.currency, "THB");
    assert.equal(created.isCurrent, true);
    assert.equal(created.effectiveTo, null);
  });

  it("rejects a negative amount", async () => {
    const { store, repository, employee, ctx } = await seedEmployee();

    await expectHrError("NEGATIVE_AMOUNT", () =>
      addCompensation(repository, ctx, employee.id, {
        wageTypeId: masterId(store, "wageType", "MONTHLY"),
        amount: -1,
        effectiveFrom: "2026-01-01",
      }),
    );
  });

  it("closes the previous record and preserves history", async () => {
    const { store, repository, employee, ctx } = await seedEmployee();
    const wageTypeId = masterId(store, "wageType", "MONTHLY");

    await addCompensation(repository, ctx, employee.id, {
      wageTypeId,
      amount: 30000,
      effectiveFrom: "2026-01-01",
    });
    const raise = await addCompensation(repository, ctx, employee.id, {
      wageTypeId,
      amount: 36000,
      effectiveFrom: "2026-02-01",
    });

    const history = await listCompensations(repository, ctx, employee.id);
    assert.equal(history.length, 2);

    const previous = history.find((row) => row.amount === 30000)!;
    assert.equal(previous.isCurrent, false);
    assert.equal(
      previous.effectiveTo?.toISOString().slice(0, 10),
      "2026-01-31",
    );

    const current = await getCurrentCompensation(repository, ctx, employee.id);
    assert.equal(current?.id, raise.id);
    assert.equal(current?.amount, 36000);
  });

  it("rejects a record that starts before the open one", async () => {
    const { store, repository, employee, ctx } = await seedEmployee();
    const wageTypeId = masterId(store, "wageType", "MONTHLY");

    await addCompensation(repository, ctx, employee.id, {
      wageTypeId,
      amount: 30000,
      effectiveFrom: "2026-01-01",
    });

    await expectHrError("OVERLAP_COMPENSATION", () =>
      addCompensation(repository, ctx, employee.id, {
        wageTypeId,
        amount: 31000,
        effectiveFrom: "2025-12-01",
      }),
    );
  });

  it("rejects a record overlapping a closed period", async () => {
    const { store, repository, employee, ctx } = await seedEmployee();
    const wageTypeId = masterId(store, "wageType", "MONTHLY");

    await addCompensation(repository, ctx, employee.id, {
      wageTypeId,
      amount: 30000,
      effectiveFrom: "2026-01-01",
    });
    await addCompensation(repository, ctx, employee.id, {
      wageTypeId,
      amount: 36000,
      effectiveFrom: "2026-03-01",
    });

    // 2026-01-15 falls inside the now-closed 2026-01-01 → 2026-02-28 window.
    await expectHrError("OVERLAP_COMPENSATION", () =>
      addCompensation(repository, ctx, employee.id, {
        wageTypeId,
        amount: 33000,
        effectiveFrom: "2026-01-15",
      }),
    );
  });

  it("rejects an end date before the start date", async () => {
    const { store, repository, employee, ctx } = await seedEmployee();

    await expectHrError("VALIDATION_ERROR", () =>
      addCompensation(repository, ctx, employee.id, {
        wageTypeId: masterId(store, "wageType", "MONTHLY"),
        amount: 1000,
        effectiveFrom: "2026-02-01",
        effectiveTo: "2026-01-01",
      }),
    );
  });

  it("requires the compensation permission", async () => {
    const { store, repository, employee } = await seedEmployee();

    await expectHrError("FORBIDDEN", () =>
      addCompensation(repository, memberContext(), employee.id, {
        wageTypeId: masterId(store, "wageType", "MONTHLY"),
        amount: 1000,
        effectiveFrom: "2026-01-01",
      }),
    );
  });

  it("masks the amount in the audit trail", async () => {
    const { store, repository, employee, ctx } = await seedEmployee();

    const created = await addCompensation(repository, ctx, employee.id, {
      wageTypeId: masterId(store, "wageType", "MONTHLY"),
      amount: 42000,
      effectiveFrom: "2026-01-01",
    });

    const audit = await repository.audit.listByEntity(
      ctx.organizationId,
      "employee_compensation",
      created.id,
    );
    assert.equal(audit.length, 1);
    const afterJson = audit[0].afterJson as Record<string, unknown>;
    assert.equal(afterJson.amount, MASKED_VALUE);
    assert.equal(afterJson.currency, "THB");
    assert.ok(!JSON.stringify(audit).includes("42000"));
  });

  it("drops credential-like keys from any audit payload", () => {
    const sanitized = sanitizeAuditPayload({
      accessToken: "abc",
      apiKey: "def",
      password: "ghi",
      nested: { sessionSecret: "jkl", amount: 10, keep: "yes" },
    }) as Record<string, unknown>;

    assert.deepEqual(Object.keys(sanitized), ["nested"]);
    const nested = sanitized.nested as Record<string, unknown>;
    assert.deepEqual(nested, { amount: MASKED_VALUE, keep: "yes" });
  });
});
