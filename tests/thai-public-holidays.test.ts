import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fromBuddhistYear,
  thaiPublicHolidaysForYear,
  toBuddhistYear,
} from "../src/lib/hr/thai-public-holidays";

describe("Thai public holidays", () => {
  it("maps Buddhist ↔ Gregorian years", () => {
    assert.equal(toBuddhistYear(2026), 2569);
    assert.equal(fromBuddhistYear(2569), 2026);
  });

  it("includes fixed national days for 2026", () => {
    const rows = thaiPublicHolidaysForYear(2026);
    const byDate = new Map(rows.map((r) => [r.date, r.name]));
    assert.equal(byDate.get("2026-01-01"), "วันขึ้นปีใหม่");
    assert.equal(byDate.get("2026-04-13"), "วันสงกรานต์");
    assert.equal(byDate.get("2026-12-05"), "วันพ่อแห่งชาติ");
  });

  it("includes Buddhist lunar days when table exists", () => {
    const rows = thaiPublicHolidaysForYear(2026);
    assert.ok(rows.some((r) => r.name === "วันมาฆบูชา" && r.date === "2026-03-03"));
    assert.ok(rows.some((r) => r.name === "วันวิสาขบูชา"));
  });

  it("returns empty for out-of-range years", () => {
    assert.deepEqual(thaiPublicHolidaysForYear(1999), []);
  });
});
