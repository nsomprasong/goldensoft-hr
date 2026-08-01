/** Expand an ISO date range into work-date strings (UTC calendar days). */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Preset modes kept for callers that still use จ–ศ / ทุกวัน. */
export type ScheduleDayMode = "weekdays" | "all";

export const WEEKDAY_WORK_DAYS = [1, 2, 3, 4, 5] as const;
export const ALL_WORK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export type WorkDaysInput = ScheduleDayMode | readonly number[];

export function resolveWorkDays(workDays: WorkDaysInput): number[] {
  if (typeof workDays === "string") {
    return workDays === "all" ? [...ALL_WORK_DAYS] : [...WEEKDAY_WORK_DAYS];
  }
  const cleaned = [
    ...new Set(
      workDays.filter(
        (d): d is number =>
          typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6,
      ),
    ),
  ].sort((a, b) => a - b);
  return cleaned;
}

export function expandWorkDates(
  periodStart: string,
  periodEnd: string,
  workDays: WorkDaysInput = "weekdays",
): string[] {
  if (!periodStart || !periodEnd || periodEnd < periodStart) return [];
  const allowed = new Set(resolveWorkDays(workDays));
  if (allowed.size === 0) return [];

  const out: string[] = [];
  const [ys, ms, ds] = periodStart.split("-").map(Number);
  const [ye, me, de] = periodEnd.split("-").map(Number);
  if (![ys, ms, ds, ye, me, de].every((n) => Number.isFinite(n))) return [];

  const cursor = new Date(Date.UTC(ys, ms - 1, ds));
  const last = new Date(Date.UTC(ye, me - 1, de));
  while (cursor.getTime() <= last.getTime()) {
    const dow = cursor.getUTCDay(); // 0 Sun … 6 Sat
    if (allowed.has(dow)) {
      out.push(
        `${cursor.getUTCFullYear()}-${pad2(cursor.getUTCMonth() + 1)}-${pad2(cursor.getUTCDate())}`,
      );
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** Inclusive date-range overlap (ISO `YYYY-MM-DD`). */
export function dateRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

/** Next `count` calendar days starting at `startIso` (inclusive), clamped to period. */
export function expandConsecutiveDates(
  startIso: string,
  count: number,
  periodStart: string,
  periodEnd: string,
): string[] {
  if (!startIso || count < 1) return [];
  const [y, m, d] = startIso.split("-").map(Number);
  if (![y, m, d].every((n) => Number.isFinite(n))) return [];
  const out: string[] = [];
  const cursor = new Date(Date.UTC(y, m - 1, d));
  while (out.length < count) {
    const iso = `${cursor.getUTCFullYear()}-${pad2(cursor.getUTCMonth() + 1)}-${pad2(cursor.getUTCDate())}`;
    if (iso > periodEnd) break;
    if (iso >= periodStart) out.push(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
