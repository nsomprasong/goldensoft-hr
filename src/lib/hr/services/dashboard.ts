/**
 * HR dashboard aggregates. Every read is independent so the whole summary is
 * fetched in one `Promise.all` round-trip.
 */
import { assertHrPermission } from "@/lib/hr/authorize";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type {
  HrRepository,
  PayrollPeriodRecord,
} from "@/lib/hr/repository/types";
import { findCurrentOpenPeriod } from "@/lib/hr/services/payroll-periods";
import type { HrServiceContext } from "@/lib/hr/services/shared";

export type DashboardCount = {
  id: string;
  code?: string;
  label?: string;
  count: number;
};

export type HrDashboardSummary = {
  organizationId: string;
  activeEmployees: {
    total: number;
    byBranch: DashboardCount[];
    byEmploymentType: DashboardCount[];
  };
  activeShifts: number;
  currentOpenPeriod: PayrollPeriodRecord | null;
};

export async function getHrDashboard(
  repository: HrRepository,
  ctx: HrServiceContext,
): Promise<HrDashboardSummary> {
  assertHrPermission(ctx, HR_PERMISSIONS.employeeRead);

  const [counts, activeShifts, employmentTypes, currentOpenPeriod] =
    await Promise.all([
      repository.employees.countActive(ctx.organizationId),
      repository.shifts.countActive(ctx.organizationId),
      repository.masters.list("employmentType"),
      findCurrentOpenPeriod(repository, ctx.organizationId),
    ]);

  const allowed = ctx.allowedBranchIds ?? null;
  const branchEntries = Object.entries(counts.byBranchId).filter(
    ([branchId]) => (allowed == null ? true : allowed.includes(branchId)),
  );

  return {
    organizationId: ctx.organizationId,
    activeEmployees: {
      total:
        allowed == null
          ? counts.total
          : branchEntries.reduce((sum, [, count]) => sum + count, 0),
      byBranch: branchEntries
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
      byEmploymentType: employmentTypes.map((type) => ({
        id: type.id,
        code: type.code,
        label: type.nameTh,
        count: counts.byEmploymentTypeId[type.id] ?? 0,
      })),
    },
    activeShifts,
    currentOpenPeriod,
  };
}
