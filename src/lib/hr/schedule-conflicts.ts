import { computeShiftSpanMinutes, parseTimeToMinutes, type TimeInput } from "@/lib/hr/shift-math";

export type ScheduledAssignment = {
  id: string;
  workDate: string;
  startTime: TimeInput;
  endTime: TimeInput;
  crossesMidnight?: boolean;
  /** When set, overlaps are only compared within the same employee. */
  employeeId?: string;
};

type Range = ScheduledAssignment & { start: number; end: number };
const DAY = 86_400_000;

function range(assignment: ScheduledAssignment): Range {
  const startMinutes = parseTimeToMinutes(assignment.startTime);
  const endMinutes = parseTimeToMinutes(assignment.endTime);
  const span = computeShiftSpanMinutes(
    startMinutes,
    endMinutes,
    assignment.crossesMidnight ?? endMinutes <= startMinutes,
  );
  const start =
    new Date(`${assignment.workDate}T00:00:00.000Z`).getTime() +
    startMinutes * 60_000;
  return { ...assignment, start, end: start + span * 60_000 };
}

function overlapsWithinGroup(assignments: ScheduledAssignment[]) {
  const ranges = assignments.map(range).sort((a, b) => a.start - b.start);
  const conflicts: Array<{ first: ScheduledAssignment; second: ScheduledAssignment }> =
    [];
  for (let index = 1; index < ranges.length; index++) {
    if (ranges[index]!.start < ranges[index - 1]!.end) {
      conflicts.push({ first: ranges[index - 1]!, second: ranges[index]! });
    }
  }
  return conflicts;
}

/**
 * Same-person time overlap only.
 * Rows without employeeId are treated as one group (legacy single-person lists).
 */
export function findOverlappingAssignments(assignments: ScheduledAssignment[]) {
  const hasEmployeeIds = assignments.some((row) => row.employeeId);
  if (!hasEmployeeIds) return overlapsWithinGroup(assignments);

  const byEmployee = new Map<string, ScheduledAssignment[]>();
  for (const row of assignments) {
    const key = row.employeeId ?? "";
    const list = byEmployee.get(key) ?? [];
    list.push(row);
    byEmployee.set(key, list);
  }

  const conflicts: Array<{ first: ScheduledAssignment; second: ScheduledAssignment }> =
    [];
  for (const group of byEmployee.values()) {
    conflicts.push(...overlapsWithinGroup(group));
  }
  return conflicts;
}

export function findMinimumRestViolations(
  assignments: ScheduledAssignment[],
  minimumRestHours: number,
) {
  const hasEmployeeIds = assignments.some((row) => row.employeeId);
  const groups = hasEmployeeIds
    ? (() => {
        const map = new Map<string, ScheduledAssignment[]>();
        for (const row of assignments) {
          const key = row.employeeId ?? "";
          const list = map.get(key) ?? [];
          list.push(row);
          map.set(key, list);
        }
        return [...map.values()];
      })()
    : [assignments];

  const violations: Array<{
    first: ScheduledAssignment;
    second: ScheduledAssignment;
    restMinutes: number;
  }> = [];
  for (const group of groups) {
    const ranges = group.map(range).sort((a, b) => a.start - b.start);
    for (let index = 1; index < ranges.length; index++) {
      const restMinutes = Math.floor(
        (ranges[index]!.start - ranges[index - 1]!.end) / 60_000,
      );
      if (restMinutes < minimumRestHours * 60) {
        violations.push({
          first: ranges[index - 1]!,
          second: ranges[index]!,
          restMinutes,
        });
      }
    }
  }
  return violations;
}

export const ONE_DAY_MILLISECONDS = DAY;
