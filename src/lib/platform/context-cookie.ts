import { createHmac, timingSafeEqual } from "node:crypto";

import type { PlatformContextCookie } from "@/lib/platform/types";

/**
 * Shared Platform / Customer App context cookie contract.
 *
 * MUST stay identical to Platform `COOKIE_NAME` / encode-decode format
 * (`gs_platform_ctx`). HR must never invent a second cookie name or payload
 * shape — Unified Shell and Platform own issuance; HR only verifies.
 */
export const PLATFORM_CONTEXT_COOKIE_NAME = "gs_platform_ctx";

function getSecret(): string {
  const secret = process.env.PLATFORM_CONTEXT_COOKIE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("PLATFORM_CONTEXT_COOKIE_SECRET is required");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/** Test/helper: encode a Platform-compatible signed context cookie. */
export function encodePlatformContextCookie(
  value: PlatformContextCookie,
): string {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

/** Verify Platform signed context cookie. Never trust unsigned client claims. */
export function decodePlatformContextCookie(
  raw: string | undefined | null,
): PlatformContextCookie | null {
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as PlatformContextCookie;
    if (typeof parsed.organizationId !== "string") return null;
    return {
      organizationId: parsed.organizationId,
      branchId:
        typeof parsed.branchId === "string" || parsed.branchId === null
          ? parsed.branchId
          : null,
      mode:
        parsed.mode === "platform_admin" || parsed.mode === "membership"
          ? parsed.mode
          : undefined,
    };
  } catch {
    return null;
  }
}
