import { computeShiftSpanMinutes, parseTimeToMinutes, type TimeInput } from "@/lib/hr/shift-math";

export type AttendanceSchedule = {
  workDate: string;
  startTime: TimeInput;
  endTime: TimeInput;
  breakMinutes?: number;
  crossesMidnight?: boolean;
  graceLateMinutes?: number;
  graceEarlyLeaveMinutes?: number;
  overtimeAfterMinutes?: number | null;
};

export type AttendanceStatusCode =
  | "PRESENT" | "LATE" | "EARLY_LEAVE" | "ABSENT" | "LEAVE" | "HOLIDAY"
  | "REST_DAY" | "INCOMPLETE" | "MISSING_CLOCK_IN" | "MISSING_CLOCK_OUT";

export type AttendanceCalculation = {
  status: AttendanceStatusCode;
  scheduledMinutes: number;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeProposedMinutes: number;
  overtimeWorkedMinutes: number;
};

const atTime = (date: string, minutes: number) =>
  new Date(`${date}T00:00:00.000Z`).getTime() + minutes * 60_000;

/** Computes one work-date; `clockOutAt` may fall on the following day. */
export function calculateAttendanceDay(input: {
  schedule?: AttendanceSchedule | null;
  clockInAt?: Date | null;
  clockOutAt?: Date | null;
  isLeave?: boolean;
  isHoliday?: boolean;
  isRestDay?: boolean;
}): AttendanceCalculation {
  if (input.isLeave) return zero("LEAVE");
  if (input.isHoliday) return zero("HOLIDAY");
  if (input.isRestDay) return zero("REST_DAY");
  if (!input.schedule) return zero(input.clockInAt || input.clockOutAt ? "INCOMPLETE" : "ABSENT");
  if (!input.clockInAt) return zero(input.clockOutAt ? "MISSING_CLOCK_IN" : "ABSENT");
  if (!input.clockOutAt) return zero("MISSING_CLOCK_OUT");

  const schedule = input.schedule;
  const start = parseTimeToMinutes(schedule.startTime);
  const end = parseTimeToMinutes(schedule.endTime);
  const crossesMidnight = schedule.crossesMidnight ?? end <= start;
  const span = computeShiftSpanMinutes(start, end, crossesMidnight);
  const scheduledMinutes = span - (schedule.breakMinutes ?? 0);
  const scheduledStart = atTime(schedule.workDate, start);
  const scheduledEnd = scheduledStart + span * 60_000;
  const clockIn = input.clockInAt.getTime();
  const clockOut = input.clockOutAt.getTime();
  const workedMinutes = Math.max(0, Math.floor((clockOut - clockIn) / 60_000) - (schedule.breakMinutes ?? 0));
  const lateMinutes = Math.max(0, Math.floor((clockIn - scheduledStart) / 60_000) - (schedule.graceLateMinutes ?? 0));
  const earlyLeaveMinutes = Math.max(0, Math.floor((scheduledEnd - clockOut) / 60_000) - (schedule.graceEarlyLeaveMinutes ?? 0));
  const overtimeWorkedMinutes = Math.max(0, Math.floor((clockOut - scheduledEnd) / 60_000));
  const threshold = schedule.overtimeAfterMinutes ?? scheduledMinutes;
  const overtimeProposedMinutes = Math.max(0, workedMinutes - threshold);
  const status = lateMinutes > 0 ? "LATE" : earlyLeaveMinutes > 0 ? "EARLY_LEAVE" : "PRESENT";
  return { status, scheduledMinutes, workedMinutes, lateMinutes, earlyLeaveMinutes, overtimeProposedMinutes, overtimeWorkedMinutes };
}

function zero(status: AttendanceStatusCode): AttendanceCalculation {
  return { status, scheduledMinutes: 0, workedMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeProposedMinutes: 0, overtimeWorkedMinutes: 0 };
}
