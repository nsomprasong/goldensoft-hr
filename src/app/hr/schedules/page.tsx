import { redirect } from "next/navigation";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import SchedulesWorkspace from "@/components/hr/schedules-workspace";
import HrShell from "@/components/hr-shell";
import { schedulesHrefForBranch } from "@/lib/hr/branch-nav";
import {
  combineAvailability,
  listOrganizationBranches,
  listSchedulePeriods,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { canHr, HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.scheduleRead });
  const params = await searchParams;
  const requestedBranchId = single(params, "branchId");

  const [branchesResult, canManage, canPublish] = await Promise.all([
    listOrganizationBranches(ctx),
    Promise.resolve(canHr(ctx, HR_PERMISSIONS.scheduleManage)),
    Promise.resolve(canHr(ctx, HR_PERMISSIONS.schedulePublish)),
  ]);

  const branches =
    branchesResult.data.length > 0
      ? branchesResult.data
      : ctx.branch
        ? [{ id: ctx.branch.id, label: ctx.branch.name }]
        : ctx.branchId
          ? [{ id: ctx.branchId, label: "สาขาปัจจุบัน" }]
          : [];

  // Header branch is the source of truth (same as dashboard).
  if (ctx.branchId) {
    if (requestedBranchId !== ctx.branchId) {
      redirect(schedulesHrefForBranch(ctx.branchId));
    }
  } else if (!requestedBranchId && branches.length === 1) {
    redirect(schedulesHrefForBranch(branches[0]!.id));
  }

  const selectedBranchId = ctx.branchId
    ? ctx.branchId
    : requestedBranchId && branches.some((b) => b.id === requestedBranchId)
      ? requestedBranchId
      : "";

  const periods = selectedBranchId
    ? await listSchedulePeriods(ctx, { branchId: selectedBranchId })
    : {
        data: [],
        available: branchesResult.available,
        message: branchesResult.message,
      };

  const availability = combineAvailability(branchesResult, periods);
  const selectedBranchLabel =
    branches.find((b) => b.id === selectedBranchId)?.label ??
    (ctx.branch?.name ?? null);

  return (
    <HrShell ctx={ctx} active="schedules">
      <div className="hr-page-head">
        <div>
          <h1>ตารางงาน</h1>
          <p>
            {selectedBranchLabel
              ? `สาขา${selectedBranchLabel} — เลือกช่วงเวลา → เพิ่มกะ → จัดพนักงาน`
              : "เลือกสาขาที่หัวเว็บก่อน แล้วค่อยสร้างช่วงตารางและจัดพนักงาน"}
          </p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={availability.message} />

      {/* Only show in-page picker when header is "ทุกสาขา". */}
      {!ctx.branchId ? (
        <form className="card" method="get" action="/hr/schedules">
          <div className="filters">
            <div className="field">
              <label htmlFor="schedule-branchId">สาขา</label>
              <select
                id="schedule-branchId"
                name="branchId"
                defaultValue={selectedBranchId}
                required
              >
                <option value="" disabled>
                  — เลือกสาขา —
                </option>
                {branches.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ alignSelf: "end" }}>
              <button type="submit" className="btn btn-primary">
                เปิดตารางสาขานี้
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {!selectedBranchId ? (
        <p className="empty">
          กรุณาเลือกสาขาที่หัวเว็บก่อนจึงจะดูหรือจัดตารางได้
        </p>
      ) : (
        <SchedulesWorkspace
          periods={periods.data}
          branchId={selectedBranchId}
          branchLabel={selectedBranchLabel ?? "สาขา"}
          canManage={canManage}
          canPublish={canPublish}
          available={availability.available}
        />
      )}
    </HrShell>
  );
}
