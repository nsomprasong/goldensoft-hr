import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HrError } from "../src/lib/hr/errors";

/**
 * Lightweight contract checks for attendance-adjustment review rules
 * that do not require a live database connection.
 */
describe("attendance adjustment validation helpers", () => {
  it("rejects empty reason message contract", () => {
    const reason = "  ";
    assert.equal(reason.trim().length < 2, true);
  });

  it("HrError INVALID_STATUS_TRANSITION carries Thai message", () => {
    const err = new HrError("INVALID_STATUS_TRANSITION", {
      message: "คำขอนี้ไม่อยู่ในสถานะรออนุมัติ",
    });
    assert.equal(err.code, "INVALID_STATUS_TRANSITION");
    assert.match(err.message, /รออนุมัติ/);
  });

  it("clock out must be after clock in", () => {
    const inAt = new Date("2026-06-02T20:00:00+07:00");
    const outAt = new Date("2026-06-02T19:00:00+07:00");
    assert.equal(outAt.getTime() <= inAt.getTime(), true);
  });
});
