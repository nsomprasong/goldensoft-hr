import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { expandConsecutiveDates } from "../src/lib/hr/schedule-dates";

describe("expandConsecutiveDates", () => {
  it("builds N days from a start within the period", () => {
    assert.deepEqual(
      expandConsecutiveDates("2026-07-19", 3, "2026-07-16", "2026-07-31"),
      ["2026-07-19", "2026-07-20", "2026-07-21"],
    );
  });

  it("stops at period end", () => {
    assert.deepEqual(
      expandConsecutiveDates("2026-07-30", 5, "2026-07-16", "2026-07-31"),
      ["2026-07-30", "2026-07-31"],
    );
  });
});
