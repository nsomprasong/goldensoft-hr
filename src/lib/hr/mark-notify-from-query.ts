import { markNotificationRead } from "@/lib/hr/services/notify";
import type { HrServiceContext } from "@/lib/hr/services/shared";

/** Best-effort: mark notification read when opened via `?notify=<id>`. */
export async function markNotifyFromQuery(
  ctx: HrServiceContext,
  notifyId: string | null | undefined,
): Promise<void> {
  const id = String(notifyId ?? "").trim();
  if (!id) return;
  try {
    await markNotificationRead(ctx, id);
  } catch {
    // Ignore — notification may already be read or out of scope.
  }
}
