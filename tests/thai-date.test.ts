import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatThaiDate,
  formatThaiDateCompact,
  formatThaiDateRange,
  formatThaiDateRangeCompact,
  formatThaiDateRangeReadable,
  formatThaiDateReadable,
  formatThaiDateTimeReadable,
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

  it("formats compact dates and ranges", () => {
    assert.equal(formatThaiDateCompact("2026-08-15"), "15 ส.ค. 69");
    assert.equal(
      formatThaiDateCompact("2026-08-15", "—", { omitYear: true }),
      "15 ส.ค.",
    );
    assert.equal(
      formatThaiDateRangeCompact("2026-08-01", "2026-08-15"),
      "1–15 ส.ค. 69",
    );
    assert.equal(
      formatThaiDateRangeCompact("2026-07-28", "2026-08-15"),
      "28 ก.ค. – 15 ส.ค. 69",
    );
  });

  it("formats readable dates and ranges with full Buddhist year", () => {
    assert.equal(formatThaiDateReadable("2026-07-03"), "3 ก.ค. 2569");
    assert.equal(
      formatThaiDateRangeReadable("2026-08-07", "2026-08-07"),
      "7 ส.ค. 2569",
    );
    assert.equal(
      formatThaiDateRangeReadable("2026-08-03", "2026-08-05"),
      "3-5 ส.ค. 2569",
    );
    assert.equal(
      formatThaiDateRangeReadable("2026-07-28", "2026-08-05"),
      "28 ก.ค. – 5 ส.ค. 2569",
    );
    const stamped = formatThaiDateTimeReadable("2026-08-07T07:30:00.000Z");
    assert.match(stamped, /^7 ส\.ค\. 2569 \d{2}:\d{2}$/);
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
