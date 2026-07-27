/** Department CRUD. Departments are never deleted, only deactivated. */
import { assertHrPermission } from "@/lib/hr/authorize";
import { HR_AUDIT_ACTIONS, writeHrAudit } from "@/lib/hr/audit";
import { nextDepartmentCode } from "@/lib/hr/business-codes";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { DepartmentRecord, HrRepository } from "@/lib/hr/repository/types";
import {
  normalizeCode,
  normalizePagination,
  optionalText,
  requireText,
  resolveDisplayNamePair,
  toPagedResponse,
  type HrServiceContext,
  type PagedResponse,
  type PageRequest,
} from "@/lib/hr/services/shared";

export type DepartmentListInput = PageRequest & {
  search?: string | null;
  isActive?: boolean | null;
};

export type DepartmentCreateData = {
  code?: string | null;
  nameTh: string;
  nameEn?: string | null;
  description?: string | null;
};

export type DepartmentUpdateData = Partial<Omit<DepartmentCreateData, "code">> & {
  isActive?: boolean;
};

export async function listDepartments(
  repository: HrRepository,
  ctx: HrServiceContext,
  input: DepartmentListInput = {},
): Promise<PagedResponse<DepartmentRecord>> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.departmentManage,
    HR_PERMISSIONS.employeeRead,
  ]);
  const pagination = normalizePagination(input);
  const result = await repository.departments.list({
    organizationId: ctx.organizationId,
    isActive: input.isActive ?? null,
    search: input.search ?? null,
    skip: pagination.skip,
    take: pagination.take,
  });
  return toPagedResponse(result, pagination);
}

export async function getDepartment(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
): Promise<DepartmentRecord> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.departmentManage,
    HR_PERMISSIONS.employeeRead,
  ]);
  const row = await repository.departments.findById(ctx.organizationId, id);
  if (!row) throw new HrError("NOT_FOUND", { details: { departmentId: id } });
  return row;
}

export async function createDepartment(
  repository: HrRepository,
  ctx: HrServiceContext,
  data: DepartmentCreateData,
): Promise<DepartmentRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.departmentManage);

  const code = data.code?.trim()
    ? normalizeCode(data.code, "รหัสแผนก")
    : await nextDepartmentCode(repository, ctx.organizationId);
  const duplicate = await repository.departments.findByCode(
    ctx.organizationId,
    code,
  );
  if (duplicate) throw new HrError("DUPLICATE_CODE", { details: { code } });

  const names = resolveDisplayNamePair(data.nameTh, data.nameEn, "ชื่อแผนก");
  const created = await repository.departments.create({
    organizationId: ctx.organizationId,
    code,
    nameTh: names.nameTh,
    nameEn: names.nameEn,
    description: optionalText(data.description),
    isActive: true,
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.departmentCreate,
    entityType: "department",
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updateDepartment(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
  data: DepartmentUpdateData,
): Promise<DepartmentRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.departmentManage);

  const before = await repository.departments.findById(ctx.organizationId, id);
  if (!before) throw new HrError("NOT_FOUND", { details: { departmentId: id } });

  const after = await repository.departments.update(id, {
    ...(data.nameTh === undefined
      ? data.nameEn === undefined
        ? {}
        : {
            nameEn: requireText(data.nameEn, "ชื่อแผนก", 200),
          }
      : resolveDisplayNamePair(data.nameTh, data.nameEn, "ชื่อแผนก")),
    ...(data.description === undefined
      ? {}
      : { description: optionalText(data.description) }),
    ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
  });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.departmentUpdate,
    entityType: "department",
    entityId: after.id,
    before,
    after,
  });

  return after;
}

export async function deactivateDepartment(
  repository: HrRepository,
  ctx: HrServiceContext,
  id: string,
): Promise<DepartmentRecord> {
  assertHrPermission(ctx, HR_PERMISSIONS.departmentManage);

  const before = await repository.departments.findById(ctx.organizationId, id);
  if (!before) throw new HrError("NOT_FOUND", { details: { departmentId: id } });

  const after = await repository.departments.update(id, { isActive: false });

  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.departmentDeactivate,
    entityType: "department",
    entityId: after.id,
    before,
    after,
  });

  return after;
}
