import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import LocationsWorkspace from "@/components/hr/locations-workspace";
import HrPageBackButton from "@/components/hr/hr-page-back-button";
import HrShell from "@/components/hr-shell";
import {
  listOrganizationBranches,
  listWorkLocations,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.locationManage });
  const { edit } = await searchParams;
  const [locations, orgBranches] = await Promise.all([
    listWorkLocations(ctx),
    listOrganizationBranches(ctx),
  ]);
  const editing = edit
    ? (locations.data.find((row) => row.id === edit) ?? null)
    : null;

  const branches =
    orgBranches.data.length > 0
      ? orgBranches.data
      : ctx.branch
        ? [{ id: ctx.branch.id, label: ctx.branch.name }]
        : ctx.branchId
          ? [{ id: ctx.branchId, label: "สาขาปัจจุบัน" }]
          : [];

  return (
    <HrShell ctx={ctx} active="locations">
      <div className="hr-page-head">
        <div>
          <h1>ตั้งพิกัดสาขา</h1>
          <p>ปักหมุดและรัศมี GPS สำหรับลงเวลา</p>
        </div>
        <HrPageBackButton href="/hr/settings" />
      </div>

      <DatabaseUnavailableNotice message={locations.message} />

      <LocationsWorkspace
        locations={locations.data}
        branches={branches}
        editing={editing}
        available={locations.available}
      />
    </HrShell>
  );
}
