import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatThaiDate,
  formatThaiDateRange,
  parseDateParts,
  toIsoDate,
} from "../src/lib/hr/thai-date";

describe("Thai date display", () => {
  it("formats ISO dates as DD/MM/Buddhist year", () => {
    assert.equal(formatThaiDate("2026-06-18"), "18/06/2569");
    assert.equal(formatThaiDate("2026-01-01"), "01/01/2569");
    assert.equal(formatThaiDate("2025-12-31"), "31/12/2568");
  });

  it("formats UTC Date values from date-only columns", () => {
    assert.equal(
      formatThaiDate(new Date(Date.UTC(2026, 5, 18))),
      "18/06/2569",
    );
  });

  it("returns fallback for empty values", () => {
    assert.equal(formatThaiDate(null), "—");
    assert.equal(formatThaiDate(""), "—");
    assert.equal(formatThaiDate(undefined, ""), "");
  });

  it("formats a range", () => {
    assert.equal(
      formatThaiDateRange("2026-06-01", "2026-06-30"),
      "01/06/2569 – 30/06/2569",
    );
  });

  it("parses Thai display back to Gregorian parts", () => {
    assert.deepEqual(parseDateParts("18/06/2569"), {
      year: 2026,
      month: 6,
      day: 18,
    });
  });

  it("converts Thai display to ISO for storage", () => {
    assert.equal(toIsoDate("18/06/2569"), "2026-06-18");
    assert.equal(toIsoDate("2026-06-18"), "2026-06-18");
    assert.equal(toIsoDate("31/02/2569"), "");
  });
});
