import { jsonResponse, requireHrApi, withHrApi } from "@/lib/hr/api";
import { HR_MASTER_KINDS } from "@/lib/hr/repository/types";

export const dynamic = "force-dynamic";

/**
 * Lookup catalog for HR forms. Audit vocabulary is deliberately withheld —
 * it is an internal concern, not a form option.
 */
const FORM_MASTER_KINDS = HR_MASTER_KINDS.filter(
  (kind) => kind !== "auditActionType",
);

export async function GET(request: Request): Promise<Response> {
  return withHrApi(async () => {
    const { repository } = await requireHrApi(request);

    const entries = await Promise.all(
      FORM_MASTER_KINDS.map(async (kind) => [
        kind,
        await repository.masters.list(kind, { activeOnly: true }),
      ] as const),
    );

    return jsonResponse({ masters: Object.fromEntries(entries) });
  });
}
