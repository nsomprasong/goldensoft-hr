/**
 * Deterministic shift arithmetic.
 *
 * Shift start/end are wall-clock times with no date and no timezone. They are
 * stored as PostgreSQL `time` and surface through Prisma as a `Date` pinned to
 * 1970-01-01 UTC, so every conversion here reads UTC components only. Doing
 * anything else would shift a Bangkok 08:00 into 01:00 on the server.
 */
import { HrError } from "@/lib/hr/errors";

export const MINUTES_PER_DAY = 1440;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export type TimeInput = string | Date;

/** Minutes elapsed since midnight, ignoring any date or timezone component. */
export function parseTimeToMinutes(value: TimeInput): number {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new HrError("INVALID_SHIFT", { message: "เวลาไม่ถูกต้อง" });
    }
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }

  const match = TIME_PATTERN.exec(value.trim());
  if (!match) {
    throw new HrError("INVALID_SHIFT", {
      message: "รูปแบบเวลาต้องเป็น HH:mm (00:00 - 23:59)",
      details: { value },
    });
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** "HH:mm" for display / API responses. */
export function formatMinutesAsTime(minutes: number): string {
  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  const hh = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mm = String(normalized % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** A `Date` on the Prisma epoch day carrying only the time-of-day. */
export function timeMinutesToDate(minutes: number): Date {
  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  return new Date(Date.UTC(1970, 0, 1, 0, normalized, 0, 0));
}

/** True when the end time falls on the following calendar day. */
export function detectCrossesMidnight(
  startMinutes: number,
  endMinutes: number,
): boolean {
  return endMinutes <= startMinutes;
}

/** Total clock span of a shift including breaks. */
export function computeShiftSpanMinutes(
  startMinutes: number,
  endMinutes: number,
  crossesMidnight: boolean,
): number {
  const span = crossesMidnight || endMinutes <= startMinutes
    ? endMinutes + MINUTES_PER_DAY - startMinutes
    : endMinutes - startMinutes;

  if (span <= 0 || span > MINUTES_PER_DAY) {
    throw new HrError("INVALID_SHIFT", {
      message: "ช่วงเวลาทำงานต้องมากกว่า 0 และไม่เกิน 24 ชั่วโมง",
      details: { span },
    });
  }
  return span;
}

export type ShiftTimingInput = {
  startTime: TimeInput;
  endTime: TimeInput;
  breakMinutes?: number;
  crossesMidnight?: boolean;
  graceLateMinutes?: number;
  graceEarlyLeaveMinutes?: number;
  overtimeAfterMinutes?: number | null;
};

export type ShiftTiming = {
  startMinutes: number;
  endMinutes: number;
  breakMinutes: number;
  crossesMidnight: boolean;
  spanMinutes: number;
  standardWorkMinutes: number;
};

/**
 * Resolve every derived shift value at once so create/update paths cannot drift
 * apart. `crossesMidnight` is inferred when the caller does not state it.
 */
export function resolveShiftTiming(input: ShiftTimingInput): ShiftTiming {
  const startMinutes = parseTimeToMinutes(input.startTime);
  const endMinutes = parseTimeToMinutes(input.endTime);
  const breakMinutes = input.breakMinutes ?? 0;

  if (!Number.isInteger(breakMinutes) || breakMinutes < 0) {
    throw new HrError("INVALID_SHIFT", {
      message: "เวลาพักต้องเป็นจำนวนนาทีที่ไม่ติดลบ",
      details: { breakMinutes },
    });
  }

  for (const [label, value] of [
    ["graceLateMinutes", input.graceLateMinutes],
    ["graceEarlyLeaveMinutes", input.graceEarlyLeaveMinutes],
  ] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new HrError("INVALID_SHIFT", {
        message: "ค่าผ่อนผันต้องเป็นจำนวนนาทีที่ไม่ติดลบ",
        details: { [label]: value },
      });
    }
  }

  const crossesMidnight = input.crossesMidnight ??
    detectCrossesMidnight(startMinutes, endMinutes);

  if (!crossesMidnight && endMinutes <= startMinutes) {
    throw new HrError("INVALID_SHIFT", {
      message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม หรือระบุว่าเป็นกะข้ามคืน",
    });
  }

  const spanMinutes = computeShiftSpanMinutes(
    startMinutes,
    endMinutes,
    crossesMidnight,
  );

  if (breakMinutes >= spanMinutes) {
    throw new HrError("INVALID_SHIFT", {
      message: "เวลาพักต้องน้อยกว่าช่วงเวลาทำงานทั้งหมด",
      details: { breakMinutes, spanMinutes },
    });
  }

  const standardWorkMinutes = spanMinutes - breakMinutes;

  const overtimeAfter = input.overtimeAfterMinutes;
  if (overtimeAfter != null) {
    if (!Number.isInteger(overtimeAfter) || overtimeAfter < 0) {
      throw new HrError("INVALID_SHIFT", {
        message: "เกณฑ์เริ่มคิดล่วงเวลาต้องเป็นจำนวนนาทีที่ไม่ติดลบ",
        details: { overtimeAfterMinutes: overtimeAfter },
      });
    }
  }

  return {
    startMinutes,
    endMinutes,
    breakMinutes,
    crossesMidnight,
    spanMinutes,
    standardWorkMinutes,
  };
}

/** Convenience wrapper used by callers that only need the work total. */
export function computeStandardWorkMinutes(input: ShiftTimingInput): number {
  return resolveShiftTiming(input).standardWorkMinutes;
}
