/** Zod request schemas for the HR API surface. */
import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const uuid = z.string().uuid();
const dateString = z.union([z.string().trim().min(1), z.date()]);
const nullableText = z.string().nullable().optional();

/** Empty string / null → omitted, so the service can auto-allocate. */
const optionalCode = z.preprocess(
  (value) => {
    if (value == null) return undefined;
    if (typeof value === "string" && value.trim() === "") return undefined;
    return value;
  },
  nonEmpty.optional(),
);

/** "" → null so “ทุกสาขา” from selects does not fail UUID validation. */
const optionalBranchId = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  uuid.nullable().optional(),
);

const optionalInt = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return value;
}, z.number().int().optional());

const optionalNullableInt = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return value;
}, z.number().int().nullable().optional());


export const employeeCreateSchema = z.object({
  employeeCode: optionalCode,
  branchId: uuid,
  employmentTypeId: uuid,
  employeeStatusId: uuid,
  firstNameTh: nonEmpty,
  lastNameTh: nonEmpty,
  firstNameEn: nullableText,
  lastNameEn: nullableText,
  displayName: nullableText,
  phone: nonEmpty,
  email: nullableText,
  photoUrl: nullableText,
  emergencyContactName: nullableText,
  emergencyContactPhone: nullableText,
  hireDate: dateString,
  probationEndDate: z.union([z.string(), z.date()]).nullable().optional(),
  departmentId: uuid.nullable().optional(),
  positionId: uuid.nullable().optional(),
  notes: nullableText,
});

export const employeeUpdateSchema = z.object({
  branchId: uuid.optional(),
  employmentTypeId: uuid.optional(),
  employeeStatusId: uuid.optional(),
  firstNameTh: nonEmpty.optional(),
  lastNameTh: nonEmpty.optional(),
  firstNameEn: nullableText,
  lastNameEn: nullableText,
  displayName: nonEmpty.optional(),
  phone: nonEmpty.optional(),
  email: nullableText,
  photoUrl: nullableText,
  emergencyContactName: nullableText,
  emergencyContactPhone: nullableText,
  hireDate: dateString.optional(),
  probationEndDate: z.union([z.string(), z.date()]).nullable().optional(),
  resignationDate: z.union([z.string(), z.date()]).nullable().optional(),
  terminatedAt: z.union([z.string(), z.date()]).nullable().optional(),
  departmentId: uuid.nullable().optional(),
  positionId: uuid.nullable().optional(),
  notes: nullableText,
});

export const employeeDeactivateSchema = z.object({
  employeeStatusCode: nonEmpty.optional(),
  resignationDate: z.union([z.string(), z.date()]).nullable().optional(),
});

export const employeeReactivateSchema = z.object({
  employeeStatusCode: nonEmpty.optional(),
});

export const linkPlatformUserSchema = z.object({
  platformUserId: uuid,
  authUserId: uuid.nullable().optional(),
});

export const compensationCreateSchema = z.object({
  wageTypeId: uuid,
  amount: z.number(),
  effectiveFrom: dateString,
  effectiveTo: z.union([z.string(), z.date()]).nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  standardHoursPerDay: z.number().nullable().optional(),
  standardDaysPerMonth: z.number().nullable().optional(),
  overtimeEligible: z.boolean().optional(),
});

export const departmentCreateSchema = z.object({
  code: optionalCode,
  nameTh: nonEmpty,
  nameEn: optionalCode,
  description: nullableText,
});

export const departmentUpdateSchema = z.object({
  nameTh: nonEmpty.optional(),
  nameEn: optionalCode,
  description: nullableText,
  isActive: z.boolean().optional(),
});

export const positionCreateSchema = z.object({
  code: optionalCode,
  nameTh: nonEmpty,
  nameEn: optionalCode,
  description: nullableText,
  departmentId: uuid.nullable().optional(),
});

export const positionUpdateSchema = departmentUpdateSchema.extend({
  departmentId: uuid.nullable().optional(),
});

export const shiftCreateSchema = z.object({
  code: optionalCode,
  name: nonEmpty,
  shiftTypeId: uuid,
  startTime: nonEmpty,
  endTime: nonEmpty,
  branchId: optionalBranchId,
  breakMinutes: optionalInt,
  graceLateMinutes: optionalInt,
  graceEarlyLeaveMinutes: optionalInt,
  crossesMidnight: z.boolean().optional(),
  overtimeAfterMinutes: optionalNullableInt,
});

export const shiftUpdateSchema = z.object({
  name: nonEmpty.optional(),
  shiftTypeId: uuid.optional(),
  startTime: nonEmpty.optional(),
  endTime: nonEmpty.optional(),
  branchId: optionalBranchId,
  breakMinutes: optionalInt,
  graceLateMinutes: optionalInt,
  graceEarlyLeaveMinutes: optionalInt,
  crossesMidnight: z.boolean().optional(),
  overtimeAfterMinutes: optionalNullableInt,
  isActive: z.boolean().optional(),
});

export const overtimeRuleCreateSchema = z.object({
  code: optionalCode,
  name: nonEmpty,
  rateTypeId: uuid,
  multiplier: z.number().positive(),
  fixedAmount: z.number().min(0).nullable().optional(),
  effectiveFrom: dateString,
  effectiveTo: z.union([z.string(), z.date()]).nullable().optional(),
});

export const overtimeRuleUpdateSchema = z.object({
  name: nonEmpty.optional(),
  rateTypeId: uuid.optional(),
  multiplier: z.number().positive().optional(),
  fixedAmount: z.number().min(0).nullable().optional(),
  effectiveFrom: dateString.optional(),
  effectiveTo: z.union([z.string(), z.date()]).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const payrollScheduleCreateSchema = z.object({
  code: optionalCode,
  name: nonEmpty,
  payFrequencyId: uuid,
  periodStartRule: nonEmpty,
  periodEndRule: nonEmpty,
  paymentDayRule: nonEmpty,
  timezone: z.string().trim().optional(),
});

export const payrollScheduleUpdateSchema = z.object({
  name: nonEmpty.optional(),
  payFrequencyId: uuid.optional(),
  periodStartRule: nonEmpty.optional(),
  periodEndRule: nonEmpty.optional(),
  paymentDayRule: nonEmpty.optional(),
  timezone: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const payrollPeriodCreateSchema = z.union([
  z.object({
    payrollScheduleId: uuid,
    periodStart: dateString,
    periodEnd: dateString,
    paymentDate: z.union([z.string(), z.date()]).nullable().optional(),
    statusCode: nonEmpty.optional(),
  }),
  z.object({
    payrollScheduleId: uuid,
    year: z.number().int(),
    month: z.number().int(),
  }),
]);

export const payrollPeriodUpdateSchema = z.object({
  statusCode: nonEmpty,
});

/** Operational endpoints validate a strict object while domain services own
 * cross-field and state-transition validation. */
export const hrOperationSchema = z.object({
  action: z.string().trim().optional(),
  confirm: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(8).optional(),
  code: z.string().trim().optional(),
  name: z.string().trim().optional(),
  branchId: uuid.optional(),
  employeeId: uuid.optional(),
  workLocationId: uuid.optional(),
  workCalendarId: uuid.optional(),
  payrollPeriodId: uuid.optional(),
  shiftId: uuid.optional().nullable(),
  workDate: dateString.optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  periodStart: dateString.optional(),
  periodEnd: dateString.optional(),
  id: uuid.optional(),
  leaveTypeId: uuid.optional(),
  startUnitId: uuid.optional(),
  endUnitId: uuid.optional(),
  coverEmployeeId: uuid.nullable().optional(),
  annualEntitlement: z.number().nonnegative().optional(),
  inheritFromOrg: z.boolean().optional(),
  requestedAmount: z.number().positive().optional(),
  startAt: z.string().trim().min(1).optional(),
  endAt: z.string().trim().min(1).optional(),
  reason: z.string().trim().nullable().optional(),
  /** Salary advance / payroll amounts. */
  amount: z.number().positive().optional(),
  advanceDate: dateString.optional(),
  installmentCount: z.number().int().min(1).max(24).optional(),
  startPayrollPeriodId: optionalBranchId,
  disbursementMode: z.enum(["CASH_ALREADY", "WITH_SALARY"]).optional(),
  autoApprove: z.boolean().optional(),
  reviewNote: z.string().trim().nullable().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyMeters: z.number().nonnegative().optional(),
  /** Punch evidence — data URL or raw base64 (Phase 2 / 1C). */
  photoBase64: z.string().min(32).optional(),
}).passthrough();
