/** Expand an ISO date range into work-date strings (UTC calendar days). */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export type ScheduleDayMode = "weekdays" | "all";

export function expandWorkDates(
  periodStart: string,
  periodEnd: string,
  dayMode: ScheduleDayMode,
): string[] {
  if (!periodStart || !periodEnd || periodEnd < periodStart) return [];
  const out: string[] = [];
  const [ys, ms, ds] = periodStart.split("-").map(Number);
  const [ye, me, de] = periodEnd.split("-").map(Number);
  if (![ys, ms, ds, ye, me, de].every((n) => Number.isFinite(n))) return [];

  const cursor = new Date(Date.UTC(ys, ms - 1, ds));
  const last = new Date(Date.UTC(ye, me - 1, de));
  while (cursor.getTime() <= last.getTime()) {
    const dow = cursor.getUTCDay(); // 0 Sun … 6 Sat
    if (dayMode === "all" || (dow >= 1 && dow <= 5)) {
      out.push(
        `${cursor.getUTCFullYear()}-${pad2(cursor.getUTCMonth() + 1)}-${pad2(cursor.getUTCDate())}`,
      );
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
