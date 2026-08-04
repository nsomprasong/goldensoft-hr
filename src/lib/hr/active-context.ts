/**
 * Pure helpers for choosing org/branch/employee after login.
 * No DB — callers supply already-authorized options.
 */
export type ContextOption = {
  organizationId: string;
  branchIds: string[];
  employeeIds: string[];
};

export type ResolvedActiveContext = {
  organizationId: string;
  branchId: string | null;
  employeeId: string | null;
  /** When true, UI may skip the picker (single org + single branch). */
  autoSelected: boolean;
};

/**
 * Auto-select when the user has exactly one org and at most one branch.
 * Multi-org or multi-branch requires an explicit choice (returns nulls for
 * missing pieces and autoSelected=false).
 */
export function resolvePostLoginContext(
  options: ContextOption[],
  preferred?: {
    organizationId?: string | null;
    branchId?: string | null;
    employeeId?: string | null;
  },
): ResolvedActiveContext {
  if (options.length === 0) {
    return {
      organizationId: "",
      branchId: null,
      employeeId: null,
      autoSelected: false,
    };
  }

  let org =
    options.find((row) => row.organizationId === preferred?.organizationId) ??
    (options.length === 1 ? options[0]! : null);

  if (!org) {
    return {
      organizationId: "",
      branchId: null,
      employeeId: null,
      autoSelected: false,
    };
  }

  let branchId: string | null = null;
  if (
    preferred?.branchId &&
    org.branchIds.includes(preferred.branchId)
  ) {
    branchId = preferred.branchId;
  } else if (org.branchIds.length === 1) {
    branchId = org.branchIds[0]!;
  } else if (org.branchIds.length === 0) {
    branchId = null;
  }

  let employeeId: string | null = null;
  if (
    preferred?.employeeId &&
    org.employeeIds.includes(preferred.employeeId)
  ) {
    employeeId = preferred.employeeId;
  } else if (org.employeeIds.length === 1) {
    employeeId = org.employeeIds[0]!;
  }

  const autoSelected =
    options.length === 1 &&
    org.branchIds.length <= 1 &&
    (branchId !== null || org.branchIds.length === 0);

  return {
    organizationId: org.organizationId,
    branchId,
    employeeId,
    autoSelected,
  };
}

/** Server-side guard: employee must belong to auth + org and be active. */
export function assertEmployeeBelongsToAuth(input: {
  employee: {
    id: string;
    organizationId: string;
    authUserId: string | null;
    isActive: boolean;
    /** Employment status code when available (TERMINATED/INACTIVE blocked). */
    employeeStatusCode?: string | null;
  };
  organizationId: string;
  authUserId: string;
}): boolean {
  if (
    input.employee.organizationId !== input.organizationId ||
    input.employee.authUserId !== input.authUserId ||
    !input.employee.isActive
  ) {
    return false;
  }
  const status = input.employee.employeeStatusCode?.toUpperCase() ?? null;
  if (status === "TERMINATED" || status === "INACTIVE" || status === "RESIGNED") {
    return false;
  }
  return true;
}

/** Reject cross-org branch claims before trusting client branchId. */
export function assertBranchBelongsToOrganization(input: {
  branch: { id: string; organizationId: string } | null | undefined;
  organizationId: string;
  allowedBranchIds: string[] | null;
}): boolean {
  if (!input.branch) return false;
  if (input.branch.organizationId !== input.organizationId) return false;
  if (
    input.allowedBranchIds != null &&
    !input.allowedBranchIds.includes(input.branch.id)
  ) {
    return false;
  }
  return true;
}
