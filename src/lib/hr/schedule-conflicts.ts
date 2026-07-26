import { computeShiftSpanMinutes, parseTimeToMinutes, type TimeInput } from "@/lib/hr/shift-math";

export type ScheduledAssignment = {
  id: string;
  workDate: string;
  startTime: TimeInput;
  endTime: TimeInput;
  crossesMidnight?: boolean;
};

type Range = ScheduledAssignment & { start: number; end: number };
const DAY = 86_400_000;

function range(assignment: ScheduledAssignment): Range {
  const startMinutes = parseTimeToMinutes(assignment.startTime);
  const endMinutes = parseTimeToMinutes(assignment.endTime);
  const span = computeShiftSpanMinutes(startMinutes, endMinutes, assignment.crossesMidnight ?? endMinutes <= startMinutes);
  const start = new Date(`${assignment.workDate}T00:00:00.000Z`).getTime() + startMinutes * 60_000;
  return { ...assignment, start, end: start + span * 60_000 };
}

export function findOverlappingAssignments(assignments: ScheduledAssignment[]) {
  const ranges = assignments.map(range).sort((a, b) => a.start - b.start);
  const conflicts: Array<{ first: ScheduledAssignment; second: ScheduledAssignment }> = [];
  for (let index = 1; index < ranges.length; index++) {
    if (ranges[index].start < ranges[index - 1].end) conflicts.push({ first: ranges[index - 1], second: ranges[index] });
  }
  return conflicts;
}

export function findMinimumRestViolations(assignments: ScheduledAssignment[], minimumRestHours: number) {
  const ranges = assignments.map(range).sort((a, b) => a.start - b.start);
  const violations: Array<{ first: ScheduledAssignment; second: ScheduledAssignment; restMinutes: number }> = [];
  for (let index = 1; index < ranges.length; index++) {
    const restMinutes = Math.floor((ranges[index].start - ranges[index - 1].end) / 60_000);
    if (restMinutes < minimumRestHours * 60) violations.push({ first: ranges[index - 1], second: ranges[index], restMinutes });
  }
  return violations;
}

export const ONE_DAY_MILLISECONDS = DAY;
