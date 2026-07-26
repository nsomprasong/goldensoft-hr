import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { inflateRawSync } from "node:zlib";

import { z } from "zod";

import type {
  EntitlementCheckRequest,
  EntitlementCheckResponse,
  PlatformClient,
} from "@/lib/platform/types";

const bridgeSchema = z.object({
  issuedAt: z.number().int(),
  user: z.object({ id: z.string(), email: z.string().nullable() }),
  profile: z.object({
    displayName: z.string(),
    email: z.string(),
    statusCode: z.string(),
  }),
  platformRoles: z.array(z.string()),
  contextMode: z.enum(["membership", "platform_admin"]),
  organizationId: z.string().nullable(),
  organizationName: z.string().nullable(),
  branchId: z.string().nullable(),
  branchName: z.string().nullable(),
  membership: z
    .object({
      organizationId: z.string(),
      organizationName: z.string(),
      organizationStatus: z.string(),
      roles: z.array(z.string()),
      branches: z.array(
        z.object({ id: z.string(), name: z.string(), code: z.string() }),
      ),
    })
    .nullable(),
  permissions: z.array(z.string()),
  entitlements: z.array(
    z.object({
      code: z.string(),
      productCode: z.string(),
      allowed: z.boolean(),
      value: z.string().nullable(),
      subscriptionStatus: z.string().nullable(),
      expiresAt: z.string().nullable(),
    }),
  ),
});

type Bridge = z.infer<typeof bridgeSchema>;

function verify(raw: string): Bridge | null {
  const secret = process.env.PLATFORM_CONTEXT_COOKIE_SECRET?.trim();
  if (!secret || secret.length < 16) return null;
  const [encoded, signature, extra] = raw.split(".");
  if (!encoded || !signature || extra) return null;
  const expected = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return null;
  }
  try {
    const parsed = bridgeSchema.parse(
      JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
    );
    const age = Date.now() - parsed.issuedAt;
    if (age < -5_000 || age > 60_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function entitlementFromBridge(
  bridge: Bridge,
  input: EntitlementCheckRequest,
): EntitlementCheckResponse {
  if (
    !bridge.organizationId ||
    bridge.organizationId !== input.organizationId ||
    input.productCode !== "GOLDENSOFT_HR"
  ) {
    return {
      allowed: false,
      value: null,
      reason: "CONTEXT_MISMATCH",
      subscriptionStatus: null,
      expiresAt: null,
      organizationId: input.organizationId,
      productCode: input.productCode,
      entitlementCode: input.entitlementCode,
      branchId: input.branchId ?? null,
    };
  }
  const row = bridge.entitlements.find(
    (entry) =>
      entry.code === input.entitlementCode &&
      entry.productCode === input.productCode,
  );
  return {
    allowed: row?.allowed ?? false,
    value: row?.value ?? null,
    reason: row ? (row.allowed ? "ALLOWED" : "INACTIVE") : "ENTITLEMENT_MISSING",
    subscriptionStatus: row?.subscriptionStatus ?? null,
    expiresAt: row?.expiresAt ?? null,
    organizationId: input.organizationId,
    productCode: input.productCode,
    entitlementCode: input.entitlementCode,
    branchId: input.branchId ?? null,
  };
}

export function platformClientFromBridge(raw: string): PlatformClient | null {
  const bridge = verify(raw);
  if (!bridge) return null;
  return {
    async getMe() {
      return {
        user: bridge.user,
        profile: bridge.profile,
        platformRoles: bridge.platformRoles,
        memberships: bridge.membership
          ? [
              {
                organizationId: bridge.membership.organizationId,
                organizationName: bridge.membership.organizationName,
                organizationStatus: bridge.membership.organizationStatus,
                roles: bridge.membership.roles,
                branchCount: bridge.membership.branches.length,
              },
            ]
          : [],
        activeOrganization:
          bridge.organizationId && bridge.organizationName
            ? { id: bridge.organizationId, name: bridge.organizationName }
            : null,
        activeBranch:
          bridge.branchId && bridge.branchName
            ? {
                id: bridge.branchId,
                name: bridge.branchName,
                code:
                  bridge.membership?.branches.find(
                    (row) => row.id === bridge.branchId,
                  )?.code ?? "",
              }
            : null,
        permissions: bridge.permissions,
      };
    },
    async checkEntitlement(_cookieHeader, input) {
      return entitlementFromBridge(bridge, input);
    },
  };
}

export function decodeCustomerShellMarkup(raw: string | null): string | null {
  if (!raw) return null;
  const secret = process.env.PLATFORM_CONTEXT_COOKIE_SECRET?.trim();
  if (!secret || secret.length < 16) return null;
  const [issuedAt, encoded, signature, extra] = raw.split(".");
  if (!issuedAt || !encoded || !signature || extra) return null;
  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < -5_000 || age > 60_000) return null;
  const expected = createHmac("sha256", secret)
    .update(`shell:${issuedAt}:${encoded}`)
    .digest("base64url");
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return null;
  }
  try {
    const result = inflateRawSync(Buffer.from(encoded, "base64url"), {
      maxOutputLength: 64 * 1024,
    }).toString("utf8");
    return result.includes('data-shell="customer"') ? result : null;
  } catch {
    return null;
  }
}
