import "server-only";

import {
  isInactiveSubscriptionStatus,
  PlatformIntegrationError,
} from "@/lib/platform/errors";
import type {
  EntitlementCheckRequest,
  EntitlementCheckResponse,
  PlatformClient,
  PlatformMeResponse,
} from "@/lib/platform/types";

export type { PlatformClient };

function platformBaseUrl(): string {
  const base = process.env.PLATFORM_BASE_URL?.trim();
  if (!base) {
    throw new PlatformIntegrationError(
      "PLATFORM_UNAVAILABLE",
      "ไม่ได้ตั้งค่า PLATFORM_BASE_URL",
    );
  }
  return base.replace(/\/+$/, "");
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function codeFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export function createHttpPlatformClient(): PlatformClient {
  return {
    async getMe(cookieHeader) {
      const res = await fetch(`${platformBaseUrl()}/api/auth/me`, {
        method: "GET",
        headers: { cookie: cookieHeader },
        cache: "no-store",
      });
      const body = await readJson(res);
      if (res.status === 401) {
        throw new PlatformIntegrationError("UNAUTHENTICATED");
      }
      if (!res.ok) {
        const code = codeFromBody(body);
        if (code === "PROFILE_NOT_FOUND" || code === "PROFILE_SUSPENDED") {
          throw new PlatformIntegrationError(code);
        }
        throw new PlatformIntegrationError("FORBIDDEN");
      }
      return body as PlatformMeResponse;
    },

    async checkEntitlement(cookieHeader, input) {
      const res = await fetch(
        `${platformBaseUrl()}/api/platform/entitlements/check`,
        {
          method: "POST",
          headers: {
            cookie: cookieHeader,
            "content-type": "application/json",
          },
          body: JSON.stringify(input),
          cache: "no-store",
        },
      );
      const body = await readJson(res);
      if (res.status === 401) {
        throw new PlatformIntegrationError("UNAUTHENTICATED");
      }
      if (res.status === 403) {
        throw new PlatformIntegrationError("FORBIDDEN");
      }
      if (!res.ok) {
        throw new PlatformIntegrationError("PLATFORM_UNAVAILABLE");
      }
      const result = body as EntitlementCheckResponse;
      if (
        !result.allowed &&
        isInactiveSubscriptionStatus(result.subscriptionStatus)
      ) {
        throw new PlatformIntegrationError("SUBSCRIPTION_INACTIVE");
      }
      return result;
    },
  };
}
