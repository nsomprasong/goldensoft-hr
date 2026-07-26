/**
 * HR product route registry for Unified Customer Shell (goldensoft-app).
 *
 * Canonical customer-facing paths use the `/hr` prefix. Customer App owns
 * global Login / Sidebar / Header / org-branch selector and mounts these
 * entries as product menu items. This module does not own global chrome.
 */
import { HR_ENTITLEMENTS, type HrEntitlementCode } from "@/lib/hr/entitlements";
import { HR_PERMISSIONS, type HrPermission } from "@/lib/hr/permissions";

/** Fixed product prefix used by Customer App and standalone debug. */
export const HR_ROUTE_PREFIX = "/hr" as const;

export type HrRouteKey =
  | "dashboard"
  | "employees"
  | "employeesNew"
  | "employeesDetail"
  | "employeesEdit"
  | "departments"
  | "positions"
  | "shifts"
  | "overtimeRules"
  | "payrollSchedules"
  | "payrollPeriods"
  | "payrollPeriodDetail"
  | "branchEmployees";

export type HrRouteDefinition = {
  key: HrRouteKey;
  /** Canonical path under Customer App (always starts with /hr). */
  path: string;
  labelTh: string;
  /** Shown in product-local nav when true. */
  nav: boolean;
  /** Any one of these permissions is enough (empty = entitlement-only gate). */
  requiredPermissions: readonly HrPermission[];
  /** All listed entitlements must be allowed (Platform check). */
  requiredEntitlements: readonly HrEntitlementCode[];
};

export const HR_ROUTE_REGISTRY: readonly HrRouteDefinition[] = [
  {
    key: "dashboard",
    path: HR_ROUTE_PREFIX,
    labelTh: "แดชบอร์ด",
    nav: true,
    requiredPermissions: [],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "employees",
    path: `${HR_ROUTE_PREFIX}/employees`,
    labelTh: "พนักงาน",
    nav: true,
    requiredPermissions: [HR_PERMISSIONS.employeeRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "employeesNew",
    path: `${HR_ROUTE_PREFIX}/employees/new`,
    labelTh: "เพิ่มพนักงาน",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.employeeCreate],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "employeesDetail",
    path: `${HR_ROUTE_PREFIX}/employees/[id]`,
    labelTh: "รายละเอียดพนักงาน",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.employeeRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "employeesEdit",
    path: `${HR_ROUTE_PREFIX}/employees/[id]/edit`,
    labelTh: "แก้ไขพนักงาน",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.employeeUpdate],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "departments",
    path: `${HR_ROUTE_PREFIX}/settings/departments`,
    labelTh: "แผนก",
    nav: true,
    requiredPermissions: [HR_PERMISSIONS.departmentRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "positions",
    path: `${HR_ROUTE_PREFIX}/settings/positions`,
    labelTh: "ตำแหน่ง",
    nav: true,
    requiredPermissions: [HR_PERMISSIONS.positionRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "shifts",
    path: `${HR_ROUTE_PREFIX}/settings/shifts`,
    labelTh: "กะงาน",
    nav: true,
    requiredPermissions: [HR_PERMISSIONS.shiftRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "overtimeRules",
    path: `${HR_ROUTE_PREFIX}/settings/overtime-rules`,
    labelTh: "กฎ OT",
    nav: true,
    requiredPermissions: [
      HR_PERMISSIONS.settingsManage,
      HR_PERMISSIONS.compensationManage,
    ],
    requiredEntitlements: [HR_ENTITLEMENTS.access, HR_ENTITLEMENTS.overtime],
  },
  {
    key: "payrollSchedules",
    path: `${HR_ROUTE_PREFIX}/settings/payroll-schedules`,
    labelTh: "รอบจ่าย",
    nav: true,
    requiredPermissions: [HR_PERMISSIONS.payrollScheduleRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access, HR_ENTITLEMENTS.payroll],
  },
  {
    key: "payrollPeriods",
    path: `${HR_ROUTE_PREFIX}/payroll/periods`,
    labelTh: "งวดเงินเดือน",
    nav: true,
    requiredPermissions: [HR_PERMISSIONS.payrollPeriodRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access, HR_ENTITLEMENTS.payroll],
  },
  {
    key: "payrollPeriodDetail",
    path: `${HR_ROUTE_PREFIX}/payroll/periods/[id]`,
    labelTh: "รายละเอียดงวด",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.payrollPeriodRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access, HR_ENTITLEMENTS.payroll],
  },
  {
    key: "branchEmployees",
    path: `${HR_ROUTE_PREFIX}/branches/[branchId]`,
    labelTh: "พนักงานตามสาขา",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.employeeRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
] as const;

const BY_KEY = Object.fromEntries(
  HR_ROUTE_REGISTRY.map((r) => [r.key, r]),
) as Record<HrRouteKey, HrRouteDefinition>;

export function hrRoute(key: HrRouteKey): HrRouteDefinition {
  return BY_KEY[key];
}

export function hrPath(
  key: HrRouteKey,
  params?: Record<string, string>,
): string {
  let path = BY_KEY[key].path;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      path = path.replace(`[${name}]`, encodeURIComponent(value));
    }
  }
  return path;
}

/** Nav entries for Customer App sidebar merge and HR product-local nav. */
export function hrNavRegistry(): readonly HrRouteDefinition[] {
  return HR_ROUTE_REGISTRY.filter((r) => r.nav);
}

export type HrNavKey =
  | "dashboard"
  | "employees"
  | "departments"
  | "positions"
  | "shifts"
  | "overtime-rules"
  | "payroll-schedules"
  | "payroll-periods";

const NAV_KEY_TO_ROUTE: Record<HrNavKey, HrRouteKey> = {
  dashboard: "dashboard",
  employees: "employees",
  departments: "departments",
  positions: "positions",
  shifts: "shifts",
  "overtime-rules": "overtimeRules",
  "payroll-schedules": "payrollSchedules",
  "payroll-periods": "payrollPeriods",
};

export function hrNavRouteKey(nav: HrNavKey): HrRouteKey {
  return NAV_KEY_TO_ROUTE[nav];
}
