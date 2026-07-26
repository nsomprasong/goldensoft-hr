import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeStandardWorkMinutes,
  formatMinutesAsTime,
  parseTimeToMinutes,
  timeMinutesToDate,
} from "../src/lib/hr/shift-math";
import {
  activateShift,
  createShift,
  deactivateShift,
  getShift,
  listShifts,
  updateShift,
} from "../src/lib/hr/services/shifts";
import {
  adminContext,
  BRANCH_MAIN,
  createHarness,
  expectHrError,
  masterId,
} from "./helpers/hr-fixtures";

describe("Phase 8B shift maths", () => {
  it("reads a time-only Date without timezone drift", () => {
    assert.equal(parseTimeToMinutes("08:30"), 510);
    assert.equal(parseTimeToMinutes("08:30:00"), 510);
    assert.equal(parseTimeToMinutes(timeMinutesToDate(510)), 510);
    assert.equal(formatMinutesAsTime(510), "08:30");
  });

  it("computes a day shift and an overnight shift", () => {
    assert.equal(
      computeStandardWorkMinutes({
        startTime: "08:00",
        endTime: "17:00",
        breakMinutes: 60,
      }),
      480,
    );
    assert.equal(
      computeStandardWorkMinutes({
        startTime: "22:00",
        endTime: "06:00",
        breakMinutes: 60,
      }),
      420,
    );
  });

  it("rejects a break that swallows the shift", () => {
    assert.throws(
      () =>
        computeStandardWorkMinutes({
          startTime: "08:00",
          endTime: "17:00",
          breakMinutes: 600,
        }),
      /INVALID_SHIFT|เวลาพัก/,
    );
  });
});

describe("Phase 8B shifts service", () => {
  it("creates a normal day shift", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();

    const shift = await createShift(repository, ctx, {
      code: "DAY",
      name: "กะกลางวัน",
      shiftTypeId: masterId(store, "shiftType", "REGULAR"),
      startTime: "08:00",
      endTime: "17:00",
      breakMinutes: 60,
      branchId: BRANCH_MAIN,
    });

    assert.equal(shift.standardWorkMinutes, 480);
    assert.equal(shift.crossesMidnight, false);
    assert.equal(shift.startTime, "08:00");
    assert.equal(shift.endTime, "17:00");
    assert.ok(shift.isActive);
  });

  it("infers the midnight crossing for a night shift", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();

    const shift = await createShift(repository, ctx, {
      code: "NIGHT",
      name: "กะกลางคืน",
      shiftTypeId: masterId(store, "shiftType", "NIGHT"),
      startTime: "22:00",
      endTime: "06:00",
      breakMinutes: 60,
    });

    assert.equal(shift.crossesMidnight, true);
    assert.equal(shift.standardWorkMinutes, 420);
  });

  it("rejects an invalid break", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();

    await expectHrError("INVALID_SHIFT", () =>
      createShift(repository, ctx, {
        code: "BAD",
        name: "กะผิดพลาด",
        shiftTypeId: masterId(store, "shiftType", "REGULAR"),
        startTime: "08:00",
        endTime: "17:00",
        breakMinutes: 540,
      }),
    );
  });

  it("rejects a shift built on an inactive shift type", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const regular = store.masters.shiftType.find(
      (row) => row.code === "REGULAR",
    )!;
    regular.isActive = false;

    await expectHrError("INACTIVE_MASTER", () =>
      createShift(repository, ctx, {
        code: "DAY",
        name: "กะกลางวัน",
        shiftTypeId: regular.id,
        startTime: "08:00",
        endTime: "17:00",
      }),
    );
  });

  it("refuses a duplicate shift code", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const shiftTypeId = masterId(store, "shiftType", "REGULAR");

    await createShift(repository, ctx, {
      code: "DAY",
      name: "กะกลางวัน",
      shiftTypeId,
      startTime: "08:00",
      endTime: "17:00",
    });

    await expectHrError("DUPLICATE_CODE", () =>
      createShift(repository, ctx, {
        code: "day",
        name: "ซ้ำ",
        shiftTypeId,
        startTime: "09:00",
        endTime: "18:00",
      }),
    );
  });

  it("recomputes derived timing on update", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const shift = await createShift(repository, ctx, {
      code: "DAY",
      name: "กะกลางวัน",
      shiftTypeId: masterId(store, "shiftType", "REGULAR"),
      startTime: "08:00",
      endTime: "17:00",
      breakMinutes: 60,
    });

    const updated = await updateShift(repository, ctx, shift.id, {
      endTime: "18:00",
    });
    assert.equal(updated.standardWorkMinutes, 540);
    assert.equal(updated.endTime, "18:00");
  });

  it("deactivates a shift instead of deleting it", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const shift = await createShift(repository, ctx, {
      code: "DAY",
      name: "กะกลางวัน",
      shiftTypeId: masterId(store, "shiftType", "REGULAR"),
      startTime: "08:00",
      endTime: "17:00",
    });

    const deactivated = await deactivateShift(repository, ctx, shift.id);
    assert.equal(deactivated.isActive, false);
    assert.equal(store.shifts.length, 1);
    assert.equal(await repository.shifts.countActive(ctx.organizationId), 0);

    const stillReadable = await getShift(repository, ctx, shift.id);
    assert.equal(stillReadable.id, shift.id);
  });

  it("will not reactivate a shift whose type was retired", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const regular = store.masters.shiftType.find(
      (row) => row.code === "REGULAR",
    )!;
    const shift = await createShift(repository, ctx, {
      code: "DAY",
      name: "กะกลางวัน",
      shiftTypeId: regular.id,
      startTime: "08:00",
      endTime: "17:00",
    });
    await deactivateShift(repository, ctx, shift.id);
    regular.isActive = false;

    await expectHrError("INACTIVE_MASTER", () =>
      activateShift(repository, ctx, shift.id),
    );
  });

  it("lists organization-wide shifts for a branch-scoped caller", async () => {
    const { store, repository } = createHarness();
    const ctx = adminContext();
    const shiftTypeId = masterId(store, "shiftType", "REGULAR");

    await createShift(repository, ctx, {
      code: "ORGWIDE",
      name: "ทุกสาขา",
      shiftTypeId,
      startTime: "08:00",
      endTime: "17:00",
    });
    await createShift(repository, ctx, {
      code: "MAIN",
      name: "สาขาหลัก",
      shiftTypeId,
      startTime: "09:00",
      endTime: "18:00",
      branchId: BRANCH_MAIN,
    });

    const scoped = await listShifts(
      repository,
      adminContext({ allowedBranchIds: [BRANCH_MAIN] }),
    );
    assert.equal(scoped.total, 2);
  });
});
