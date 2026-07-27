/**
 * Shift template service.
 *
 * Derived timing values (span, standard work minutes, midnight crossing) are
 * always recomputed from start/end/break so a client can never post an
 * inconsistent shift, and a deactivated shift type can never back a new shift.
 */
import { assertBranchInScope, assertHrPermission } from "@/lib/hr/authorize";
import { HR_AUDIT_ACTIONS, writeHrAudit } from "@/lib/hr/audit";
import { nextShiftCode } from "@/lib/hr/business-codes";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { HrRepository, ShiftRecord } from "@/lib/hr/repository/types";
import {
  formatMinutesAsTime,
  resolveShiftTiming,
  type TimeInput,
} from "@/lib/hr/shift-math";
import {
  normalizeCode,
  normalizePagination,
  requireActiveMaster,
  requireText,
  resolveBranchScope,
  toPagedResponse,
  type HrServiceContext,
  type PagedResponse,
  type PageRequest,
} from "@/lib/hr/services/shared";

export type ShiftListInput = PageRequest & {
  search?: string | null;
  branchId?: string | null;
  isActive?: boolean | null;
};

export type ShiftCreateData = {
  code?: string | null;
  name: string;
  shiftTypeId: string;
  startTime: TimeInput;
  endTime: TimeInput;
  branchId?: string | null;
  breakMinutes?: number;
  graceLateMinutes?: number;
  graceEarlyLeaveMinutes?: number;
  crossesMidnight?: boolean;
  overtimeAfterMinutes?: number | null;
};

export type ShiftUpdateData = Partial<Omit<ShiftCreateData, "code">> & {
  isActive?: boolean;
};

export type ShiftView = ShiftRecord & {
  startTime: string;
  endTime: string;
};

export function toShiftView(shift: ShiftRecord): ShiftView {
  return {
    ...shift,
    startTime: formatMinutesAsTime(shift.startMinutes),
    endTime: formatMinutesAsTime(shift.endMinutes),
  };
}

export async function listShifts(
  repository: HrRepository,
  ctx: HrServiceContext,
  input: ShiftListInput = {},
): Promise<PagedResponse<ShiftView>> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.shiftRead,
    HR_PERMISSIONS.shiftManage,
  ]);
  const pagination = normalizePagination(input);
  const scope = resolveBranchScope(ctx, input.branchId);

  const result = await repository.shifts.list({
    organizationId: ctx.organizationId,
    branchIds: scope.branchId ? [scope.branchId] : scope.branchIds,
    isActive: input.isActive ?? null,
    search: input.search ?? null,
    skip: pagination.skip,
    take: pagination.take,
  });

  return toPagedResponse(
    { rows: result.rows.map(toShiftView), total: result.total },
    pagination,
  );
}

export async function getShift(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
): Promise<ShiftView> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.shiftRead,
    HR_PERMISSIONS.shiftManage,
  ]);
  const row = await repository.shifts.findById(ctx.organizationId, id);
  if (!row) throw new HrError("NOT_FOUND", { details: { shiftId: id } });
  return toShiftView(row);
}

export async function createShift(
  repository: HrRepository,
  ctx: HrServiceContext,
  data: ShiftCreateData,
): Promise<ShiftView> {
  assertHrPermission(ctx, HR_PERMISSIONS.shiftManage);

  const code = data.code?.trim()
    ? normalizeCode(data.code, "รหัสกะ")
    : await nextShiftCode(repository, ctx.organizationId);
  const duplicate = await repository.shifts.findByCode(ctx.organizationId, code);
  if (duplicate) throw new HrError("DUPLICATE_CODE", { details: { code } });

  if (data.branchId) assertBranchInScope(ctx, data.branchId);

  // A retired shift type must not become the basis of new rostering.
  await requireActiveMaster(repository, "shiftType", data.shiftTypeId);

  const timing = resolveShiftTiming(data);

  const created = await repository.shifts.create({
    organizationId: ctx.organizationId,
    branchId: data.branchId ?? null,
    code,
    name: requireText(data.name, "ชื่อกะ", 200),
    shiftTypeId: data.shiftTypeId,
    startMinutes: timing.startMinutes,
    endMinutes: timing.endMinutes,
    breakMinutes: timing.breakMinutes,
    graceLateMinutes: data.graceLateMinutes ?? 0,
    graceEarlyLeaveMinutes: data.graceEarlyLeaveMinutes ?? 0,
    crossesMidnight: timing.crossesMidnight,
    standardWorkMinutes: timing.standardWorkMinutes,
    overtimeAfterMinutes: data.overtimeAfterMinutes ?? null,
    isActive: true,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: created.branchId ?? ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.shiftCreate,
    entityType: "shift",
    entityId: created.id,
    after: created,
  });

  return toShiftView(created);
}

export async function updateShift(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
  data: ShiftUpdateData,
): Promise<ShiftView> {
  assertHrPermission(ctx, HR_PERMISSIONS.shiftManage);

  const before = await repository.shifts.findById(ctx.organizationId, id);
  if (!before) throw new HrError("NOT_FOUND", { details: { shiftId: id } });

  if (data.branchId) assertBranchInScope(ctx, data.branchId);

  const patch: Parameters<HrRepository["shifts"]["update"]>[1] = {};

  if (data.shiftTypeId !== undefined) {
    await requireActiveMaster(repository, "shiftType", data.shiftTypeId);
    patch.shiftTypeId = data.shiftTypeId;
  }
  if (data.name !== undefined) {
    patch.name = requireText(data.name, "ชื่อกะ", 200);
  }
  if (data.branchId !== undefined) {
    patch.branchId = data.branchId ?? null;
  }
  if (data.graceLateMinutes !== undefined) {
    patch.graceLateMinutes = data.graceLateMinutes;
  }
  if (data.graceEarlyLeaveMinutes !== undefined) {
    patch.graceEarlyLeaveMinutes = data.graceEarlyLeaveMinutes;
  }
  if (data.overtimeAfterMinutes !== undefined) {
    patch.overtimeAfterMinutes = data.overtimeAfterMinutes;
  }
  if (data.isActive !== undefined) {
    patch.isActive = data.isActive;
  }

  const timingTouched =
    data.startTime !== undefined ||
    data.endTime !== undefined ||
    data.breakMinutes !== undefined ||
    data.crossesMidnight !== undefined;

  if (timingTouched) {
    const timing = resolveShiftTiming({
      startTime:
        data.startTime ?? formatMinutesAsTime(before.startMinutes),
      endTime: data.endTime ?? formatMinutesAsTime(before.endMinutes),
      breakMinutes: data.breakMinutes ?? before.breakMinutes,
      crossesMidnight: data.crossesMidnight,
      graceLateMinutes: data.graceLateMinutes,
      graceEarlyLeaveMinutes: data.graceEarlyLeaveMinutes,
      overtimeAfterMinutes: data.overtimeAfterMinutes,
    });
    patch.startMinutes = timing.startMinutes;
    patch.endMinutes = timing.endMinutes;
    patch.breakMinutes = timing.breakMinutes;
    patch.crossesMidnight = timing.crossesMidnight;
    patch.standardWorkMinutes = timing.standardWorkMinutes;
  }

  const after = await repository.shifts.update(id, patch);

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: after.branchId ?? ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode:
      data.isActive === false
        ? HR_AUDIT_ACTIONS.shiftDeactivate
        : HR_AUDIT_ACTIONS.shiftUpdate,
    entityType: "shift",
    entityId: after.id,
    before,
    after,
  });

  return toShiftView(after);
}

export async function deactivateShift(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
): Promise<ShiftView> {
  return updateShift(repository, ctx, id, { isActive: false });
}

/**
 * Re-enabling a shift is only allowed while its shift type is still active,
 * otherwise a retired type would come back into use through the side door.
 */
export async function activateShift(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
): Promise<ShiftView> {
  assertHrPermission(ctx, HR_PERMISSIONS.shiftManage);

  const before = await repository.shifts.findById(ctx.organizationId, id);
  if (!before) throw new HrError("NOT_FOUND", { details: { shiftId: id } });

  await requireActiveMaster(repository, "shiftType", before.shiftTypeId);

  const after = await repository.shifts.update(id, { isActive: true });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: after.branchId ?? ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.shiftUpdate,
    entityType: "shift",
    entityId: after.id,
    before,
    after,
  });

  return toShiftView(after);
}
