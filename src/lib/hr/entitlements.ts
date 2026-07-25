/** Immutable HR entitlement codes (Platform catalog / contract v1). */
export const HR_PRODUCT_CODE = "GOLDENSOFT_HR";

export const HR_ENTITLEMENTS = {
  access: "hr.access",
  employeeLimit: "hr.employee_limit",
  branchLimit: "hr.branch_limit",
  mobileClockIn: "hr.mobile_clock_in",
  payroll: "hr.payroll",
  overtime: "hr.overtime",
} as const;

export type HrEntitlementCode =
  (typeof HR_ENTITLEMENTS)[keyof typeof HR_ENTITLEMENTS];

export function resolveHrProductCode(
  envValue: string | undefined = process.env.HR_PRODUCT_CODE,
): string {
  const code = (envValue ?? HR_PRODUCT_CODE).trim();
  return code.length > 0 ? code : HR_PRODUCT_CODE;
}
