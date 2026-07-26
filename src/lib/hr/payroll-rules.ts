/**
 * Payroll period generation and lifecycle rules.
 *
 * All date maths runs in UTC on date-only values. Payroll dates are calendar
 * facts, not instants, so anything timezone-aware would drift by a day.
 */
import { HrError } from "@/lib/hr/errors";

export const PAYROLL_PERIOD_STATUSES = [
  "DRAFT",
  "OPEN",
  "CALCULATING",
  "REVIEW",
  "APPROVED",
  "PAID",
  "LOCKED",
] as const;

export type PayrollPeriodStatusCode = (typeof PAYROLL_PERIOD_STATUSES)[number];

/**
 * Forward flow plus the rework edges an operator actually needs.
 * LOCKED is terminal.
 */
const ALLOWED_TRANSITIONS: Record<
  PayrollPeriodStatusCode,
  readonly PayrollPeriodStatusCode[]
> = {
  DRAFT: ["OPEN"],
  OPEN: ["CALCULATING", "DRAFT"],
  CALCULATING: ["REVIEW", "OPEN"],
  REVIEW: ["APPROVED", "CALCULATING"],
  APPROVED: ["PAID", "REVIEW"],
  PAID: ["LOCKED"],
  LOCKED: [],
};

export function isPayrollPeriodStatus(
  value: string,
): value is PayrollPeriodStatusCode {
  return (PAYROLL_PERIOD_STATUSES as readonly string[]).includes(value);
}

export function canTransitionPayrollStatus(
  from: PayrollPeriodStatusCode,
  to: PayrollPeriodStatusCode,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertPayrollStatusTransition(
  from: string,
  to: string,
): asserts to is PayrollPeriodStatusCode {
  if (!isPayrollPeriodStatus(from) || !isPayrollPeriodStatus(to)) {
    throw new HrError("INVALID_STATUS_TRANSITION", {
      details: { from, to },
    });
  }
  if (from === "LOCKED") {
    throw new HrError("PERIOD_LOCKED", { details: { from, to } });
  }
  if (!canTransitionPayrollStatus(from, to)) {
    throw new HrError("INVALID_STATUS_TRANSITION", { details: { from, to } });
  }
}

// ─── Date helpers (UTC, date-only) ───────────────────────────────────────

export function utcDate(year: number, month1: number, day: number): Date {
  return new Date(Date.UTC(year, month1 - 1, day, 0, 0, 0, 0));
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export function endOfMonth(year: number, month1: number): Date {
  return utcDate(year, month1, daysInMonth(year, month1));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Truncate any instant to its UTC calendar day. */
export function toDateOnly(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HrError("VALIDATION_ERROR", { message: "รูปแบบวันที่ไม่ถูกต้อง" });
  }
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function formatDateOnly(value: Date): string {
  return toDateOnly(value).toISOString().slice(0, 10);
}

// ─── Payment day rules ───────────────────────────────────────────────────

export type PaymentDayRule =
  | { kind: "DAY"; day: number }
  | { kind: "END_OF_PERIOD" }
  | { kind: "DAYS_AFTER_END"; days: number };

/**
 * Accepts `DAY:25`, `END_OF_PERIOD` and `DAYS_AFTER_END:3` (case-insensitive).
 */
export function parsePaymentDayRule(raw: string): PaymentDayRule {
  const value = raw.trim().toUpperCase();

  if (value === "END_OF_PERIOD") {
    return { kind: "END_OF_PERIOD" };
  }

  const day = /^DAY:(\d{1,2})$/.exec(value);
  if (day) {
    const parsed = Number(day[1]);
    if (parsed < 1 || parsed > 31) {
      throw new HrError("VALIDATION_ERROR", {
        message: "วันจ่ายเงินต้องอยู่ระหว่าง 1 ถึง 31",
        details: { paymentDayRule: raw },
      });
    }
    return { kind: "DAY", day: parsed };
  }

  const after = /^DAYS_AFTER_END:(\d{1,3})$/.exec(value);
  if (after) {
    return { kind: "DAYS_AFTER_END", days: Number(after[1]) };
  }

  throw new HrError("VALIDATION_ERROR", {
    message:
      "รูปแบบกติกาวันจ่ายไม่ถูกต้อง (ใช้ DAY:25, END_OF_PERIOD หรือ DAYS_AFTER_END:3)",
    details: { paymentDayRule: raw },
  });
}

/**
 * Payment date for a period. `DAY:n` lands in the month of the period end and
 * rolls forward one month when that day has already passed.
 */
export function computePaymentDate(rule: PaymentDayRule, periodEnd: Date): Date {
  const end = toDateOnly(periodEnd);

  switch (rule.kind) {
    case "END_OF_PERIOD":
      return end;
    case "DAYS_AFTER_END":
      return addDays(end, rule.days);
    case "DAY": {
      const year = end.getUTCFullYear();
      const month = end.getUTCMonth() + 1;
      const clamp = (y: number, m: number) =>
        utcDate(y, m, Math.min(rule.day, daysInMonth(y, m)));
      const sameMonth = clamp(year, month);
      if (sameMonth.getTime() >= end.getTime()) {
        return sameMonth;
      }
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      return clamp(nextYear, nextMonth);
    }
  }
}

// ─── Period generation ───────────────────────────────────────────────────

export type GeneratedPeriod = {
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date;
};

export const SEMIMONTHLY_SECOND_HALF_START_DAY = 17;

/** Semi-monthly split used by GoldenSoft HR: 1–16 and 17–end of month. */
export function generateSemimonthlyPeriods(
  year: number,
  month1: number,
  paymentDayRule: PaymentDayRule,
): GeneratedPeriod[] {
  assertYearMonth(year, month1);
  const lastDay = daysInMonth(year, month1);
  const firstEnd = utcDate(year, month1, 16);
  const secondStart = utcDate(year, month1, SEMIMONTHLY_SECOND_HALF_START_DAY);
  const secondEnd = utcDate(year, month1, lastDay);

  return [
    {
      periodStart: utcDate(year, month1, 1),
      periodEnd: firstEnd,
      paymentDate: computePaymentDate(paymentDayRule, firstEnd),
    },
    {
      periodStart: secondStart,
      periodEnd: secondEnd,
      paymentDate: computePaymentDate(paymentDayRule, secondEnd),
    },
  ];
}

export function generateMonthlyPeriods(
  year: number,
  month1: number,
  paymentDayRule: PaymentDayRule,
): GeneratedPeriod[] {
  assertYearMonth(year, month1);
  const periodEnd = endOfMonth(year, month1);
  return [
    {
      periodStart: utcDate(year, month1, 1),
      periodEnd,
      paymentDate: computePaymentDate(paymentDayRule, periodEnd),
    },
  ];
}

export function generatePeriods(input: {
  frequencyCode: string;
  year: number;
  month: number;
  paymentDayRule: string | PaymentDayRule;
}): GeneratedPeriod[] {
  const rule = typeof input.paymentDayRule === "string"
    ? parsePaymentDayRule(input.paymentDayRule)
    : input.paymentDayRule;

  switch (input.frequencyCode.trim().toUpperCase()) {
    case "SEMIMONTHLY":
      return generateSemimonthlyPeriods(input.year, input.month, rule);
    case "MONTHLY":
      return generateMonthlyPeriods(input.year, input.month, rule);
    default:
      throw new HrError("VALIDATION_ERROR", {
        message: "ยังไม่รองรับความถี่การจ่ายนี้",
        details: { frequencyCode: input.frequencyCode },
      });
  }
}

export function assertPeriodRange(periodStart: Date, periodEnd: Date): void {
  if (toDateOnly(periodEnd).getTime() < toDateOnly(periodStart).getTime()) {
    throw new HrError("VALIDATION_ERROR", {
      message: "วันสิ้นสุดงวดต้องไม่ก่อนวันเริ่มงวด",
    });
  }
}

function assertYearMonth(year: number, month1: number): void {
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ปีไม่ถูกต้อง",
      details: { year },
    });
  }
  if (!Number.isInteger(month1) || month1 < 1 || month1 > 12) {
    throw new HrError("VALIDATION_ERROR", {
      message: "เดือนต้องอยู่ระหว่าง 1 ถึง 12",
      details: { month: month1 },
    });
  }
}
