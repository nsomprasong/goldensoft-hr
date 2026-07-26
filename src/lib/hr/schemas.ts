/** Zod request schemas for the HR API surface. */
import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const uuid = z.string().uuid();
const dateString = z.union([z.string().trim().min(1), z.date()]);
const nullableText = z.string().nullable().optional();

export const employeeCreateSchema = z.object({
  employeeCode: nonEmpty,
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
  code: nonEmpty,
  nameTh: nonEmpty,
  nameEn: nonEmpty,
  description: nullableText,
});

export const departmentUpdateSchema = z.object({
  nameTh: nonEmpty.optional(),
  nameEn: nonEmpty.optional(),
  description: nullableText,
  isActive: z.boolean().optional(),
});

export const positionCreateSchema = departmentCreateSchema.extend({
  departmentId: uuid.nullable().optional(),
});

export const positionUpdateSchema = departmentUpdateSchema.extend({
  departmentId: uuid.nullable().optional(),
});

export const shiftCreateSchema = z.object({
  code: nonEmpty,
  name: nonEmpty,
  shiftTypeId: uuid,
  startTime: nonEmpty,
  endTime: nonEmpty,
  branchId: uuid.nullable().optional(),
  breakMinutes: z.number().int().optional(),
  graceLateMinutes: z.number().int().optional(),
  graceEarlyLeaveMinutes: z.number().int().optional(),
  crossesMidnight: z.boolean().optional(),
  overtimeAfterMinutes: z.number().int().nullable().optional(),
});

export const shiftUpdateSchema = z.object({
  name: nonEmpty.optional(),
  shiftTypeId: uuid.optional(),
  startTime: nonEmpty.optional(),
  endTime: nonEmpty.optional(),
  branchId: uuid.nullable().optional(),
  breakMinutes: z.number().int().optional(),
  graceLateMinutes: z.number().int().optional(),
  graceEarlyLeaveMinutes: z.number().int().optional(),
  crossesMidnight: z.boolean().optional(),
  overtimeAfterMinutes: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const overtimeRuleCreateSchema = z.object({
  code: nonEmpty,
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
  code: nonEmpty,
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
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyMeters: z.number().nonnegative().optional(),
}).passthrough();
