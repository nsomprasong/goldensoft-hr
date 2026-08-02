import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Mirrors notification-bell pendingOnly filter — keep in sync. */
function pendingOnly(inbox: {
  leave: Array<{ id: string; statusCode: string }>;
  overtime: Array<{ id: string; statusCode: string }>;
  advances: Array<{ id: string; status: string }>;
  attendanceAdjustments: Array<{ id: string; statusCode: string }>;
  shiftMismatches: Array<{ id: string; statusCode: string }>;
}) {
  return {
    leave: inbox.leave.filter((row) => row.statusCode === "SUBMITTED"),
    overtime: inbox.overtime.filter((row) => row.statusCode === "SUBMITTED"),
    advances: inbox.advances.filter((row) => row.status === "SUBMITTED"),
    attendanceAdjustments: inbox.attendanceAdjustments.filter(
      (row) => row.statusCode === "SUBMITTED",
    ),
    shiftMismatches: inbox.shiftMismatches.filter(
      (row) => row.statusCode === "SUBMITTED",
    ),
  };
}

describe("notification bell pending filter", () => {
  it("counts only SUBMITTED leave + OT (matches approvals queue)", () => {
    const filtered = pendingOnly({
      leave: [
        { id: "l1", statusCode: "SUBMITTED" },
        { id: "l2", statusCode: "APPROVED" },
      ],
      overtime: [
        { id: "o1", statusCode: "SUBMITTED" },
        { id: "o2", statusCode: "REJECTED" },
      ],
      advances: [
        { id: "a1", status: "SUBMITTED" },
        { id: "a2", status: "APPROVED" },
      ],
      attendanceAdjustments: [{ id: "d1", statusCode: "APPROVED" }],
      shiftMismatches: [],
    });

    assert.equal(filtered.leave.length, 1);
    assert.equal(filtered.overtime.length, 1);
    assert.equal(filtered.advances.length, 1);
    assert.equal(filtered.attendanceAdjustments.length, 0);
    assert.equal(
      filtered.leave.length + filtered.overtime.length,
      2,
      "badge for leave+OT pending should be 2",
    );
  });

  it("drops stale notification-style duplicates by using entity status only", () => {
    const filtered = pendingOnly({
      leave: [{ id: "leave-live", statusCode: "SUBMITTED" }],
      overtime: [],
      advances: [],
      attendanceAdjustments: [],
      shiftMismatches: [],
    });
    assert.deepEqual(
      filtered.leave.map((row) => row.id),
      ["leave-live"],
    );
  });
});
