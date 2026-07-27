import assert from "node:assert/strict";
import { expandWorkDates } from "../src/lib/hr/schedule-dates";

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

console.log("schedule-dates expandWorkDates ok");
