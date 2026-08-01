/**
 * Schedule list URL for the shell's currently selected branch.
 * When no branch is selected ("ทุกสาขา"), return the picker page.
 */
export function schedulesHrefForBranch(
  branchId: string | null | undefined,
): string {
  if (!branchId) return "/hr/schedules";
  return `/hr/schedules?branchId=${encodeURIComponent(branchId)}`;
}
