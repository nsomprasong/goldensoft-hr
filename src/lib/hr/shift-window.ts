/**
 * Pure helpers for assigned-shift window checks (wrong-shift detection).
 * Times use Prisma TIME columns as UTC wall-clock (HH:mm).
 */

export const SHIFT_WINDOW_BUFFER_MINUTES = 60;

export type ShiftClockParts = {
  id: string;
  name: string;
  startTime: Date | string;
  endTime: Date | string;
  crossesMidnight?: boolean | null;
};

export function wallClockMinutesFromTime(value: Date | string): number {
  if (typeof value === "string") {
    const [hh, mm] = value.slice(0, 5).split(":").map(Number);
    return (hh || 0) * 60 + (mm || 0);
  }
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

export function formatShiftHm(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 5);
  const hh = String(value.getUTCHours()).padStart(2, "0");
  const mm = String(value.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function bangkokScheduleInstant(
  workDate: string,
  minutesFromMidnight: number,
): number {
  return (
    new Date(`${workDate}T00:00:00+07:00`).getTime() +
    minutesFromMidnight * 60_000
  );
}

/** Inclusive window around a shift for a calendar work date (Bangkok). */
export function shiftWindowBounds(
  workDate: string,
  shift: Pick<ShiftClockParts, "startTime" | "endTime" | "crossesMidnight">,
  bufferMinutes = SHIFT_WINDOW_BUFFER_MINUTES,
): { windowStartMs: number; windowEndMs: number } {
  const startMin = wallClockMinutesFromTime(shift.startTime);
  const endMin = wallClockMinutesFromTime(shift.endTime);
  const crosses =
    shift.crossesMidnight ?? endMin <= startMin;
  const span = crosses
    ? 24 * 60 - startMin + endMin
    : Math.max(0, endMin - startMin);
  const scheduledStart = bangkokScheduleInstant(workDate, startMin);
  const scheduledEnd = scheduledStart + span * 60_000;
  return {
    windowStartMs: scheduledStart - bufferMinutes * 60_000,
    windowEndMs: scheduledEnd + bufferMinutes * 60_000,
  };
}

export function isWithinShiftWindow(
  occurredAt: Date,
  workDate: string,
  shift: Pick<ShiftClockParts, "startTime" | "endTime" | "crossesMidnight">,
  bufferMinutes = SHIFT_WINDOW_BUFFER_MINUTES,
): boolean {
  const { windowStartMs, windowEndMs } = shiftWindowBounds(
    workDate,
    shift,
    bufferMinutes,
  );
  const t = occurredAt.getTime();
  return t >= windowStartMs && t <= windowEndMs;
}

/** Distance in ms outside the window (0 if inside). */
export function distanceOutsideShiftWindow(
  occurredAt: Date,
  workDate: string,
  shift: Pick<ShiftClockParts, "startTime" | "endTime" | "crossesMidnight">,
  bufferMinutes = SHIFT_WINDOW_BUFFER_MINUTES,
): number {
  const { windowStartMs, windowEndMs } = shiftWindowBounds(
    workDate,
    shift,
    bufferMinutes,
  );
  const t = occurredAt.getTime();
  if (t < windowStartMs) return windowStartMs - t;
  if (t > windowEndMs) return t - windowEndMs;
  return 0;
}

export type ShiftMismatchEval = {
  isMismatch: boolean;
  assigned: ShiftClockParts | null;
  suggested: ShiftClockParts | null;
};

/**
 * If assigned shift has no window match and another candidate fits better,
 * report a mismatch with the best suggested shift.
 */
export function evaluateShiftMismatch(input: {
  workDate: string;
  occurredAt: Date;
  assigned: ShiftClockParts | null;
  candidates: ShiftClockParts[];
  bufferMinutes?: number;
}): ShiftMismatchEval {
  const buffer = input.bufferMinutes ?? SHIFT_WINDOW_BUFFER_MINUTES;
  const assigned = input.assigned;
  if (!assigned) {
    return { isMismatch: false, assigned: null, suggested: null };
  }

  if (
    isWithinShiftWindow(
      input.occurredAt,
      input.workDate,
      assigned,
      buffer,
    )
  ) {
    return { isMismatch: false, assigned, suggested: null };
  }

  let best: ShiftClockParts | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const candidate of input.candidates) {
    if (candidate.id === assigned.id) continue;
    const dist = distanceOutsideShiftWindow(
      input.occurredAt,
      input.workDate,
      candidate,
      buffer,
    );
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }

  // Prefer a candidate that actually contains the punch over a distant one.
  const inside = input.candidates.find(
    (row) =>
      row.id !== assigned.id &&
      isWithinShiftWindow(
        input.occurredAt,
        input.workDate,
        row,
        buffer,
      ),
  );
  const suggested = inside ?? best;

  if (!suggested) {
    return { isMismatch: true, assigned, suggested: null };
  }

  return { isMismatch: true, assigned, suggested };
}
