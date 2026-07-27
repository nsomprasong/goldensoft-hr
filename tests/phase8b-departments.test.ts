import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allocateNextCode } from "../src/lib/hr/business-codes";
import { createDepartment } from "../src/lib/hr/services/departments";
import { createOvertimeRule } from "../src/lib/hr/services/overtime-rules";
import { createPayrollSchedule } from "../src/lib/hr/services/payroll-schedules";
import { createPosition } from "../src/lib/hr/services/positions";
import { createShift } from "../src/lib/hr/services/shifts";
import {
  adminContext,
  createHarness,
  expectHrError,
  masterId,
} from "./helpers/hr-fixtures";

describe("Phase 8B departments", () => {
  it("auto-generates department code when omitted", async () => {
    const { repository } = createHarness();
    const ctx = adminContext();

    const first = await createDepartment(repository, ctx, {
      nameTh: "บุคคล",
    });
    const second = await createDepartment(repository, ctx, {
      nameTh: "บัญชี",
    });

    assert.equal(first.code, "DEPT-0001");
    assert.equal(second.code, "DEPT-0002");
    assert.equal(first.nameEn, "บุคคล");
    assert.equal(second.nameEn, "บัญชี");
  });

  it("mirrors a single department name into nameEn", async () => {
    const { repository } = createHarness();
    const ctx = adminContext();

    const row = await createDepartment(repository, ctx, {
      nameTh: "Operations",
    });

    assert.equal(row.nameTh, "Operations");
    assert.equal(row.nameEn, "Operations");
  });

  it("still accepts an explicit department code", async () => {
    const { repository } = createHarness();
    const ctx = adminContext();

    const row = await createDepartment(repository, ctx, {
      code: "hr",
      nameTh: "บุคคล",
    });

    assert.equal(row.code, "HR");
  });

  it("rejects duplicate department codes", async () => {
    const { repository } = createHarness();
    const ctx = adminContext();

    await createDepartment(repository, ctx, {
      code: "OPS",
      nameTh: "ปฏิบัติการ",
    });

    await expectHrError("DUPLICATE_CODE", () =>
      createDepartment(repository, ctx, {
        code: "ops",
        nameTh: "ซ้ำ",
      }),
    );
  });
});

describe("Phase 8B positions", () => {
  it("auto-generates position code when omitted", async () => {
    const { repository } = createHarness();
    const ctx = adminContext();

    const first = await createPosition(repository, ctx, {
      nameTh: "พนักงานทั่วไป",
    });
    const second = await createPosition(repository, ctx, {
      nameTh: "หัวหน้ากะ",
    });

    assert.equal(first.code, "POS-0001");
    assert.equal(second.code, "POS-0002");
    assert.equal(first.nameEn, "พนักงานทั่วไป");
  });
});

describe("Phase 8B auto business codes", () => {
  it("auto-generates shift, overtime rule, and payroll schedule codes", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();

    const shift = await createShift(repository, ctx, {
      name: "กะกลางวัน",
      shiftTypeId: masterId(store, "shiftType", "REGULAR"),
      startTime: "08:00",
      endTime: "17:00",
      breakMinutes: 60,
    });
    const ot = await createOvertimeRule(repository, ctx, {
      name: "OT ปกติ",
      rateTypeId: masterId(store, "overtimeRateType", "NORMAL_DAY"),
      multiplier: 1.5,
      effectiveFrom: "2026-01-01",
    });
    const pay = await createPayrollSchedule(repository, ctx, {
      name: "รายเดือน",
      payFrequencyId: masterId(store, "payFrequency", "MONTHLY"),
      periodStartRule: "DAY:1",
      periodEndRule: "END_OF_MONTH",
      paymentDayRule: "END_OF_PERIOD",
    });

    assert.equal(shift.code, "SHIFT-0001");
    assert.equal(ot.code, "OTR-0001");
    assert.equal(pay.code, "PAY-0001");
  });
});

describe("business code allocation", () => {
  it("picks the next numeric suffix", () => {
    assert.equal(allocateNextCode([], "EMP-"), "EMP-0001");
    assert.equal(allocateNextCode(["EMP-0001", "EMP-0003"], "EMP-"), "EMP-0004");
    assert.equal(allocateNextCode(["HR", "OPS"], "DEPT-"), "DEPT-0001");
    assert.equal(allocateNextCode(["POS-0001"], "POS-"), "POS-0002");
    assert.equal(allocateNextCode(["SHIFT-0001"], "SHIFT-"), "SHIFT-0002");
    assert.equal(allocateNextCode([], "LOC-"), "LOC-0001");
  });
});
