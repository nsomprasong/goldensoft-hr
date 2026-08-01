import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateAttendanceDay } from "../src/lib/hr/attendance-calc";
import { haversineMeters, insideGeofence } from "../src/lib/hr/geo";
import { foldLeaveLedger } from "../src/lib/hr/leave-balance-math";
import { calculatePayroll } from "../src/lib/hr/payroll-calc";
import { findMinimumRestViolations, findOverlappingAssignments } from "../src/lib/hr/schedule-conflicts";

describe("HR 100% pure calculations", () => {
  it("calculates distance and rejects low-accuracy geofence readings", () => {
    assert.ok(haversineMeters({ latitude: 13.7563, longitude: 100.5018 }, { latitude: 13.7563, longitude: 100.5018 }) < 0.01);
    assert.equal(insideGeofence({ latitude: 13.7563, longitude: 100.5018 }, { latitude: 13.7563, longitude: 100.5018, accuracyMeters: 101 }, 50).reason, "ACCURACY_TOO_LOW");
  });

  it("calculates an overnight attendance day", () => {
    const result = calculateAttendanceDay({ schedule: { workDate: "2026-01-01", startTime: "22:00", endTime: "06:00", breakMinutes: 60 }, clockInAt: new Date("2026-01-01T22:10:00Z"), clockOutAt: new Date("2026-01-02T07:00:00Z") });
    assert.equal(result.status, "LATE");
    assert.equal(result.scheduledMinutes, 420);
    assert.equal(result.workedMinutes, 470);
    assert.equal(result.overtimeWorkedMinutes, 60);
  });

  it("detects overlap and insufficient rest", () => {
    const assignments = [{ id: "a", workDate: "2026-01-01", startTime: "22:00", endTime: "06:00" }, { id: "b", workDate: "2026-01-02", startTime: "05:00", endTime: "13:00" }];
    assert.equal(findOverlappingAssignments(assignments).length, 1);
    assert.equal(findMinimumRestViolations([{ ...assignments[0] }, { ...assignments[1], startTime: "12:00" }], 12).length, 1);
  });

  it("folds leave balances and protects against negatives", () => {
    assert.equal(foldLeaveLedger([{ type: "OPENING", amount: 5 }, { type: "ACCRUAL", amount: 2 }, { type: "USED", amount: 3 }, { type: "ADJUSTMENT", amount: -1 }]).remaining, 3);
    assert.throws(() => foldLeaveLedger([{ type: "USED", amount: 1 }]), /cannot be negative/);
  });

  it("calculates daily, monthly, and hourly payroll", () => {
    assert.equal(calculatePayroll({ wageType: "DAILY", wageAmount: 500, workedDays: 2 }).gross, 1000);
    assert.equal(calculatePayroll({ wageType: "MONTHLY", wageAmount: 30000 }).gross, 30000);
    const hourly = calculatePayroll({ wageType: "HOURLY", wageAmount: 100, workedHours: 8, overtimeHours: 2, overtimeMultiplier: 1.5 });
    assert.equal(hourly.gross, 1100);
    assert.equal(hourly.lines.filter((line) => line.isLegalPlaceholder).every((line) => line.amount === 0), true);
  });

  it("applies configurable tax and SSO rates (Phase 4 / 2B)", () => {
    const result = calculatePayroll({
      wageType: "MONTHLY",
      wageAmount: 20_000,
      deductionRates: {
        taxEnabled: true,
        taxRatePercent: 3,
        socialSecurityEnabled: true,
        socialSecurityRatePercent: 5,
        socialSecurityMaxAmount: 750,
      },
    });
    assert.equal(result.gross, 20_000);
    assert.equal(result.deductions, 600 + 750);
    assert.equal(result.net, 18_650);
    assert.equal(
      result.lines.find((line) => line.code === "TAX")?.isLegalPlaceholder,
      undefined,
    );
  });
});

