import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  hasHrPermission,
  type HrPermission,
} from "@/lib/hr/permissions";
import { resolveHrRequestContext } from "@/lib/hr/resolve-context";
import { createHttpPlatformClient } from "@/lib/platform/client";
import { PlatformIntegrationError } from "@/lib/platform/errors";
import type { HrRequestContext, PlatformClient } from "@/lib/platform/types";

function buildCookieHeader(
  jar: Awaited<ReturnType<typeof cookies>>,
): string {
  return jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

export const requireHrPage = cache(async function requireHrPage(options?: {
  permission?: HrPermission;
  branchId?: string | null;
  platformClient?: PlatformClient;
  allowedBranchIds?: string[] | null;
}): Promise<HrRequestContext> {
  const jar = await cookies();
  const headerList = await headers();
  const cookieHeader = buildCookieHeader(jar);
  const clientOrganizationId = headerList.get("x-organization-id");
  const platformClient = options?.platformClient ?? createHttpPlatformClient();

  try {
    const ctx = await resolveHrRequestContext({
      cookieHeader,
      clientOrganizationId,
      requiredBranchId: options?.branchId,
      platformClient,
      allowedBranchIds: options?.allowedBranchIds,
    });

    if (
      options?.permission &&
      !hasHrPermission(ctx.permissions, options.permission) &&
      !ctx.platformRoles.includes("SUPER_ADMIN")
    ) {
      redirect("/forbidden");
    }

    return ctx;
  } catch (error) {
    if (error instanceof PlatformIntegrationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      if (error.code === "TENANT_CONTEXT_REQUIRED") {
        redirect("/select-organization");
      }
      redirect(`/access?reason=${encodeURIComponent(error.code)}`);
    }
    throw error;
  }
});

export function assertHrPermission(
  ctx: HrRequestContext,
  permission: HrPermission,
): void {
  if (ctx.platformRoles.includes("SUPER_ADMIN")) return;
  if (!hasHrPermission(ctx.permissions, permission)) {
    throw new PlatformIntegrationError("FORBIDDEN");
  }
}
