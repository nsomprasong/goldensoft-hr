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
  | "branchEmployees"
  | "me"
  | "meAttendance"
  | "meSchedule"
  | "meLeave"
  | "meOvertime"
  | "mePayslips"
  | "meAdvances"
  | "meFace"
  | "mePayslipDetail"
  | "schedules"
  | "scheduleDetail"
  | "calendars"
  | "locations"
  | "attendance"
  | "attendanceExceptions"
  | "attendanceAdjustments"
  | "leave"
  | "leaveHistory"
  | "leaveBalances"
  | "overtime"
  | "overtimeHistory"
  | "approvals"
  | "approvalsHistory"
  | "compensation"
  | "payItems"
  | "payrollRuns"
  | "payrollRunDetail"
  | "payrollReview"
  | "payrollDeductions"
  | "attendancePay"
  | "faceMatching"
  | "advances"
  | "payslips"
  | "payslipDetail"
  | "reports"
  | "notifications"
  | "settings"
  | "leaveEntitlements";

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
    requiredPermissions: [
      HR_PERMISSIONS.employeeRead,
      HR_PERMISSIONS.approvalRead,
      HR_PERMISSIONS.leaveApprove,
      HR_PERMISSIONS.attendanceRead,
    ],
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
    nav: false,
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
    key: "payrollDeductions",
    path: `${HR_ROUTE_PREFIX}/settings/payroll-deductions`,
    labelTh: "ภาษีและประกันสังคม",
    nav: true,
    requiredPermissions: [
      HR_PERMISSIONS.payrollManage,
      HR_PERMISSIONS.settingsManage,
    ],
    requiredEntitlements: [HR_ENTITLEMENTS.access, HR_ENTITLEMENTS.payroll],
  },
  {
    key: "attendancePay",
    path: `${HR_ROUTE_PREFIX}/settings/attendance-pay`,
    labelTh: "หักสาย / ขาดงาน",
    nav: true,
    requiredPermissions: [
      HR_PERMISSIONS.payrollManage,
      HR_PERMISSIONS.settingsManage,
    ],
    requiredEntitlements: [HR_ENTITLEMENTS.access, HR_ENTITLEMENTS.payroll],
  },
  {
    key: "faceMatching",
    path: `${HR_ROUTE_PREFIX}/settings/face-matching`,
    labelTh: "ตรวจใบหน้าตอนลงเวลา",
    nav: true,
    requiredPermissions: [
      HR_PERMISSIONS.settingsManage,
      HR_PERMISSIONS.attendanceManage,
    ],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "leaveEntitlements",
    path: `${HR_ROUTE_PREFIX}/settings/leave-entitlements`,
    labelTh: "สิทธิ์วันลา",
    nav: false,
    requiredPermissions: [
      HR_PERMISSIONS.leaveManage,
      HR_PERMISSIONS.settingsManage,
    ],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
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
  {
    key: "me",
    path: `${HR_ROUTE_PREFIX}/me`,
    labelTh: "บริการของฉัน",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.attendanceSelf, HR_PERMISSIONS.leaveSelf, HR_PERMISSIONS.overtimeSelf, HR_PERMISSIONS.payslipSelf],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "meAttendance", path: `${HR_ROUTE_PREFIX}/me/attendance`, labelTh: "ลงเวลาของฉัน", nav: true,
    requiredPermissions: [HR_PERMISSIONS.attendanceSelf], requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "meSchedule", path: `${HR_ROUTE_PREFIX}/me/schedule`, labelTh: "ตารางงานของฉัน", nav: false,
    requiredPermissions: [HR_PERMISSIONS.scheduleRead], requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "meLeave", path: `${HR_ROUTE_PREFIX}/me/leave`, labelTh: "ลางานของฉัน", nav: false,
    requiredPermissions: [HR_PERMISSIONS.leaveSelf], requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "meOvertime", path: `${HR_ROUTE_PREFIX}/me/overtime`, labelTh: "OT ของฉัน", nav: false,
    requiredPermissions: [HR_PERMISSIONS.overtimeSelf], requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "mePayslips", path: `${HR_ROUTE_PREFIX}/me/payslips`, labelTh: "สลิปเงินเดือนของฉัน", nav: false,
    requiredPermissions: [HR_PERMISSIONS.payslipSelf], requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "meAdvances",
    path: `${HR_ROUTE_PREFIX}/me/advances`,
    labelTh: "เบิกล่วงหน้าของฉัน",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.advanceSelf],
    requiredEntitlements: [HR_ENTITLEMENTS.access, HR_ENTITLEMENTS.payroll],
  },
  {
    key: "meFace",
    path: `${HR_ROUTE_PREFIX}/me/face`,
    labelTh: "ลงทะเบียนใบหน้า",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.attendanceSelf],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "mePayslipDetail", path: `${HR_ROUTE_PREFIX}/me/payslips/[id]`, labelTh: "สลิปเงินเดือน", nav: false,
    requiredPermissions: [HR_PERMISSIONS.payslipSelf], requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "schedules",
    path: `${HR_ROUTE_PREFIX}/schedules`,
    labelTh: "ตารางงาน",
    nav: true,
    requiredPermissions: [HR_PERMISSIONS.scheduleRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "scheduleDetail",
    path: `${HR_ROUTE_PREFIX}/schedules/[id]`,
    labelTh: "รายละเอียดตารางงาน",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.scheduleRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "calendars",
    path: `${HR_ROUTE_PREFIX}/calendars`,
    labelTh: "ปฏิทินทำงาน",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.calendarManage],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "locations",
    path: `${HR_ROUTE_PREFIX}/locations`,
    labelTh: "สถานที่ทำงาน",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.locationManage],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "attendance", path: `${HR_ROUTE_PREFIX}/attendance`, labelTh: "เวลาทำงาน", nav: true,
    requiredPermissions: [HR_PERMISSIONS.attendanceRead], requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "attendanceExceptions", path: `${HR_ROUTE_PREFIX}/attendance/exceptions`, labelTh: "ข้อยกเว้นเวลา", nav: false,
    requiredPermissions: [HR_PERMISSIONS.attendanceRead], requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "attendanceAdjustments", path: `${HR_ROUTE_PREFIX}/attendance/adjustments`, labelTh: "ปรับปรุงเวลา", nav: false,
    requiredPermissions: [HR_PERMISSIONS.attendanceManage], requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "leave", path: `${HR_ROUTE_PREFIX}/leave`, labelTh: "การลา", nav: true,
    requiredPermissions: [HR_PERMISSIONS.leaveRead], requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "leaveHistory",
    path: `${HR_ROUTE_PREFIX}/leave/history`,
    labelTh: "ประวัติการลา",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.leaveRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "leaveBalances", path: `${HR_ROUTE_PREFIX}/leave/balances`, labelTh: "ยอดคงเหลือการลา", nav: false,
    requiredPermissions: [HR_PERMISSIONS.leaveRead], requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "overtime", path: `${HR_ROUTE_PREFIX}/overtime`, labelTh: "ทำงานล่วงเวลา", nav: true,
    requiredPermissions: [HR_PERMISSIONS.overtimeRead], requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "overtimeHistory",
    path: `${HR_ROUTE_PREFIX}/overtime/history`,
    labelTh: "ประวัติ OT",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.overtimeRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "approvals",
    path: `${HR_ROUTE_PREFIX}/approvals`,
    labelTh: "รายการรออนุมัติ",
    nav: true,
    requiredPermissions: [
      HR_PERMISSIONS.approvalRead,
      HR_PERMISSIONS.leaveApprove,
      HR_PERMISSIONS.overtimeApprove,
      HR_PERMISSIONS.advanceApprove,
      HR_PERMISSIONS.attendanceManage,
    ],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "approvalsHistory",
    path: `${HR_ROUTE_PREFIX}/approvals/history`,
    labelTh: "ประวัติอนุมัติ",
    nav: false,
    requiredPermissions: [
      HR_PERMISSIONS.approvalRead,
      HR_PERMISSIONS.leaveApprove,
      HR_PERMISSIONS.overtimeApprove,
      HR_PERMISSIONS.advanceApprove,
    ],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "compensation",
    path: `${HR_ROUTE_PREFIX}/compensation`,
    labelTh: "ค่าตอบแทน",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.compensationRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "payItems",
    path: `${HR_ROUTE_PREFIX}/pay-items`,
    labelTh: "รายได้ / รายการหัก",
    nav: true,
    requiredPermissions: [
      HR_PERMISSIONS.compensationManage,
      HR_PERMISSIONS.compensationRead,
    ],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "advances",
    path: `${HR_ROUTE_PREFIX}/advances`,
    labelTh: "เบิกล่วงหน้า",
    nav: true,
    requiredPermissions: [
      HR_PERMISSIONS.payrollRead,
      HR_PERMISSIONS.payrollManage,
      HR_PERMISSIONS.advanceApprove,
    ],
    requiredEntitlements: [HR_ENTITLEMENTS.access, HR_ENTITLEMENTS.payroll],
  },
  {
    key: "payrollRuns", path: `${HR_ROUTE_PREFIX}/payroll/runs`, labelTh: "ประมวลผลเงินเดือน", nav: true,
    requiredPermissions: [HR_PERMISSIONS.payrollRead], requiredEntitlements: [HR_ENTITLEMENTS.access, HR_ENTITLEMENTS.payroll],
  },
  {
    key: "payrollRunDetail", path: `${HR_ROUTE_PREFIX}/payroll/runs/[id]`, labelTh: "รายละเอียดการประมวลผล", nav: false,
    requiredPermissions: [HR_PERMISSIONS.payrollRead], requiredEntitlements: [HR_ENTITLEMENTS.access, HR_ENTITLEMENTS.payroll],
  },
  {
    key: "payrollReview", path: `${HR_ROUTE_PREFIX}/payroll/review`, labelTh: "ตรวจสอบเงินเดือน", nav: false,
    requiredPermissions: [HR_PERMISSIONS.payrollReview], requiredEntitlements: [HR_ENTITLEMENTS.access, HR_ENTITLEMENTS.payroll],
  },
  {
    key: "payslips", path: `${HR_ROUTE_PREFIX}/payslips`, labelTh: "สลิปเงินเดือน", nav: true,
    requiredPermissions: [HR_PERMISSIONS.payslipRead], requiredEntitlements: [HR_ENTITLEMENTS.access, HR_ENTITLEMENTS.payroll],
  },
  {
    key: "payslipDetail",
    path: `${HR_ROUTE_PREFIX}/payslips/[id]`,
    labelTh: "รายละเอียดสลิป",
    nav: false,
    requiredPermissions: [HR_PERMISSIONS.payslipRead],
    requiredEntitlements: [HR_ENTITLEMENTS.access, HR_ENTITLEMENTS.payroll],
  },
  {
    key: "reports", path: `${HR_ROUTE_PREFIX}/reports`, labelTh: "รายงาน", nav: true,
    requiredPermissions: [HR_PERMISSIONS.reportRead], requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "notifications",
    path: `${HR_ROUTE_PREFIX}/notifications`,
    labelTh: "แจ้งเตือน",
    nav: false,
    requiredPermissions: [],
    requiredEntitlements: [HR_ENTITLEMENTS.access],
  },
  {
    key: "settings", path: `${HR_ROUTE_PREFIX}/settings`, labelTh: "ตั้งค่า HR", nav: true,
    requiredPermissions: [HR_PERMISSIONS.settingsManage], requiredEntitlements: [HR_ENTITLEMENTS.access],
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
  | "schedules"
  | "calendars"
  | "locations"
  | "overtime-rules"
  | "payroll-schedules"
  | "payroll-periods";

const NAV_KEY_TO_ROUTE: Record<HrNavKey, HrRouteKey> = {
  dashboard: "dashboard",
  employees: "employees",
  departments: "departments",
  positions: "positions",
  shifts: "shifts",
  schedules: "schedules",
  calendars: "calendars",
  locations: "locations",
  "overtime-rules": "overtimeRules",
  "payroll-schedules": "payrollSchedules",
  "payroll-periods": "payrollPeriods",
};

export function hrNavRouteKey(nav: HrNavKey): HrRouteKey {
  return NAV_KEY_TO_ROUTE[nav];
}
