/**
 * Baseline overtime rule service.
 *
 * A rule is the organization-level multiplier (and optional fixed top-up) paid
 * for one overtime rate type. Rules are never deleted — payroll runs that
 * already referenced them must stay explainable — so retirement is a
 * deactivation.
 */
import { assertHrPermission } from "@/lib/hr/authorize";
import { HR_AUDIT_ACTIONS, writeHrAudit } from "@/lib/hr/audit";
import { HrError } from "@/lib/hr/errors";
import { toDateOnly } from "@/lib/hr/payroll-rules";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type {
  HrRepository,
  OvertimeRuleRecord,
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

/**
 * Reading a rule is useful to anyone who configures pay or rosters, so the
 * read side accepts any of the three managing codes. Writing stays with the
 * settings administrator.
 */
const READ_PERMISSIONS = [
  HR_PERMISSIONS.settingsManage,
  HR_PERMISSIONS.compensationManage,
  HR_PERMISSIONS.shiftManage,
] as const;

export type OvertimeRuleListInput = PageRequest & {
  search?: string | null;
  rateTypeId?: string | null;
  isActive?: boolean | null;
};

export type OvertimeRuleCreateData = {
  code: string;
  name: string;
  rateTypeId: string;
  multiplier: number;
  fixedAmount?: number | null;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null;
};

export type OvertimeRuleUpdateData = Partial<
  Omit<OvertimeRuleCreateData, "code">
> & {
  isActive?: boolean;
};

function normalizeMultiplier(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ตัวคูณค่าล่วงเวลาต้องมากกว่า 0",
      details: { multiplier: raw },
    });
  }
  return raw;
}

function normalizeFixedAmount(
  raw: number | null | undefined,
): number | null {
  if (raw == null) return null;
  if (!Number.isFinite(raw)) {
    throw new HrError("VALIDATION_ERROR", {
      message: "จำนวนเงินคงที่ไม่ถูกต้อง",
      details: { fixedAmount: raw },
    });
  }
  if (raw < 0) {
    throw new HrError("NEGATIVE_AMOUNT", { details: { fixedAmount: raw } });
  }
  return raw;
}

function assertEffectiveRange(from: Date, to: Date | null): void {
  if (to && to.getTime() < from.getTime()) {
    throw new HrError("VALIDATION_ERROR", {
      message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มมีผล",
    });
  }
}

export async function listOvertimeRules(
  repository: HrRepository,
  ctx: HrServiceContext,
  input: OvertimeRuleListInput = {},
): Promise<PagedResponse<OvertimeRuleRecord>> {
  assertHrPermission(ctx, READ_PERMISSIONS);
  const pagination = normalizePagination(input);

  const result = await repository.overtimeRules.list({
    organizationId: ctx.organizationId,
    rateTypeId: input.rateTypeId ?? null,
    isActive: input.isActive ?? null,
    search: input.search ?? null,
    skip: pagination.skip,
    take: pagination.take,
  });

  return toPagedResponse(result, pagination);
}

export async function getOvertimeRule(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
): Promise<OvertimeRuleRecord> {
  assertHrPermission(ctx, READ_PERMISSIONS);
  const row = await repository.overtimeRules.findById(ctx.organizationId, id);
  if (!row) throw new HrError("NOT_FOUND", { details: { overtimeRuleId: id } });
  return row;
}

export async function createOvertimeRule(
  repository: HrRepository,
  ctx: HrServiceContext,
  data: OvertimeRuleCreateData,
): Promise<OvertimeRuleRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.settingsManage);

  const code = normalizeCode(data.code, "รหัสกฎ OT");
  const duplicate = await repository.overtimeRules.findByCode(
    ctx.organizationId,
    code,
  );
  if (duplicate) throw new HrError("DUPLICATE_CODE", { details: { code } });

  // A retired rate type must never back a new rule.
  await requireActiveMaster(repository, "overtimeRateType", data.rateTypeId);

  const effectiveFrom = toDateOnly(data.effectiveFrom);
  const effectiveTo = data.effectiveTo ? toDateOnly(data.effectiveTo) : null;
  assertEffectiveRange(effectiveFrom, effectiveTo);

  const created = await repository.overtimeRules.create({
    organizationId: ctx.organizationId,
    code,
    name: requireText(data.name, "ชื่อกฎ OT", 200),
    rateTypeId: data.rateTypeId,
    multiplier: normalizeMultiplier(data.multiplier),
    fixedAmount: normalizeFixedAmount(data.fixedAmount),
    effectiveFrom,
    effectiveTo,
    isActive: true,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.overtimeRuleCreate,
    entityType: "overtime_rule",
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updateOvertimeRule(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
  data: OvertimeRuleUpdateData,
): Promise<OvertimeRuleRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.settingsManage);

  const before = await repository.overtimeRules.findById(ctx.organizationId, id);
  if (!before) {
    throw new HrError("NOT_FOUND", { details: { overtimeRuleId: id } });
  }

  const patch: Parameters<HrRepository["overtimeRules"]["update"]>[1] = {};

  if (data.rateTypeId !== undefined) {
    await requireActiveMaster(repository, "overtimeRateType", data.rateTypeId);
    patch.rateTypeId = data.rateTypeId;
  }
  if (data.name !== undefined) {
    patch.name = requireText(data.name, "ชื่อกฎ OT", 200);
  }
  if (data.multiplier !== undefined) {
    patch.multiplier = normalizeMultiplier(data.multiplier);
  }
  if (data.fixedAmount !== undefined) {
    patch.fixedAmount = normalizeFixedAmount(data.fixedAmount);
  }
  if (data.effectiveFrom !== undefined) {
    patch.effectiveFrom = toDateOnly(data.effectiveFrom);
  }
  if (data.effectiveTo !== undefined) {
    patch.effectiveTo = data.effectiveTo ? toDateOnly(data.effectiveTo) : null;
  }
  if (data.isActive !== undefined) {
    patch.isActive = data.isActive;
  }

  assertEffectiveRange(
    patch.effectiveFrom ?? before.effectiveFrom,
    patch.effectiveTo === undefined ? before.effectiveTo : patch.effectiveTo,
  );

  const after = await repository.overtimeRules.update(id, patch);

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode:
      data.isActive === false
        ? HR_AUDIT_ACTIONS.overtimeRuleDeactivate
        : HR_AUDIT_ACTIONS.overtimeRuleUpdate,
    entityType: "overtime_rule",
    entityId: after.id,
    before,
    after,
  });

  return after;
}

export async function deactivateOvertimeRule(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
): Promise<OvertimeRuleRecord> {
  return updateOvertimeRule(repository, ctx, id, { isActive: false });
}
