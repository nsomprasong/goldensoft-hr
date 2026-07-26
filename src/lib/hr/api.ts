/**
 * HR API plumbing shared by every route handler.
 *
 * Tenant identity always comes from the verified Platform context. Client
 * supplied organization/branch identifiers — headers, query strings or body
 * fields — are ignored outright rather than compared, so a forged header can
 * only ever be a no-op.
 *
 * This module intentionally avoids `next/server` and `server-only` so the
 * security suite can exercise it with a plain `Request` under Node.
 */
import type { z } from "zod";

import { assertHrPermission } from "@/lib/hr/authorize";
import { HrError, type HrErrorCode } from "@/lib/hr/errors";
import type { HrPermission } from "@/lib/hr/permissions";
import { getHrRepository } from "@/lib/hr/repository";
import type { HrRepository } from "@/lib/hr/repository/types";
import { resolveHrRequestContext } from "@/lib/hr/resolve-context";
import {
  normalizePagination,
  toHrServiceContext,
  type HrServiceContext,
} from "@/lib/hr/services/shared";
import { PlatformIntegrationError } from "@/lib/platform/errors";
import type {
  HrRequestContext,
  PlatformClient,
  PlatformErrorCode,
} from "@/lib/platform/types";

type HrApiGlobal = { __hrPlatformClientOverride?: PlatformClient | null };
const globalForApi = globalThis as unknown as HrApiGlobal;

/** Test hook: swap the Platform client used by every HR route. */
export function setHrPlatformClientOverride(
  client: PlatformClient | null,
): void {
  globalForApi.__hrPlatformClientOverride = client;
}

async function resolvePlatformClient(): Promise<PlatformClient> {
  const override = globalForApi.__hrPlatformClientOverride;
  if (override) return override;
  const { createHttpPlatformClient } = await import("@/lib/platform/client");
  return createHttpPlatformClient();
}

const PLATFORM_TO_HR_ERROR: Record<PlatformErrorCode, HrErrorCode> = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  TENANT_CONTEXT_REQUIRED: "TENANT_CONTEXT_REQUIRED",
  PRODUCT_NOT_ENTITLED: "PRODUCT_NOT_ENTITLED",
  SUBSCRIPTION_INACTIVE: "SUBSCRIPTION_INACTIVE",
  BRANCH_OUT_OF_SCOPE: "BRANCH_OUT_OF_SCOPE",
  CLIENT_ORG_MISMATCH: "FORBIDDEN",
  INVALID_BODY: "VALIDATION_ERROR",
  PROFILE_NOT_FOUND: "UNAUTHENTICATED",
  PROFILE_SUSPENDED: "FORBIDDEN",
  PLATFORM_UNAVAILABLE: "INTERNAL_ERROR",
};

export function toHrError(error: unknown): HrError {
  if (error instanceof HrError) return error;
  if (error instanceof PlatformIntegrationError) {
    return new HrError(PLATFORM_TO_HR_ERROR[error.code], {
      message: error.message,
      httpStatus: error.httpStatus,
    });
  }
  console.error("[hr-api] unhandled error", error);
  return new HrError("INTERNAL_ERROR");
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function jsonError(error: unknown): Response {
  const hrError = toHrError(error);
  return jsonResponse(
    { error: hrError.toJSON() },
    hrError.httpStatus,
  );
}

/** Wrap a handler so every thrown HrError becomes a Thai JSON error body. */
export async function withHrApi(
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    return jsonError(error);
  }
}

export type HrApiSession = {
  ctx: HrRequestContext;
  service: HrServiceContext;
  repository: HrRepository;
};

/**
 * Branch allow-list for the caller. Tenant administrators see the whole
 * organization; everyone else is pinned to their active branch.
 */
export function resolveAllowedBranchIds(
  ctx: HrRequestContext,
): string[] | null {
  if (ctx.contextMode === "platform_admin") return null;
  const roles = ctx.membershipRoles.map((role) => role.toUpperCase());
  if (roles.includes("OWNER") || roles.includes("ADMIN")) return null;
  return ctx.branchId ? [ctx.branchId] : [];
}

export type RequireHrApiOptions = {
  permission?: HrPermission | readonly HrPermission[];
  /** Branch the route acts on; verified against the caller's allow-list. */
  branchId?: string | null;
  platformClient?: PlatformClient;
  repository?: HrRepository;
};

export async function requireHrApi(
  request: Request,
  options: RequireHrApiOptions = {},
): Promise<HrApiSession> {
  const platformClient =
    options.platformClient ?? (await resolvePlatformClient());

  // x-organization-id and any body-supplied tenant id are deliberately unread.
  const testAuthUserId = request.headers.get("x-test-auth-user-id");
  const forwardHeaders =
    process.env.ALLOW_TEST_AUTH === "true" &&
    process.env.NODE_ENV !== "production" &&
    testAuthUserId
      ? {
          "x-test-auth-user-id": testAuthUserId,
          "x-test-auth-email":
            request.headers.get("x-test-auth-email") ?? undefined,
        }
      : undefined;

  const ctx = await resolveHrRequestContext({
    cookieHeader: request.headers.get("cookie") ?? "",
    platformClient,
    forwardHeaders,
  });

  const allowedBranchIds = resolveAllowedBranchIds(ctx);
  const service = toHrServiceContext(ctx, {
    allowedBranchIds,
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  });

  if (options.branchId) {
    if (allowedBranchIds != null && !allowedBranchIds.includes(options.branchId)) {
      throw new HrError("BRANCH_OUT_OF_SCOPE", {
        details: { branchId: options.branchId },
      });
    }
  }

  if (options.permission) {
    assertHrPermission(service, options.permission);
  }

  const repository = options.repository ?? (await getHrRepository());
  return { ctx, service, repository };
}

// ─── Request parsing ──────────────────────────────────────────────────────

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HrError("VALIDATION_ERROR", {
      message: "รูปแบบข้อมูล JSON ไม่ถูกต้อง",
    });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HrError("VALIDATION_ERROR", {
      details: {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
  }
  return parsed.data;
}

export function parseQuery<T>(request: Request, schema: z.ZodType<T>): T {
  const params = new URL(request.url).searchParams;
  const raw: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    raw[key] = value;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HrError("VALIDATION_ERROR", {
      details: {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
  }
  return parsed.data;
}

export function readPagination(request: Request): {
  page: number;
  pageSize: number;
} {
  const params = new URL(request.url).searchParams;
  return normalizePagination({
    page: Number(params.get("page") ?? "") || undefined,
    pageSize: Number(params.get("pageSize") ?? "") || undefined,
  });
}

export function readSearchParam(
  request: Request,
  name: string,
): string | null {
  const value = new URL(request.url).searchParams.get(name);
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function readBooleanParam(
  request: Request,
  name: string,
): boolean | null {
  const value = readSearchParam(request, name);
  if (value === null) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}
