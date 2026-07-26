/** Position CRUD. Positions are never deleted, only deactivated. */
import { assertHrPermission } from "@/lib/hr/authorize";
import { HR_AUDIT_ACTIONS, writeHrAudit } from "@/lib/hr/audit";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { HrRepository, PositionRecord } from "@/lib/hr/repository/types";
import {
  normalizeCode,
  normalizePagination,
  optionalText,
  requireText,
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
  code: string;
  nameTh: string;
  nameEn: string;
  departmentId?: string | null;
  description?: string | null;
};

export type PositionUpdateData = Partial<Omit<PositionCreateData, "code">> & {
  isActive?: boolean;
};

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
  const result = await repository.positions.list({
    organizationId: ctx.organizationId,
    departmentId: input.departmentId ?? null,
    isActive: input.isActive ?? null,
    search: input.search ?? null,
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
  return row;
}

export async function createPosition(
  repository: HrRepository,
  ctx: HrServiceContext,
  data: PositionCreateData,
): Promise<PositionRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.positionManage);

  const code = normalizeCode(data.code, "รหัสตำแหน่ง");
  const duplicate = await repository.positions.findByCode(
    ctx.organizationId,
    code,
  );
  if (duplicate) throw new HrError("DUPLICATE_CODE", { details: { code } });

  if (data.departmentId) {
    await assertDepartmentUsable(repository, ctx, data.departmentId);
  }

  const created = await repository.positions.create({
    organizationId: ctx.organizationId,
    departmentId: data.departmentId ?? null,
    code,
    nameTh: requireText(data.nameTh, "ชื่อตำแหน่ง (ไทย)", 200),
    nameEn: requireText(data.nameEn, "ชื่อตำแหน่ง (อังกฤษ)", 200),
    description: optionalText(data.description),
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

  if (data.departmentId) {
    await assertDepartmentUsable(repository, ctx, data.departmentId);
  }

  const after = await repository.positions.update(id, {
    ...(data.departmentId === undefined
      ? {}
      : { departmentId: data.departmentId ?? null }),
    ...(data.nameTh === undefined
      ? {}
      : { nameTh: requireText(data.nameTh, "ชื่อตำแหน่ง (ไทย)", 200) }),
    ...(data.nameEn === undefined
      ? {}
      : { nameEn: requireText(data.nameEn, "ชื่อตำแหน่ง (อังกฤษ)", 200) }),
    ...(data.description === undefined
      ? {}
      : { description: optionalText(data.description) }),
    ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
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
