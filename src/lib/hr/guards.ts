import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { hrCan } from "@/lib/hr/authorize";
import type { HrPermission } from "@/lib/hr/permissions";
import { resolveHrRequestContext } from "@/lib/hr/resolve-context";
import { createHttpPlatformClient } from "@/lib/platform/client";
import { PlatformIntegrationError } from "@/lib/platform/errors";
import type {
  HrRequestContext,
  PlatformClient,
  PlatformForwardHeaders,
} from "@/lib/platform/types";

export {
  assertBranchInScope,
  assertHrPermission,
  assertSameOrganization,
  hrCan,
  isPlatformAdmin,
} from "@/lib/hr/authorize";

function buildCookieHeader(
  jar: Awaited<ReturnType<typeof cookies>>,
): string {
  return jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

export const requireHrPage = cache(async function requireHrPage(options?: {
  /** Single permission, or a set where any one of them is enough. */
  permission?: HrPermission | readonly HrPermission[];
  branchId?: string | null;
  platformClient?: PlatformClient;
  allowedBranchIds?: string[] | null;
}): Promise<HrRequestContext> {
  const jar = await cookies();
  const headerList = await headers();
  const cookieHeader = buildCookieHeader(jar);
  const clientOrganizationId = headerList.get("x-organization-id");
  const platformClient = options?.platformClient ?? createHttpPlatformClient();
  const testAuthUserId = headerList.get("x-test-auth-user-id");
  const forwardHeaders: PlatformForwardHeaders = {};
  const bridge = headerList.get("x-gs-platform-bootstrap");
  if (bridge) forwardHeaders["x-gs-platform-bootstrap"] = bridge;
  if (
    process.env.ALLOW_TEST_AUTH === "true" &&
    process.env.NODE_ENV !== "production" &&
    testAuthUserId
  ) {
    forwardHeaders["x-test-auth-user-id"] = testAuthUserId;
    forwardHeaders["x-test-auth-email"] =
      headerList.get("x-test-auth-email") ?? undefined;
  }

  try {
    const ctx = await resolveHrRequestContext({
      cookieHeader,
      clientOrganizationId,
      requiredBranchId: options?.branchId,
      platformClient,
      allowedBranchIds: options?.allowedBranchIds,
      forwardHeaders:
        Object.keys(forwardHeaders).length > 0 ? forwardHeaders : undefined,
    });

    if (options?.permission && !hrCan(ctx, options.permission)) {
      const required =
        typeof options.permission === "string"
          ? options.permission
          : options.permission.join(",");
      redirect(
        `/forbidden?reason=HR_PERMISSION_MISSING&required=${encodeURIComponent(required)}`,
      );
    }

    return ctx;
  } catch (error) {
    if (error instanceof PlatformIntegrationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      if (error.code === "TENANT_CONTEXT_REQUIRED") {
        redirect("/");
      }
      redirect(`/access?reason=${encodeURIComponent(error.code)}`);
    }
    throw error;
  }
});
