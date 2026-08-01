import { HrError } from "@/lib/hr/errors";

/**
 * Ask Platform to move the linked user's membership home branch so login
 * shows the same branch HR just assigned.
 */
export async function syncPlatformHomeBranch(input: {
  organizationId: string;
  platformUserId: string;
  branchId: string;
  actorAuthUserId?: string | null;
}): Promise<void> {
  if (
    process.env.HR_USE_MEMORY_REPO === "true" ||
    process.env.NODE_ENV === "test"
  ) {
    return;
  }

  const base = process.env.PLATFORM_BASE_URL?.trim();
  const secret = process.env.PLATFORM_CONTEXT_COOKIE_SECRET?.trim();
  if (!base || !secret) {
    // Unit tests often leave NODE_ENV unset; local/dev without Platform
    // wiring should not block HR link — only production requires config.
    if (process.env.NODE_ENV === "production") {
      throw new HrError("INTERNAL_ERROR", {
        message:
          "ย้ายสาขาไม่สำเร็จ: ยังตั้งค่าเชื่อม Platform ไม่ครบ (PLATFORM_BASE_URL / PLATFORM_CONTEXT_COOKIE_SECRET)",
      });
    }
    return;
  }

  const response = await fetch(
    `${base.replace(/\/+$/, "")}/api/platform/internal/hr/home-branch`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-gs-platform-internal-secret": secret,
      },
      body: JSON.stringify({
        organizationId: input.organizationId,
        platformUserId: input.platformUserId,
        branchId: input.branchId,
        actorAuthUserId: input.actorAuthUserId ?? null,
      }),
      cache: "no-store",
    },
  );

  if (response.ok) return;

  let message = "ซิงก์สาขาไป Platform ไม่สำเร็จ";
  try {
    const payload = (await response.json()) as { message?: string };
    if (payload.message?.trim()) message = payload.message.trim();
  } catch {
    // keep fallback
  }

  if (response.status === 404) {
    throw new HrError("VALIDATION_ERROR", {
      message: `${message} — เชื่อมบัญชี Platform ของพนักงานก่อนย้ายสาขา`,
    });
  }

  throw new HrError("INTERNAL_ERROR", { message });
}
