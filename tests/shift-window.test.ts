import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateShiftMismatch,
  isWithinShiftWindow,
} from "../src/lib/hr/shift-window";

function timeUtc(hh: number, mm: number): Date {
  return new Date(Date.UTC(1970, 0, 1, hh, mm, 0));
}

describe("shift window mismatch detection", () => {
  const morning = {
    id: "morning",
    name: "กะเช้า",
    startTime: timeUtc(8, 0),
    endTime: timeUtc(17, 0),
    crossesMidnight: false,
  };
  const night = {
    id: "night",
    name: "กะกลางคืน",
    startTime: timeUtc(20, 0),
    endTime: timeUtc(5, 0),
    crossesMidnight: true,
  };

  it("treats night-shift evening punch as in window", () => {
    const occurredAt = new Date("2026-08-02T20:30:00+07:00");
    assert.equal(
      isWithinShiftWindow(occurredAt, "2026-08-02", night),
      true,
    );
  });

  it("flags morning punch on night assignment and suggests morning", () => {
    const occurredAt = new Date("2026-08-02T08:15:00+07:00");
    const result = evaluateShiftMismatch({
      workDate: "2026-08-02",
      occurredAt,
      assigned: night,
      candidates: [night, morning],
    });
    assert.equal(result.isMismatch, true);
    assert.equal(result.assigned?.id, "night");
    assert.equal(result.suggested?.id, "morning");
  });

  it("does not flag when punch is inside assigned window", () => {
    const occurredAt = new Date("2026-08-02T08:15:00+07:00");
    const result = evaluateShiftMismatch({
      workDate: "2026-08-02",
      occurredAt,
      assigned: morning,
      candidates: [night, morning],
    });
    assert.equal(result.isMismatch, false);
    assert.equal(result.suggested, null);
  });

  it("skips mismatch when there is no assignment", () => {
    const result = evaluateShiftMismatch({
      workDate: "2026-08-02",
      occurredAt: new Date("2026-08-02T08:15:00+07:00"),
      assigned: null,
      candidates: [morning],
    });
    assert.equal(result.isMismatch, false);
  });
});
