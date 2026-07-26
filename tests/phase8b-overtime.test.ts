import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HR_AUDIT_ACTIONS } from "../src/lib/hr/audit";
import {
  createOvertimeRule,
  deactivateOvertimeRule,
  getOvertimeRule,
  listOvertimeRules,
  updateOvertimeRule,
} from "../src/lib/hr/services/overtime-rules";
import {
  adminContext,
  createHarness,
  expectHrError,
  masterId,
  memberContext,
} from "./helpers/hr-fixtures";
import type { HrMemoryStore } from "../src/lib/hr/repository/memory-store";
import type { OvertimeRuleCreateData } from "../src/lib/hr/services/overtime-rules";

function ruleData(
  store: HrMemoryStore,
  overrides: Partial<OvertimeRuleCreateData> = {},
): OvertimeRuleCreateData {
  return {
    code: "OT_NORMAL",
    name: "ค่าล่วงเวลาวันทำงานปกติ",
    rateTypeId: masterId(store, "overtimeRateType", "NORMAL_DAY"),
    multiplier: 1.5,
    effectiveFrom: "2026-01-01",
    ...overrides,
  };
}

describe("Phase 8B overtime rules service", () => {
  it("creates a baseline rule and records an audit entry", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();

    const rule = await createOvertimeRule(repository, ctx, ruleData(store));

    assert.equal(rule.code, "OT_NORMAL");
    assert.equal(rule.multiplier, 1.5);
    assert.equal(rule.fixedAmount, null);
    assert.equal(rule.isActive, true);
    assert.equal(rule.organizationId, ctx.organizationId);
    assert.equal(rule.effectiveFrom.toISOString().slice(0, 10), "2026-01-01");

    const audit = await repository.audit.listByEntity(
      ctx.organizationId,
      "overtime_rule",
      rule.id,
    );
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actionCode, HR_AUDIT_ACTIONS.overtimeRuleCreate);
  });

  it("uppercases the code and refuses a duplicate in the same organization", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();

    await createOvertimeRule(repository, ctx, ruleData(store, { code: "ot_x" }));

    await expectHrError("DUPLICATE_CODE", () =>
      createOvertimeRule(repository, ctx, ruleData(store, { code: "OT_X" })),
    );
    assert.equal(store.overtimeRules.length, 1);
  });

  it("rejects a rule built on an inactive rate type", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const normalDay = store.masters.overtimeRateType.find(
      (row) => row.code === "NORMAL_DAY",
    )!;
    normalDay.isActive = false;

    await expectHrError("INACTIVE_MASTER", () =>
      createOvertimeRule(
        repository,
        ctx,
        ruleData(store, { rateTypeId: normalDay.id }),
      ),
    );
  });

  it("rejects a multiplier that is zero or negative", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();

    await expectHrError("VALIDATION_ERROR", () =>
      createOvertimeRule(repository, ctx, ruleData(store, { multiplier: -1.5 })),
    );
    await expectHrError("VALIDATION_ERROR", () =>
      createOvertimeRule(repository, ctx, ruleData(store, { multiplier: 0 })),
    );
    assert.equal(store.overtimeRules.length, 0);
  });

  it("rejects a negative fixed amount but accepts zero", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();

    await expectHrError("NEGATIVE_AMOUNT", () =>
      createOvertimeRule(
        repository,
        ctx,
        ruleData(store, { code: "OT_BAD", fixedAmount: -1 }),
      ),
    );

    const zero = await createOvertimeRule(
      repository,
      ctx,
      ruleData(store, { code: "OT_ZERO", fixedAmount: 0 }),
    );
    assert.equal(zero.fixedAmount, 0);
  });

  it("deactivates a rule instead of deleting it", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const rule = await createOvertimeRule(repository, ctx, ruleData(store));

    const deactivated = await deactivateOvertimeRule(repository, ctx, rule.id);

    assert.equal(deactivated.isActive, false);
    assert.equal(store.overtimeRules.length, 1);

    const stillReadable = await getOvertimeRule(repository, ctx, rule.id);
    assert.equal(stillReadable.id, rule.id);

    const audit = await repository.audit.listByEntity(
      ctx.organizationId,
      "overtime_rule",
      rule.id,
    );
    assert.ok(
      audit.some(
        (row) => row.actionCode === HR_AUDIT_ACTIONS.overtimeRuleDeactivate,
      ),
    );
  });

  it("updates the multiplier and keeps validation on the patch", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const rule = await createOvertimeRule(repository, ctx, ruleData(store));

    const updated = await updateOvertimeRule(repository, ctx, rule.id, {
      multiplier: 3,
      fixedAmount: 250,
    });
    assert.equal(updated.multiplier, 3);
    assert.equal(updated.fixedAmount, 250);

    await expectHrError("VALIDATION_ERROR", () =>
      updateOvertimeRule(repository, ctx, rule.id, { multiplier: 0 }),
    );
  });

  it("rejects an end date before the effective date", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();

    await expectHrError("VALIDATION_ERROR", () =>
      createOvertimeRule(
        repository,
        ctx,
        ruleData(store, {
          effectiveFrom: "2026-06-01",
          effectiveTo: "2026-01-01",
        }),
      ),
    );
  });

  it("keeps rules inside their organization and lists them", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    await createOvertimeRule(repository, ctx, ruleData(store));
    await createOvertimeRule(
      repository,
      ctx,
      ruleData(store, { code: "OT_HOLIDAY", multiplier: 3 }),
    );

    const listed = await listOvertimeRules(repository, ctx);
    assert.equal(listed.total, 2);

    const otherOrg = adminContext({
      organizationId: "44444444-4444-4444-8444-444444444444",
    });
    const empty = await listOvertimeRules(repository, otherOrg);
    assert.equal(empty.total, 0);
  });

  it("refuses mutations from a caller without hr.settings.manage", async () => {
    const { store, repository } = createHarness();
    const admin = adminContext();
    const rule = await createOvertimeRule(repository, admin, ruleData(store));

    const member = memberContext();
    await expectHrError("FORBIDDEN", () =>
      createOvertimeRule(repository, member, ruleData(store, { code: "OT_M" })),
    );
    await expectHrError("FORBIDDEN", () =>
      deactivateOvertimeRule(repository, member, rule.id),
    );
    await expectHrError("FORBIDDEN", () =>
      listOvertimeRules(repository, member),
    );
  });

  it("lets a compensation manager read rules without managing settings", async () => {
    const { store, repository } = createHarness();
    await createOvertimeRule(repository, adminContext(), ruleData(store));

    const payrollOfficer = adminContext({
      permissions: ["hr.compensation.read", "hr.compensation.manage"],
    });
    const listed = await listOvertimeRules(repository, payrollOfficer);
    assert.equal(listed.total, 1);

    await expectHrError("FORBIDDEN", () =>
      createOvertimeRule(
        repository,
        payrollOfficer,
        ruleData(store, { code: "OT_P" }),
      ),
    );
  });
});
