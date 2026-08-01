import MeOvertimeWorkspace from "@/components/hr/me-overtime-workspace";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { markNotifyFromQuery } from "@/lib/hr/mark-notify-from-query";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { toHrServiceContext } from "@/lib/hr/services/shared";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function MyOvertimePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.overtimeSelf });
  const params = await searchParams;
  await markNotifyFromQuery(toHrServiceContext(ctx), single(params, "notify"));
  return (
    <HrShell ctx={ctx}>
      <MeOvertimeWorkspace />
    </HrShell>
  );
}
