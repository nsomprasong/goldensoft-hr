import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertPayrollStatusTransition,
  canTransitionPayrollStatus,
  computePaymentDate,
  formatDateOnly,
  generatePeriods,
  generateSemimonthlyPeriods,
  parsePaymentDayRule,
} from "../src/lib/hr/payroll-rules";
import {
  createPayrollPeriod,
  generatePayrollPeriods,
  listPayrollPeriods,
  updatePayrollPeriodStatus,
} from "../src/lib/hr/services/payroll-periods";
import { createPayrollSchedule } from "../src/lib/hr/services/payroll-schedules";
import {
  adminContext,
  createHarness,
  expectHrError,
  masterId,
} from "./helpers/hr-fixtures";

const DAY_25 = parsePaymentDayRule("DAY:25");

async function seedSchedule(frequencyCode = "SEMIMONTHLY") {
  const harness = createHarness();
  const ctx = adminContext();
  const schedule = await createPayrollSchedule(harness.repository, ctx, {
    code: "SEMI",
    name: "งวดครึ่งเดือน",
    payFrequencyId: masterId(harness.store, "payFrequency", frequencyCode),
    periodStartRule: "DAY:1,17",
    periodEndRule: "DAY:16,END_OF_MONTH",
    paymentDayRule: "DAYS_AFTER_END:3",
  });
  return { ...harness, ctx, schedule };
}

describe("Phase 8B payroll rules", () => {
  it("splits a month into 1–16 and 17–end", () => {
    const periods = generateSemimonthlyPeriods(2026, 2, DAY_25);
    assert.equal(periods.length, 2);
    assert.equal(formatDateOnly(periods[0].periodStart), "2026-02-01");
    assert.equal(formatDateOnly(periods[0].periodEnd), "2026-02-16");
    assert.equal(formatDateOnly(periods[1].periodStart), "2026-02-17");
    assert.equal(formatDateOnly(periods[1].periodEnd), "2026-02-28");
  });

  it("handles a leap February and a 31-day month", () => {
    assert.equal(
      formatDateOnly(generateSemimonthlyPeriods(2028, 2, DAY_25)[1].periodEnd),
      "2028-02-29",
    );
    assert.equal(
      formatDateOnly(generateSemimonthlyPeriods(2026, 1, DAY_25)[1].periodEnd),
      "2026-01-31",
    );
  });

  it("parses every supported payment day rule", () => {
    assert.deepEqual(parsePaymentDayRule("DAY:25"), { kind: "DAY", day: 25 });
    assert.deepEqual(parsePaymentDayRule("end_of_period"), {
      kind: "END_OF_PERIOD",
    });
    assert.deepEqual(parsePaymentDayRule("DAYS_AFTER_END:3"), {
      kind: "DAYS_AFTER_END",
      days: 3,
    });
    assert.throws(() => parsePaymentDayRule("WHENEVER"), /HrError|กติกา/);
    assert.throws(() => parsePaymentDayRule("DAY:99"), /HrError|วันจ่าย/);
  });

  it("computes payment dates from each rule", () => {
    const firstHalfEnd = new Date(Date.UTC(2026, 1, 16));
    const secondHalfEnd = new Date(Date.UTC(2026, 1, 28));

    assert.equal(
      formatDateOnly(computePaymentDate(DAY_25, firstHalfEnd)),
      "2026-02-25",
    );
    // The 25th has already passed, so payment rolls into the next month.
    assert.equal(
      formatDateOnly(computePaymentDate(DAY_25, secondHalfEnd)),
      "2026-03-25",
    );
    assert.equal(
      formatDateOnly(
        computePaymentDate({ kind: "END_OF_PERIOD" }, secondHalfEnd),
      ),
      "2026-02-28",
    );
    assert.equal(
      formatDateOnly(
        computePaymentDate({ kind: "DAYS_AFTER_END", days: 3 }, secondHalfEnd),
      ),
      "2026-03-03",
    );
  });

  it("produces a single monthly period", () => {
    const periods = generatePeriods({
      frequencyCode: "MONTHLY",
      year: 2026,
      month: 4,
      paymentDayRule: "END_OF_PERIOD",
    });
    assert.equal(periods.length, 1);
    assert.equal(formatDateOnly(periods[0].periodEnd), "2026-04-30");
  });

  it("accepts the documented status flow and refuses jumps", () => {
    assert.ok(canTransitionPayrollStatus("DRAFT", "OPEN"));
    assert.ok(canTransitionPayrollStatus("APPROVED", "PAID"));
    assert.ok(canTransitionPayrollStatus("PAID", "LOCKED"));
    assert.ok(!canTransitionPayrollStatus("DRAFT", "PAID"));
    assert.ok(!canTransitionPayrollStatus("OPEN", "APPROVED"));

    assert.throws(
      () => assertPayrollStatusTransition("DRAFT", "LOCKED"),
      /INVALID_STATUS_TRANSITION|สถานะ/,
    );
    assert.throws(
      () => assertPayrollStatusTransition("LOCKED", "PAID"),
      /PERIOD_LOCKED|ล็อก/,
    );
  });
});

describe("Phase 8B payroll periods service", () => {
  it("generates both semi-monthly periods and skips re-runs", async () => {
    const { repository, ctx, schedule } = await seedSchedule();

    const first = await generatePayrollPeriods(repository, ctx, {
      payrollScheduleId: schedule.id,
      year: 2026,
      month: 3,
    });
    assert.equal(first.created.length, 2);
    assert.equal(first.skipped, 0);
    assert.equal(formatDateOnly(first.created[0].periodEnd), "2026-03-16");
    assert.equal(formatDateOnly(first.created[1].periodStart), "2026-03-17");
    assert.equal(formatDateOnly(first.created[1].paymentDate), "2026-04-03");

    const second = await generatePayrollPeriods(repository, ctx, {
      payrollScheduleId: schedule.id,
      year: 2026,
      month: 3,
    });
    assert.equal(second.created.length, 0);
    assert.equal(second.skipped, 2);

    const listed = await listPayrollPeriods(repository, ctx);
    assert.equal(listed.total, 2);
  });

  it("blocks a duplicate period", async () => {
    const { repository, ctx, schedule } = await seedSchedule();
    const period = {
      payrollScheduleId: schedule.id,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-16",
    };

    await createPayrollPeriod(repository, ctx, period);
    await expectHrError("DUPLICATE_PERIOD", () =>
      createPayrollPeriod(repository, ctx, period),
    );
  });

  it("rejects an inverted period range", async () => {
    const { repository, ctx, schedule } = await seedSchedule();
    await expectHrError("VALIDATION_ERROR", () =>
      createPayrollPeriod(repository, ctx, {
        payrollScheduleId: schedule.id,
        periodStart: "2026-05-16",
        periodEnd: "2026-05-01",
      }),
    );
  });

  it("walks the full status lifecycle and locks at the end", async () => {
    const { store, repository, ctx, schedule } = await seedSchedule();
    const period = await createPayrollPeriod(repository, ctx, {
      payrollScheduleId: schedule.id,
      periodStart: "2026-06-01",
      periodEnd: "2026-06-16",
    });
    assert.equal(
      period.statusId,
      masterId(store, "payrollPeriodStatus", "DRAFT"),
    );

    let current = period;
    for (const code of [
      "OPEN",
      "CALCULATING",
      "REVIEW",
      "APPROVED",
      "PAID",
      "LOCKED",
    ]) {
      current = await updatePayrollPeriodStatus(
        repository,
        ctx,
        period.id,
        code,
      );
      assert.equal(
        current.statusId,
        masterId(store, "payrollPeriodStatus", code),
      );
    }

    assert.ok(current.lockedAt instanceof Date);
    assert.equal(current.lockedBy, ctx.actorAuthUserId);

    await expectHrError("PERIOD_LOCKED", () =>
      updatePayrollPeriodStatus(repository, ctx, period.id, "PAID"),
    );
  });

  it("refuses an illegal status jump", async () => {
    const { repository, ctx, schedule } = await seedSchedule();
    const period = await createPayrollPeriod(repository, ctx, {
      payrollScheduleId: schedule.id,
      periodStart: "2026-07-01",
      periodEnd: "2026-07-16",
    });

    await expectHrError("INVALID_STATUS_TRANSITION", () =>
      updatePayrollPeriodStatus(repository, ctx, period.id, "APPROVED"),
    );
  });

  it("rejects an unparseable payment day rule on the schedule", async () => {
    const { store, repository } = createHarness();
    await expectHrError("VALIDATION_ERROR", () =>
      createPayrollSchedule(repository, adminContext(), {
        code: "BAD",
        name: "ผิดกติกา",
        payFrequencyId: masterId(store, "payFrequency", "MONTHLY"),
        periodStartRule: "DAY:1",
        periodEndRule: "END_OF_MONTH",
        paymentDayRule: "SOMEDAY",
      }),
    );
  });
});
