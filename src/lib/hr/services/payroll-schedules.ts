/** Payroll schedule CRUD — the rules that later generate payroll periods. */
import { assertHrPermission } from "@/lib/hr/authorize";
import { HR_AUDIT_ACTIONS, writeHrAudit } from "@/lib/hr/audit";
import { nextPayrollScheduleCode } from "@/lib/hr/business-codes";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { parsePaymentDayRule } from "@/lib/hr/payroll-rules";
import type {
  HrRepository,
  PayrollScheduleRecord,
} from "@/lib/hr/repository/types";
import {
  normalizeCode,
  normalizePagination,
  requireActiveMaster,
  requireText,
  toPagedResponse,
  type HrServiceContext,
  type PagedResponse,
  type PageRequest,
} from "@/lib/hr/services/shared";

export type PayrollScheduleListInput = PageRequest & {
  isActive?: boolean | null;
};

export type PayrollScheduleCreateData = {
  code?: string | null;
  name: string;
  payFrequencyId: string;
  periodStartRule: string;
  periodEndRule: string;
  paymentDayRule: string;
  timezone?: string;
};

export type PayrollScheduleUpdateData = Partial<
  Omit<PayrollScheduleCreateData, "code">
> & { isActive?: boolean };

export async function listPayrollSchedules(
  repository: HrRepository,
  ctx: HrServiceContext,
  input: PayrollScheduleListInput = {},
): Promise<PagedResponse<PayrollScheduleRecord>> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.payrollScheduleRead,
    HR_PERMISSIONS.payrollScheduleManage,
  ]);
  const pagination = normalizePagination(input);
  const result = await repository.payrollSchedules.list({
    organizationId: ctx.organizationId,
    isActive: input.isActive ?? null,
    skip: pagination.skip,
    take: pagination.take,
  });
  return toPagedResponse(result, pagination);
}

export async function getPayrollSchedule(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
): Promise<PayrollScheduleRecord> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.payrollScheduleRead,
    HR_PERMISSIONS.payrollScheduleManage,
  ]);
  const row = await repository.payrollSchedules.findById(ctx.organizationId, id);
  if (!row) throw new HrError("NOT_FOUND", { details: { payrollScheduleId: id } });
  return row;
}

export async function createPayrollSchedule(
  repository: HrRepository,
  ctx: HrServiceContext,
  data: PayrollScheduleCreateData,
): Promise<PayrollScheduleRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.payrollScheduleManage);

  const code = data.code?.trim()
    ? normalizeCode(data.code, "รหัสรอบจ่าย")
    : await nextPayrollScheduleCode(repository, ctx.organizationId);
  const duplicate = await repository.payrollSchedules.findByCode(
    ctx.organizationId,
    code,
  );
  if (duplicate) throw new HrError("DUPLICATE_CODE", { details: { code } });

  await requireActiveMaster(repository, "payFrequency", data.payFrequencyId);
  parsePaymentDayRule(data.paymentDayRule);

  const created = await repository.payrollSchedules.create({
    organizationId: ctx.organizationId,
    code,
    name: requireText(data.name, "ชื่อรอบจ่าย", 200),
    payFrequencyId: data.payFrequencyId,
    periodStartRule: requireText(data.periodStartRule, "กติกาวันเริ่มงวด", 100),
    periodEndRule: requireText(data.periodEndRule, "กติกาวันสิ้นสุดงวด", 100),
    paymentDayRule: data.paymentDayRule.trim().toUpperCase(),
    timezone: data.timezone?.trim() || "Asia/Bangkok",
    isActive: true,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.payrollScheduleCreate,
    entityType: "payroll_schedule",
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updatePayrollSchedule(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
  data: PayrollScheduleUpdateData,
): Promise<PayrollScheduleRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.payrollScheduleManage);

  const before = await repository.payrollSchedules.findById(
    ctx.organizationId,
    id,
  );
  if (!before) {
    throw new HrError("NOT_FOUND", { details: { payrollScheduleId: id } });
  }

  if (data.payFrequencyId !== undefined) {
    await requireActiveMaster(repository, "payFrequency", data.payFrequencyId);
  }
  if (data.paymentDayRule !== undefined) {
    parsePaymentDayRule(data.paymentDayRule);
  }

  const after = await repository.payrollSchedules.update(id, {
    ...(data.name === undefined
      ? {}
      : { name: requireText(data.name, "ชื่อรอบจ่าย", 200) }),
    ...(data.payFrequencyId === undefined
      ? {}
      : { payFrequencyId: data.payFrequencyId }),
    ...(data.periodStartRule === undefined
      ? {}
      : {
          periodStartRule: requireText(
            data.periodStartRule,
            "กติกาวันเริ่มงวด",
            100,
          ),
        }),
    ...(data.periodEndRule === undefined
      ? {}
      : {
          periodEndRule: requireText(
            data.periodEndRule,
            "กติกาวันสิ้นสุดงวด",
            100,
          ),
        }),
    ...(data.paymentDayRule === undefined
      ? {}
      : { paymentDayRule: data.paymentDayRule.trim().toUpperCase() }),
    ...(data.timezone === undefined ? {} : { timezone: data.timezone.trim() }),
    ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.payrollScheduleUpdate,
    entityType: "payroll_schedule",
    entityId: after.id,
    before,
    after,
  });

  return after;
}
