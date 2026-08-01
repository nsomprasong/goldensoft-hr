import assert from "node:assert/strict";
import { expandWorkDates } from "../src/lib/hr/schedule-dates";
import { findOverlappingPeriods } from "../src/lib/hr/schedule-period-overlap";

const weekdays = expandWorkDates("2026-07-27", "2026-08-02", "weekdays");
assert.deepEqual(weekdays, [
  "2026-07-27",
  "2026-07-28",
  "2026-07-29",
  "2026-07-30",
  "2026-07-31",
]);

const all = expandWorkDates("2026-07-27", "2026-08-02", "all");
assert.equal(all.length, 7);
assert.equal(all[0], "2026-07-27");
assert.equal(all[6], "2026-08-02");

assert.deepEqual(expandWorkDates("2026-08-02", "2026-07-27", "all"), []);

const custom = expandWorkDates("2026-08-01", "2026-08-07", [6, 0]);
assert.deepEqual(custom, ["2026-08-01", "2026-08-02"]);

const augWeekdays = expandWorkDates("2026-08-01", "2026-08-31", "weekdays");
assert.equal(augWeekdays.length, 21);

const overlaps = findOverlappingPeriods(
  {
    id: "b",
    name: "full",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
  },
  [
    {
      id: "a",
      name: "half",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-15",
    },
    {
      id: "c",
      name: "june",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-16",
    },
  ],
);
assert.equal(overlaps.length, 1);
assert.equal(overlaps[0]?.id, "a");

console.log("schedule-dates expandWorkDates ok");
