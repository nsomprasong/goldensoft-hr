import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  groupScheduleSegments,
  type MyScheduleAssignment,
} from "../src/components/hr/my-schedule-workspace";

function day(
  workDate: string,
  shiftName: string,
  extras: Partial<MyScheduleAssignment> = {},
): MyScheduleAssignment {
  return {
    id: workDate,
    workDate,
    isRestDay: false,
    isLeaveDay: false,
    shiftName,
    startTime: "08:00",
    endTime: "17:00",
    timeLabel: "08:00–17:00",
    periodId: "p1",
    periodName: "ตาราง",
    periodStart: "2026-07-16",
    periodEnd: "2026-07-31",
    statusCode: "PUBLISHED",
    statusName: "เผยแพร่แล้ว",
    ...extras,
  };
}

describe("groupScheduleSegments", () => {
  it("merges a full same-shift range into one card", () => {
    const rows = [
      day("2026-07-16", "กะกลางวัน"),
      day("2026-07-17", "กะกลางวัน"),
      day("2026-07-18", "กะกลางวัน"),
    ];
    const segments = groupScheduleSegments(rows);
    assert.equal(segments.length, 1);
    assert.equal(segments[0].startDate, "2026-07-16");
    assert.equal(segments[0].endDate, "2026-07-18");
    assert.equal(segments[0].dutyLabel, "กะกลางวัน");
    assert.equal(segments[0].dayCount, 3);
  });

  it("splits when the shift changes mid-range", () => {
    const rows = [
      day("2026-07-16", "กะกลางวัน"),
      day("2026-07-17", "กะกลางวัน"),
      day("2026-07-18", "กะกลางวัน"),
      day("2026-07-19", "กะกลางคืน", {
        timeLabel: "20:00–05:00 (+1)",
        startTime: "20:00",
        endTime: "05:00",
      }),
      day("2026-07-20", "กะกลางคืน", {
        timeLabel: "20:00–05:00 (+1)",
        startTime: "20:00",
        endTime: "05:00",
      }),
      day("2026-07-21", "กะกลางคืน", {
        timeLabel: "20:00–05:00 (+1)",
        startTime: "20:00",
        endTime: "05:00",
      }),
      day("2026-07-22", "กะกลางวัน"),
      day("2026-07-23", "กะกลางวัน"),
    ];
    const segments = groupScheduleSegments(rows);
    assert.equal(segments.length, 3);
    assert.deepEqual(
      segments.map((s) => [s.startDate, s.endDate, s.dutyLabel]),
      [
        ["2026-07-16", "2026-07-18", "กะกลางวัน"],
        ["2026-07-19", "2026-07-21", "กะกลางคืน"],
        ["2026-07-22", "2026-07-23", "กะกลางวัน"],
      ],
    );
  });

  it("starts a new card when dates are not consecutive", () => {
    const rows = [
      day("2026-07-16", "กะกลางวัน"),
      day("2026-07-17", "กะกลางวัน"),
      day("2026-07-20", "กะกลางวัน"),
    ];
    const segments = groupScheduleSegments(rows);
    assert.equal(segments.length, 2);
    assert.equal(segments[0].endDate, "2026-07-17");
    assert.equal(segments[1].startDate, "2026-07-20");
  });
});
