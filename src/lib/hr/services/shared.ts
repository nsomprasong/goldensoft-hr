/**
 * Cross-service primitives: the service context, pagination, code normalization
 * and master-data lookups that must fail closed on inactive rows.
 */
import type { HrAccessContext } from "@/lib/hr/authorize";
import { HrError } from "@/lib/hr/errors";
import type {
  HrMasterKind,
  HrRepository,
  MasterRecord,
  Pagination,
} from "@/lib/hr/repository/types";
import type { HrRequestContext } from "@/lib/platform/types";

export type HrServiceContext = HrAccessContext & {
  /** auth.users.id recorded as created_by / updated_by and in the audit trail. */
  actorAuthUserId: string;
  /** Display name snapshot for approval audit (who approved). */
  actorDisplayName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Build a service context from a verified Platform context. Client-supplied
 * organization or branch ids are never accepted here — only resolved values.
 */
export function toHrServiceContext(
  ctx: HrRequestContext,
  options?: { allowedBranchIds?: readonly string[] | null; ip?: string | null; userAgent?: string | null },
): HrServiceContext {
  return {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    permissions: ctx.permissions,
    platformRoles: ctx.platformRoles,
    contextMode: ctx.contextMode,
    allowedBranchIds: options?.allowedBranchIds ?? null,
    actorAuthUserId: ctx.authUserId,
    actorDisplayName: ctx.profile?.displayName?.trim() || null,
    ip: options?.ip ?? null,
    userAgent: options?.userAgent ?? null,
  };
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type PageRequest = { page?: number; pageSize?: number };

export function normalizePagination(input?: PageRequest): Pagination & {
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, Math.trunc(input?.page ?? 1) || 1);
  const rawSize = Math.trunc(input?.pageSize ?? DEFAULT_PAGE_SIZE) ||
    DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export type PagedResponse<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export function toPagedResponse<T>(
  result: { rows: T[]; total: number },
  pagination: { page: number; pageSize: number },
): PagedResponse<T> {
  return {
    rows: result.rows,
    total: result.total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    pageCount: Math.max(1, Math.ceil(result.total / pagination.pageSize)),
  };
}

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_.-]{0,49}$/;

/** Uppercase, trim and validate a tenant-scoped business code. */
export function normalizeCode(raw: string, label = "รหัส"): string {
  const code = raw.trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    throw new HrError("VALIDATION_ERROR", {
      message: `${label}ต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข หรือ _ . - ความยาว 1-50 ตัวอักษร`,
      details: { code: raw },
    });
  }
  return code;
}

export function requireText(
  raw: string | null | undefined,
  label: string,
  max = 200,
): string {
  const value = (raw ?? "").trim();
  if (!value) {
    throw new HrError("VALIDATION_ERROR", { message: `กรุณาระบุ${label}` });
  }
  if (value.length > max) {
    throw new HrError("VALIDATION_ERROR", {
      message: `${label}ยาวเกิน ${max} ตัวอักษร`,
    });
  }
  return value;
}

/** One user-facing name; mirrors into nameEn when the bilingual column is required. */
export function resolveDisplayNamePair(
  name: string,
  nameEn: string | null | undefined,
  label: string,
  max = 200,
): { nameTh: string; nameEn: string } {
  const nameTh = requireText(name, label, max);
  const en = (nameEn ?? "").trim();
  return {
    nameTh,
    nameEn: en ? requireText(en, label, max) : nameTh,
  };
}

export function optionalText(
  raw: string | null | undefined,
  max = 500,
): string | null {
  if (raw == null) return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.length > max) {
    throw new HrError("VALIDATION_ERROR", {
      message: `ข้อความยาวเกิน ${max} ตัวอักษร`,
    });
  }
  return value;
}

/** Master row that exists and is still usable for new records. */
export async function requireActiveMaster(
  repository: HrRepository,
  kind: HrMasterKind,
  id: string,
): Promise<MasterRecord> {
  const row = await repository.masters.findById(kind, id);
  if (!row) {
    throw new HrError("NOT_FOUND", { details: { master: kind, id } });
  }
  if (!row.isActive) {
    throw new HrError("INACTIVE_MASTER", { details: { master: kind, code: row.code } });
  }
  return row;
}

export async function requireMasterByCode(
  repository: HrRepository,
  kind: HrMasterKind,
  code: string,
): Promise<MasterRecord> {
  const row = await repository.masters.findByCode(kind, code);
  if (!row) {
    throw new HrError("NOT_FOUND", { details: { master: kind, code } });
  }
  return row;
}

/**
 * Narrow a requested branch filter to the caller's allow-list, so a member can
 * never widen their own scope through a query string.
 */
export function resolveBranchScope(
  ctx: HrServiceContext,
  requestedBranchId?: string | null,
): { branchIds: readonly string[] | null; branchId: string | null } {
  const allowed = ctx.allowedBranchIds ?? null;

  if (requestedBranchId) {
    if (allowed != null && !allowed.includes(requestedBranchId)) {
      throw new HrError("BRANCH_OUT_OF_SCOPE", {
        details: { branchId: requestedBranchId },
      });
    }
    return { branchIds: allowed, branchId: requestedBranchId };
  }

  return { branchIds: allowed, branchId: null };
}

/**
 * Filter for rows that join `employee` (leave, OT, payroll run lines, …).
 *
 * Order of precedence (must stay consistent across HR):
 * 1. Shell header selected branch (`ctx.branchId`) — even for OWNER/ADMIN
 * 2. Membership allow-list (`ctx.allowedBranchIds`) — BRANCH_MANAGER etc.
 * 3. No filter — “ทุกสาขา” + org-wide admin
 */
export function employeeBranchWhere(ctx: HrServiceContext): {
  employee?: { branchId: string | { in: string[] } };
} {
  if (ctx.branchId) {
    return { employee: { branchId: ctx.branchId } };
  }
  if (ctx.allowedBranchIds != null) {
    return { employee: { branchId: { in: [...ctx.allowedBranchIds] } } };
  }
  return {};
}

/** Same rules as `employeeBranchWhere`, for queries on `Employee` itself. */
export function employeeOwnBranchWhere(ctx: HrServiceContext): {
  branchId?: string | { in: string[] };
} {
  if (ctx.branchId) return { branchId: ctx.branchId };
  if (ctx.allowedBranchIds != null) {
    return { branchId: { in: [...ctx.allowedBranchIds] } };
  }
  return {};
}
