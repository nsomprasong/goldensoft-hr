import assert from "node:assert/strict";
import { findOverlappingAssignments } from "../src/lib/hr/schedule-conflicts";

const dayShift = {
  startTime: new Date("1970-01-01T02:00:00.000Z"), // 09:00 Bangkok-ish stored as time
  endTime: new Date("1970-01-01T11:00:00.000Z"),
  crossesMidnight: false,
};

// Two different people, same clock → must NOT conflict.
const crossPeople = findOverlappingAssignments([
  {
    id: "a",
    employeeId: "emp-1",
    workDate: "2026-08-03",
    startTime: "09:00",
    endTime: "18:00",
  },
  {
    id: "b",
    employeeId: "emp-2",
    workDate: "2026-08-03",
    startTime: "09:00",
    endTime: "18:00",
  },
]);
assert.equal(crossPeople.length, 0);

// Same person, overlapping clocks → conflict.
const samePerson = findOverlappingAssignments([
  {
    id: "a",
    employeeId: "emp-1",
    workDate: "2026-08-03",
    startTime: "09:00",
    endTime: "18:00",
  },
  {
    id: "b",
    employeeId: "emp-1",
    workDate: "2026-08-03",
    startTime: "17:00",
    endTime: "22:00",
  },
]);
assert.equal(samePerson.length, 1);

void dayShift;
console.log("schedule-conflicts per-employee overlap ok");
