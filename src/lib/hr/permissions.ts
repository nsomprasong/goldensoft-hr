/**
 * HR permission codes (product-local). Platform membership/roles still gate
 * tenant access; these codes are enforced server-side inside HR.
 */
export const HR_PERMISSIONS = {
  employeeRead: "hr.employee.read",
  employeeManage: "hr.employee.manage",
  attendanceRead: "hr.attendance.read",
  attendanceManage: "hr.attendance.manage",
  payrollRead: "hr.payroll.read",
  payrollManage: "hr.payroll.manage",
} as const;

export type HrPermission = (typeof HR_PERMISSIONS)[keyof typeof HR_PERMISSIONS];

/** Map coarse Platform org roles → HR permissions (fail closed for unknown). */
export function hrPermissionsForOrganizationRoles(
  organizationRoles: string[],
): HrPermission[] {
  const roles = new Set(organizationRoles.map((r) => r.toUpperCase()));
  const granted = new Set<HrPermission>();

  if (roles.has("OWNER") || roles.has("ADMIN")) {
    for (const code of Object.values(HR_PERMISSIONS)) {
      granted.add(code);
    }
    return [...granted];
  }

  // Default member: read-only employees/attendance — never payroll manage.
  if (organizationRoles.length > 0) {
    granted.add(HR_PERMISSIONS.employeeRead);
    granted.add(HR_PERMISSIONS.attendanceRead);
  }

  return [...granted];
}

export function hasHrPermission(
  granted: readonly string[],
  required: HrPermission,
): boolean {
  return granted.includes(required);
}
