/**
 * HR permission codes (product-local). Platform membership/roles still gate
 * tenant access; these codes are enforced server-side inside HR.
 */
export const HR_PERMISSIONS = {
  employeeRead: "hr.employee.read",
  employeeCreate: "hr.employee.create",
  employeeUpdate: "hr.employee.update",
  employeeDeactivate: "hr.employee.deactivate",
  /** Coarse code kept for callers that only ask "may this user edit people?". */
  employeeManage: "hr.employee.manage",
  /** Linking an employee row to a Platform user account. */
  employeeLinkUser: "hr.employee.link_user",
  scheduleRead: "hr.schedule.read",
  scheduleManage: "hr.schedule.manage",
  schedulePublish: "hr.schedule.publish",
  attendanceSelf: "hr.attendance.self",
  /** Wage amounts are sensitive: read is separate from employee read. */
  compensationRead: "hr.compensation.read",
  compensationManage: "hr.compensation.manage",
  departmentRead: "hr.department.read",
  departmentManage: "hr.department.manage",
  positionRead: "hr.position.read",
  positionManage: "hr.position.manage",
  shiftRead: "hr.shift.read",
  shiftManage: "hr.shift.manage",
  payrollScheduleRead: "hr.payroll_schedule.read",
  payrollScheduleManage: "hr.payroll_schedule.manage",
  payrollPeriodRead: "hr.payroll_period.read",
  payrollPeriodManage: "hr.payroll_period.manage",
  attendanceRead: "hr.attendance.read",
  attendanceManage: "hr.attendance.manage",
  attendanceOverride: "hr.attendance.override",
  leaveSelf: "hr.leave.self",
  leaveRead: "hr.leave.read",
  leaveManage: "hr.leave.manage",
  leaveApprove: "hr.leave.approve",
  overtimeSelf: "hr.overtime.self",
  overtimeRead: "hr.overtime.read",
  overtimeManage: "hr.overtime.manage",
  overtimeApprove: "hr.overtime.approve",
  payrollRead: "hr.payroll.read",
  payrollCalculate: "hr.payroll.calculate",
  payrollReview: "hr.payroll.review",
  payrollApprove: "hr.payroll.approve",
  payrollMarkPaid: "hr.payroll.mark_paid",
  payrollLock: "hr.payroll.lock",
  payslipSelf: "hr.payslip.self",
  payslipRead: "hr.payslip.read",
  payrollManage: "hr.payroll.manage",
  locationManage: "hr.location.manage",
  calendarManage: "hr.calendar.manage",
  reportRead: "hr.report.read",
  approvalRead: "hr.approval.read",
  approvalManage: "hr.approval.manage",
  settingsManage: "hr.settings.manage",
} as const;

export type HrPermission = (typeof HR_PERMISSIONS)[keyof typeof HR_PERMISSIONS];

export const HR_PERMISSION_CODES: readonly HrPermission[] = Object.freeze(
  Object.values(HR_PERMISSIONS),
);

/**
 * Pay data is a separate decision from tenant administration, so these codes
 * are never derived from an organization role. They must be granted explicitly
 * through Platform-issued permissions.
 */
export const HR_COMPENSATION_PERMISSIONS: readonly HrPermission[] = [
  HR_PERMISSIONS.compensationRead,
  HR_PERMISSIONS.compensationManage,
];

export function isCompensationPermission(code: string): boolean {
  return (HR_COMPENSATION_PERMISSIONS as readonly string[]).includes(code);
}

/** Everything a tenant administrator (OWNER / ADMIN) receives implicitly. */
const ADMIN_PERMISSIONS: HrPermission[] = HR_PERMISSION_CODES.filter(
  (code) => !isCompensationPermission(code),
);

/** Self-service set for ordinary organization members. */
const MEMBER_PERMISSIONS: HrPermission[] = [
  HR_PERMISSIONS.scheduleRead,
  HR_PERMISSIONS.attendanceSelf,
  HR_PERMISSIONS.leaveSelf,
  HR_PERMISSIONS.overtimeSelf,
  HR_PERMISSIONS.payslipSelf,
];

/** Map coarse Platform org roles → HR permissions (fail closed for unknown). */
export function hrPermissionsForOrganizationRoles(
  organizationRoles: string[],
): HrPermission[] {
  const roles = new Set(organizationRoles.map((r) => r.toUpperCase()));

  // Administrators manage the tenant, but never see pay without an explicit grant.
  if (roles.has("OWNER") || roles.has("ADMIN")) {
    return [...ADMIN_PERMISSIONS];
  }

  if (organizationRoles.length > 0) {
    return [...MEMBER_PERMISSIONS];
  }

  return [];
}

export function hasHrPermission(
  granted: readonly string[],
  required: HrPermission,
): boolean {
  return granted.includes(required);
}

export function hasAnyHrPermission(
  granted: readonly string[],
  required: readonly HrPermission[],
): boolean {
  return required.some((code) => granted.includes(code));
}

/** UI helper: SUPER_ADMIN bypasses product-local codes, mirroring the guards. */
export function canHr(
  ctx: { permissions: readonly string[]; platformRoles: readonly string[] },
  required: HrPermission | readonly HrPermission[],
): boolean {
  if (ctx.platformRoles.includes("SUPER_ADMIN")) return true;
  const codes = Array.isArray(required)
    ? (required as readonly HrPermission[])
    : [required as HrPermission];
  return hasAnyHrPermission(ctx.permissions, codes);
}
