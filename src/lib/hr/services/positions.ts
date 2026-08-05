/** Position CRUD. Positions are never deleted, only deactivated. */
import { assertHrPermission } from "@/lib/hr/authorize";
import { HR_AUDIT_ACTIONS, writeHrAudit } from "@/lib/hr/audit";
import { nextPositionCode } from "@/lib/hr/business-codes";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { HrRepository, PositionRecord } from "@/lib/hr/repository/types";
import {
  normalizeCode,
  normalizePagination,
  optionalText,
  requireText,
  resolveBranchScope,
  resolveDisplayNamePair,
  toPagedResponse,
  type HrServiceContext,
  type PagedResponse,
  type PageRequest,
} from "@/lib/hr/services/shared";

export type PositionListInput = PageRequest & {
  search?: string | null;
  departmentId?: string | null;
  isActive?: boolean | null;
};

export type PositionCreateData = {
  code?: string | null;
  nameTh: string;
  nameEn?: string | null;
  departmentId?: string | null;
  description?: string | null;
  scope?: "ORGANIZATION" | "BRANCH";
  branchId?: string | null;
  defaultRoleId?: string | null;
};

export type PositionUpdateData = Partial<Omit<PositionCreateData, "code">> & {
  isActive?: boolean;
};

export function assertPositionVisibleInContext(
  ctx: HrServiceContext,
  position: PositionRecord,
): void {
  if (position.isSystemStandard && position.organizationId === null && !position.branchId) {
    return;
  }
  if (position.organizationId !== ctx.organizationId) {
    throw new HrError("NOT_FOUND");
  }
  if (!position.branchId) return;
  if (ctx.branchId && position.branchId !== ctx.branchId) {
    throw new HrError("BRANCH_OUT_OF_SCOPE");
  }
  if (ctx.allowedBranchIds != null && !ctx.allowedBranchIds.includes(position.branchId)) {
    throw new HrError("BRANCH_OUT_OF_SCOPE");
  }
}

async function assertDepartmentUsable(
  repository: HrRepository,
  ctx: HrServiceContext,
  departmentId: string,
): Promise<void> {
  const department = await repository.departments.findById(
    ctx.organizationId,
    departmentId,
  );
  if (!department) {
    throw new HrError("NOT_FOUND", { details: { departmentId } });
  }
  if (!department.isActive) {
    throw new HrError("INACTIVE_ENTITY", { details: { departmentId } });
  }
}

export async function listPositions(
  repository: HrRepository,
  ctx: HrServiceContext,
  input: PositionListInput = {},
): Promise<PagedResponse<PositionRecord>> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.positionManage,
    HR_PERMISSIONS.employeeRead,
  ]);
  const pagination = normalizePagination(input);
  const scope = resolveBranchScope(ctx, ctx.branchId);
  const result = await repository.positions.list({
    organizationId: ctx.organizationId,
    departmentId: input.departmentId ?? null,
    isActive: input.isActive ?? null,
    search: input.search ?? null,
    branchId: scope.branchId,
    branchIds: scope.branchIds,
    skip: pagination.skip,
    take: pagination.take,
  });
  return toPagedResponse(result, pagination);
}

export async function getPosition(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
): Promise<PositionRecord> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.positionManage,
    HR_PERMISSIONS.employeeRead,
  ]);
  const row = await repository.positions.findById(ctx.organizationId, id);
  if (!row) throw new HrError("NOT_FOUND", { details: { positionId: id } });
  assertPositionVisibleInContext(ctx, row);
  return row;
}

export async function createPosition(
  repository: HrRepository,
  ctx: HrServiceContext,
  data: PositionCreateData,
): Promise<PositionRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.positionManage);

  const code = data.code?.trim()
    ? normalizeCode(data.code, "รหัสตำแหน่ง")
    : await nextPositionCode(repository, ctx.organizationId);
  const duplicate = await repository.positions.findByCode(
    ctx.organizationId,
    code,
  );
  if (duplicate) throw new HrError("DUPLICATE_CODE", { details: { code } });

  if (data.departmentId) {
    await assertDepartmentUsable(repository, ctx, data.departmentId);
  }

  const names = resolveDisplayNamePair(data.nameTh, data.nameEn, "ชื่อตำแหน่ง");
  const branchId = data.scope === "BRANCH" ? (data.branchId ?? ctx.branchId) : null;
  if (data.scope === "BRANCH" && !branchId) {
    throw new HrError("VALIDATION_ERROR", { message: "กรุณาเลือกสาขาสำหรับตำแหน่งระดับสาขา", details: { branchId } });
  }
  if (branchId && ctx.branchId && branchId !== ctx.branchId) {
    throw new HrError("BRANCH_OUT_OF_SCOPE", { details: { branchId } });
  }
  if (branchId && ctx.allowedBranchIds != null && !ctx.allowedBranchIds.includes(branchId)) {
    throw new HrError("BRANCH_OUT_OF_SCOPE", { details: { branchId } });
  }
  const sameName = await repository.positions.list({ organizationId: ctx.organizationId, branchId, search: names.nameTh, skip: 0, take: 50 });
  if (sameName.rows.some((row) => !row.isSystemStandard && row.nameTh.trim().toLocaleLowerCase("th") === names.nameTh.trim().toLocaleLowerCase("th") && (row.branchId ?? null) === branchId)) {
    throw new HrError("DUPLICATE_CODE", { message: "มีชื่อตำแหน่งนี้แล้วในขอบเขตที่เลือก" });
  }
  const created = await repository.positions.create({
    organizationId: ctx.organizationId,
    departmentId: data.departmentId ?? null,
    code,
    nameTh: names.nameTh,
    nameEn: names.nameEn,
    description: optionalText(data.description),
    branchId,
    immutableCode: null,
    isSystemStandard: false,
    defaultRoleId: data.defaultRoleId ?? null,
    isActive: true,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.positionCreate,
    entityType: "position",
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updatePosition(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
  data: PositionUpdateData,
): Promise<PositionRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.positionManage);

  const before = await repository.positions.findById(ctx.organizationId, id);
  if (!before) throw new HrError("NOT_FOUND", { details: { positionId: id } });
  assertPositionVisibleInContext(ctx, before);
  if (before.isSystemStandard) throw new HrError("FORBIDDEN", { details: { reason: "ตำแหน่งมาตรฐานแก้ไขได้จากส่วนกลางเท่านั้น" } });

  if (data.departmentId) {
    await assertDepartmentUsable(repository, ctx, data.departmentId);
  }
  const requestedBranchId = data.scope === "BRANCH" ? (data.branchId ?? ctx.branchId) : null;
  if (data.scope === "BRANCH" && !requestedBranchId) {
    throw new HrError("VALIDATION_ERROR", { message: "กรุณาเลือกสาขาสำหรับตำแหน่งระดับสาขา" });
  }
  if (requestedBranchId && ctx.branchId && requestedBranchId !== ctx.branchId) {
    throw new HrError("BRANCH_OUT_OF_SCOPE", { details: { branchId: requestedBranchId } });
  }
  if (requestedBranchId && ctx.allowedBranchIds != null && !ctx.allowedBranchIds.includes(requestedBranchId)) {
    throw new HrError("BRANCH_OUT_OF_SCOPE", { details: { branchId: requestedBranchId } });
  }

  const after = await repository.positions.update(id, {
    ...(data.departmentId === undefined
      ? {}
      : { departmentId: data.departmentId ?? null }),
    ...(data.nameTh === undefined
      ? data.nameEn === undefined
        ? {}
        : {
            nameEn: requireText(data.nameEn, "ชื่อตำแหน่ง", 200),
          }
      : resolveDisplayNamePair(data.nameTh, data.nameEn, "ชื่อตำแหน่ง")),
    ...(data.description === undefined
      ? {}
      : { description: optionalText(data.description) }),
    ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
    ...(data.scope === undefined ? {} : { branchId: requestedBranchId }),
    ...(data.defaultRoleId === undefined ? {} : { defaultRoleId: data.defaultRoleId ?? null }),
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.positionUpdate,
    entityType: "position",
    entityId: after.id,
    before,
    after,
  });

  return after;
}

export async function deactivatePosition(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
): Promise<PositionRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.positionManage);

  const before = await repository.positions.findById(ctx.organizationId, id);
  if (!before) throw new HrError("NOT_FOUND", { details: { positionId: id } });
  assertPositionVisibleInContext(ctx, before);
  if (before.isSystemStandard) throw new HrError("FORBIDDEN", { details: { reason: "ตำแหน่งมาตรฐานไม่สามารถปิดใช้งานโดยองค์กรได้" } });

  const after = await repository.positions.update(id, { isActive: false });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.positionDeactivate,
    entityType: "position",
    entityId: after.id,
    before,
    after,
  });

  return after;
}
