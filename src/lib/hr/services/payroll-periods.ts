/**
 * Payroll period service: generation from a schedule plus the status lifecycle
 * DRAFT → OPEN → CALCULATING → REVIEW → APPROVED → PAID → LOCKED.
 */
import { assertHrPermission } from "@/lib/hr/authorize";
import { HR_AUDIT_ACTIONS, writeHrAudit } from "@/lib/hr/audit";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import {
  assertPayrollStatusTransition,
  assertPeriodRange,
  computePaymentDate,
  generatePeriods,
  parsePaymentDayRule,
  toDateOnly,
  type PayrollPeriodStatusCode,
} from "@/lib/hr/payroll-rules";
import type {
  HrRepository,
  PayrollPeriodRecord,
} from "@/lib/hr/repository/types";
import {
  normalizePagination,
  requireMasterByCode,
  toPagedResponse,
  type HrServiceContext,
  type PagedResponse,
  type PageRequest,
} from "@/lib/hr/services/shared";

export const OPEN_PERIOD_STATUS_CODES: readonly PayrollPeriodStatusCode[] = [
  "OPEN",
  "CALCULATING",
  "REVIEW",
];

export type PayrollPeriodListInput = PageRequest & {
  payrollScheduleId?: string | null;
  statusCodes?: readonly string[] | null;
};

export type PayrollPeriodCreateData = {
  payrollScheduleId: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  paymentDate?: string | Date | null;
  statusCode?: string;
};

export type PayrollPeriodGenerateData = {
  payrollScheduleId: string;
  year: number;
  month: number;
};

async function statusIdsForCodes(
  repository: HrRepository,
  codes: readonly string[],
): Promise<string[]> {
  const rows = await Promise.all(
    codes.map((code) =>
      requireMasterByCode(repository, "payrollPeriodStatus", code),
    ),
  );
  return rows.map((row) => row.id);
}

async function statusCodeOf(
  repository: HrRepository,
  statusId: string,
): Promise<string> {
  const status = await repository.masters.findById(
    "payrollPeriodStatus",
    statusId,
  );
  if (!status) {
    throw new HrError("NOT_FOUND", { details: { statusId } });
  }
  return status.code;
}

export async function listPayrollPeriods(
  repository: HrRepository,
  ctx: HrServiceContext,
  input: PayrollPeriodListInput = {},
): Promise<PagedResponse<PayrollPeriodRecord>> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.payrollPeriodRead,
    HR_PERMISSIONS.payrollPeriodManage,
  ]);
  const pagination = normalizePagination(input);
  const statusIds = input.statusCodes?.length
    ? await statusIdsForCodes(repository, input.statusCodes)
    : null;

  const result = await repository.payrollPeriods.list({
    organizationId: ctx.organizationId,
    payrollScheduleId: input.payrollScheduleId ?? null,
    statusIds,
    skip: pagination.skip,
    take: pagination.take,
  });

  return toPagedResponse(result, pagination);
}

export async function getPayrollPeriod(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
): Promise<PayrollPeriodRecord> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.payrollPeriodRead,
    HR_PERMISSIONS.payrollPeriodManage,
  ]);
  const row = await repository.payrollPeriods.findById(ctx.organizationId, id);
  if (!row) throw new HrError("NOT_FOUND", { details: { payrollPeriodId: id } });
  return row;
}

export async function createPayrollPeriod(
  repository: HrRepository,
  ctx: HrServiceContext,
  data: PayrollPeriodCreateData,
): Promise<PayrollPeriodRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.payrollPeriodManage);

  const schedule = await repository.payrollSchedules.findById(
    ctx.organizationId,
    data.payrollScheduleId,
  );
  if (!schedule) {
    throw new HrError("NOT_FOUND", {
      details: { payrollScheduleId: data.payrollScheduleId },
    });
  }

  const periodStart = toDateOnly(data.periodStart);
  const periodEnd = toDateOnly(data.periodEnd);
  assertPeriodRange(periodStart, periodEnd);

  const existing = await repository.payrollPeriods.findByRange({
    organizationId: ctx.organizationId,
    payrollScheduleId: schedule.id,
    periodStart,
    periodEnd,
  });
  if (existing) {
    throw new HrError("DUPLICATE_PERIOD", {
      details: { periodStart, periodEnd },
    });
  }

  const paymentDate = data.paymentDate
    ? toDateOnly(data.paymentDate)
    : computePaymentDate(
        parsePaymentDayRule(schedule.paymentDayRule),
        periodEnd,
      );

  const status = await requireMasterByCode(
    repository,
    "payrollPeriodStatus",
    data.statusCode ?? "DRAFT",
  );

  const created = await repository.payrollPeriods.create({
    organizationId: ctx.organizationId,
    payrollScheduleId: schedule.id,
    periodStart,
    periodEnd,
    paymentDate,
    statusId: status.id,
    lockedAt: null,
    lockedBy: null,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.payrollPeriodCreate,
    entityType: "payroll_period",
    entityId: created.id,
    after: created,
  });

  return created;
}

/**
 * Materialize every period a schedule produces for one month. Already-existing
 * ranges are skipped so the generator stays safe to re-run.
 */
export async function generatePayrollPeriods(
  repository: HrRepository,
  ctx: HrServiceContext,
  data: PayrollPeriodGenerateData,
): Promise<{ created: PayrollPeriodRecord[]; skipped: number }> {
  assertHrPermission(ctx, HR_PERMISSIONS.payrollPeriodManage);

  const schedule = await repository.payrollSchedules.findById(
    ctx.organizationId,
    data.payrollScheduleId,
  );
  if (!schedule) {
    throw new HrError("NOT_FOUND", {
      details: { payrollScheduleId: data.payrollScheduleId },
    });
  }

  const frequency = await repository.masters.findById(
    "payFrequency",
    schedule.payFrequencyId,
  );
  if (!frequency) {
    throw new HrError("NOT_FOUND", {
      details: { payFrequencyId: schedule.payFrequencyId },
    });
  }

  const candidates = generatePeriods({
    frequencyCode: frequency.code,
    year: data.year,
    month: data.month,
    paymentDayRule: schedule.paymentDayRule,
  });

  const created: PayrollPeriodRecord[] = [];
  let skipped = 0;

  for (const candidate of candidates) {
    const existing = await repository.payrollPeriods.findByRange({
      organizationId: ctx.organizationId,
      payrollScheduleId: schedule.id,
      periodStart: candidate.periodStart,
      periodEnd: candidate.periodEnd,
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    created.push(
      await createPayrollPeriod(repository, ctx, {
        payrollScheduleId: schedule.id,
        periodStart: candidate.periodStart,
        periodEnd: candidate.periodEnd,
        paymentDate: candidate.paymentDate,
      }),
    );
  }

  return { created, skipped };
}

export async function updatePayrollPeriodStatus(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
  targetStatusCode: string,
): Promise<PayrollPeriodRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.payrollPeriodManage);

  const before = await repository.payrollPeriods.findById(
    ctx.organizationId,
    id,
  );
  if (!before) {
    throw new HrError("NOT_FOUND", { details: { payrollPeriodId: id } });
  }

  const fromCode = await statusCodeOf(repository, before.statusId);
  const target = await requireMasterByCode(
    repository,
    "payrollPeriodStatus",
    targetStatusCode.trim().toUpperCase(),
  );

  assertPayrollStatusTransition(fromCode, target.code);

  const locking = target.code === "LOCKED";
  const after = await repository.payrollPeriods.update(id, {
    statusId: target.id,
    lockedAt: locking ? new Date() : null,
    lockedBy: locking ? ctx.actorAuthUserId : null,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.payrollPeriodStatusChange,
    entityType: "payroll_period",
    entityId: after.id,
    before: { statusCode: fromCode },
    after: { statusCode: target.code },
  });

  return after;
}

/** The period an operator is currently working in, if any. */
export async function findCurrentOpenPeriod(
  repository: HrRepository,
  organizationId: string,
): Promise<PayrollPeriodRecord | null> {
  const statusIds = await statusIdsForCodes(
    repository,
    OPEN_PERIOD_STATUS_CODES,
  );
  const result = await repository.payrollPeriods.list({
    organizationId,
    statusIds,
    skip: 0,
    take: 1,
  });
  return result.rows[0] ?? null;
}
