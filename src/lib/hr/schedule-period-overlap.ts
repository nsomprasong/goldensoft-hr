import { dateRangesOverlap } from "@/lib/hr/schedule-dates";

export type PeriodRange = {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  statusCode?: string;
};

/** Other periods whose date range overlaps the target (same branch list assumed). */
export function findOverlappingPeriods<T extends PeriodRange>(
  target: PeriodRange,
  candidates: T[],
): T[] {
  return candidates.filter(
    (row) =>
      row.id !== target.id &&
      dateRangesOverlap(
        target.periodStart,
        target.periodEnd,
        row.periodStart,
        row.periodEnd,
      ),
  );
}

export type ScheduleDateConflict = {
  employeeId: string;
  employeeName: string;
  workDate: string;
  periodId: string;
  periodName: string;
  periodStart: string;
  periodEnd: string;
};

export type ScheduleConflictPeriodSummary = {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  conflictCount: number;
};

export function summarizeConflictPeriods(
  conflicts: ScheduleDateConflict[],
): ScheduleConflictPeriodSummary[] {
  const map = new Map<string, ScheduleConflictPeriodSummary>();
  for (const row of conflicts) {
    const existing = map.get(row.periodId);
    if (existing) {
      existing.conflictCount += 1;
      continue;
    }
    map.set(row.periodId, {
      id: row.periodId,
      name: row.periodName,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      conflictCount: 1,
    });
  }
  return [...map.values()].sort((a, b) =>
    a.periodStart.localeCompare(b.periodStart),
  );
}
