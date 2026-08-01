/**
 * Canonical HR master/lookup catalog.
 *
 * The same rows are seeded by prisma/migrations/0001_hr_core/migration.sql.
 * Keeping the catalog here lets `npm run seed:hr` re-sync names idempotently
 * without ever changing an existing `code`.
 */
import type { PrismaClient } from "@prisma/client";

export type MasterRow = {
  code: string;
  nameTh: string;
  nameEn: string;
  sortOrder: number;
};

export const EMPLOYMENT_TYPES: MasterRow[] = [
  { code: "DAILY", nameTh: "รายวัน", nameEn: "Daily", sortOrder: 1 },
  { code: "MONTHLY", nameTh: "รายเดือน", nameEn: "Monthly", sortOrder: 2 },
  { code: "CONTRACT", nameTh: "สัญญาจ้าง", nameEn: "Contract", sortOrder: 3 },
  { code: "TEMPORARY", nameTh: "ชั่วคราว", nameEn: "Temporary", sortOrder: 4 },
];

export const EMPLOYEE_STATUSES: MasterRow[] = [
  { code: "ACTIVE", nameTh: "ปฏิบัติงาน", nameEn: "Active", sortOrder: 1 },
  { code: "INACTIVE", nameTh: "ไม่ปฏิบัติงาน", nameEn: "Inactive", sortOrder: 2 },
  { code: "RESIGNED", nameTh: "ลาออก", nameEn: "Resigned", sortOrder: 3 },
  { code: "TERMINATED", nameTh: "เลิกจ้าง", nameEn: "Terminated", sortOrder: 4 },
  { code: "SUSPENDED", nameTh: "พักงาน", nameEn: "Suspended", sortOrder: 5 },
];

export const SHIFT_TYPES: MasterRow[] = [
  { code: "REGULAR", nameTh: "กะปกติ", nameEn: "Regular", sortOrder: 1 },
  { code: "NIGHT", nameTh: "กะกลางคืน", nameEn: "Night", sortOrder: 2 },
  { code: "SPLIT", nameTh: "กะแบ่งช่วง", nameEn: "Split", sortOrder: 3 },
  { code: "OFF", nameTh: "วันหยุด", nameEn: "Day off", sortOrder: 4 },
  { code: "LEAVE", nameTh: "วันลา", nameEn: "Leave", sortOrder: 5 },
];

export const PAY_FREQUENCIES: MasterRow[] = [
  {
    code: "SEMIMONTHLY",
    nameTh: "รายครึ่งเดือน",
    nameEn: "Semi-monthly",
    sortOrder: 1,
  },
  { code: "MONTHLY", nameTh: "รายเดือน", nameEn: "Monthly", sortOrder: 2 },
  { code: "WEEKLY", nameTh: "รายสัปดาห์", nameEn: "Weekly", sortOrder: 3 },
  { code: "DAILY", nameTh: "รายวัน", nameEn: "Daily", sortOrder: 4 },
];

export const WAGE_TYPES: MasterRow[] = [
  { code: "DAILY", nameTh: "ค่าจ้างรายวัน", nameEn: "Daily wage", sortOrder: 1 },
  { code: "MONTHLY", nameTh: "เงินเดือน", nameEn: "Monthly salary", sortOrder: 2 },
  {
    code: "HOURLY",
    nameTh: "ค่าจ้างรายชั่วโมง",
    nameEn: "Hourly wage",
    sortOrder: 3,
  },
];

export const OVERTIME_RATE_TYPES: MasterRow[] = [
  {
    code: "NORMAL_DAY",
    nameTh: "วันทำงานปกติ",
    nameEn: "Normal working day",
    sortOrder: 1,
  },
  { code: "HOLIDAY", nameTh: "วันหยุดนักขัตฤกษ์", nameEn: "Holiday", sortOrder: 2 },
  {
    code: "REST_DAY",
    nameTh: "วันหยุดประจำสัปดาห์",
    nameEn: "Weekly rest day",
    sortOrder: 3,
  },
  { code: "SPECIAL", nameTh: "อัตราพิเศษ", nameEn: "Special rate", sortOrder: 4 },
];

export const PAYROLL_PERIOD_STATUSES: MasterRow[] = [
  { code: "DRAFT", nameTh: "ร่าง", nameEn: "Draft", sortOrder: 1 },
  { code: "OPEN", nameTh: "เปิดงวด", nameEn: "Open", sortOrder: 2 },
  { code: "CALCULATING", nameTh: "กำลังคำนวณ", nameEn: "Calculating", sortOrder: 3 },
  { code: "REVIEW", nameTh: "รอตรวจสอบ", nameEn: "Review", sortOrder: 4 },
  { code: "APPROVED", nameTh: "อนุมัติแล้ว", nameEn: "Approved", sortOrder: 5 },
  { code: "PAID", nameTh: "จ่ายแล้ว", nameEn: "Paid", sortOrder: 6 },
  { code: "LOCKED", nameTh: "ล็อกงวด", nameEn: "Locked", sortOrder: 7 },
];

export const AUDIT_ACTION_TYPES: MasterRow[] = [
  {
    code: "employee.create",
    nameTh: "สร้างพนักงาน",
    nameEn: "Create employee",
    sortOrder: 1,
  },
  {
    code: "employee.update",
    nameTh: "แก้ไขข้อมูลพนักงาน",
    nameEn: "Update employee",
    sortOrder: 2,
  },
  {
    code: "employee.deactivate",
    nameTh: "ปิดการใช้งานพนักงาน",
    nameEn: "Deactivate employee",
    sortOrder: 3,
  },
  {
    code: "employee.link_user",
    nameTh: "เชื่อมบัญชีผู้ใช้กับพนักงาน",
    nameEn: "Link user account to employee",
    sortOrder: 4,
  },
  {
    code: "employee.unlink_user",
    nameTh: "ยกเลิกการเชื่อมบัญชีผู้ใช้",
    nameEn: "Unlink user account from employee",
    sortOrder: 5,
  },
  {
    code: "compensation.add",
    nameTh: "เพิ่มข้อมูลค่าจ้าง",
    nameEn: "Add compensation record",
    sortOrder: 6,
  },
  {
    code: "department.create",
    nameTh: "สร้างแผนก",
    nameEn: "Create department",
    sortOrder: 7,
  },
  {
    code: "department.update",
    nameTh: "แก้ไขแผนก",
    nameEn: "Update department",
    sortOrder: 8,
  },
  {
    code: "department.deactivate",
    nameTh: "ปิดการใช้งานแผนก",
    nameEn: "Deactivate department",
    sortOrder: 9,
  },
  {
    code: "position.create",
    nameTh: "สร้างตำแหน่ง",
    nameEn: "Create position",
    sortOrder: 10,
  },
  {
    code: "position.update",
    nameTh: "แก้ไขตำแหน่ง",
    nameEn: "Update position",
    sortOrder: 11,
  },
  {
    code: "position.deactivate",
    nameTh: "ปิดการใช้งานตำแหน่ง",
    nameEn: "Deactivate position",
    sortOrder: 12,
  },
  {
    code: "shift.create",
    nameTh: "สร้างกะการทำงาน",
    nameEn: "Create shift",
    sortOrder: 13,
  },
  {
    code: "shift.update",
    nameTh: "แก้ไขกะการทำงาน",
    nameEn: "Update shift",
    sortOrder: 14,
  },
  {
    code: "shift.deactivate",
    nameTh: "ปิดการใช้งานกะการทำงาน",
    nameEn: "Deactivate shift",
    sortOrder: 15,
  },
  {
    code: "payroll_schedule.create",
    nameTh: "สร้างรอบการจ่ายเงินเดือน",
    nameEn: "Create payroll schedule",
    sortOrder: 16,
  },
  {
    code: "payroll_schedule.update",
    nameTh: "แก้ไขรอบการจ่ายเงินเดือน",
    nameEn: "Update payroll schedule",
    sortOrder: 17,
  },
  {
    code: "payroll_period.create",
    nameTh: "สร้างงวดจ่ายเงินเดือน",
    nameEn: "Create payroll period",
    sortOrder: 18,
  },
  {
    code: "payroll_period.status_change",
    nameTh: "เปลี่ยนสถานะงวดจ่ายเงินเดือน",
    nameEn: "Change payroll period status",
    sortOrder: 19,
  },
  {
    code: "overtime_rule.create",
    nameTh: "สร้างกฎค่าล่วงเวลา",
    nameEn: "Create overtime rule",
    sortOrder: 20,
  },
  {
    code: "overtime_rule.update",
    nameTh: "แก้ไขกฎค่าล่วงเวลา",
    nameEn: "Update overtime rule",
    sortOrder: 21,
  },
  {
    code: "overtime_rule.deactivate",
    nameTh: "ปิดการใช้งานกฎค่าล่วงเวลา",
    nameEn: "Deactivate overtime rule",
    sortOrder: 22,
  },
  { code: "work_location.create", nameTh: "สร้างสถานที่ทำงาน", nameEn: "Create work location", sortOrder: 23 },
  { code: "work_location.update", nameTh: "แก้ไขสถานที่ทำงาน", nameEn: "Update work location", sortOrder: 24 },
  { code: "work_calendar.save", nameTh: "บันทึกปฏิทินการทำงาน", nameEn: "Save work calendar", sortOrder: 25 },
  { code: "holiday.save", nameTh: "บันทึกวันหยุด", nameEn: "Save holiday", sortOrder: 26 },
  { code: "schedule_period.create", nameTh: "สร้างรอบตารางงาน", nameEn: "Create schedule period", sortOrder: 27 },
  { code: "schedule.publish", nameTh: "เผยแพร่ตารางงาน", nameEn: "Publish schedule", sortOrder: 28 },
  { code: "attendance.clock", nameTh: "ลงเวลาทำงาน", nameEn: "Clock attendance", sortOrder: 29 },
  { code: "attendance.adjustment.create", nameTh: "ขอแก้ไขเวลา", nameEn: "Create attendance adjustment", sortOrder: 30 },
  { code: "leave.submit", nameTh: "ส่งคำขอลา", nameEn: "Submit leave request", sortOrder: 31 },
  { code: "leave.review", nameTh: "พิจารณาคำขอลา", nameEn: "Review leave request", sortOrder: 32 },
  { code: "overtime.submit", nameTh: "ส่งคำขอทำงานล่วงเวลา", nameEn: "Submit overtime request", sortOrder: 33 },
  { code: "overtime.review", nameTh: "พิจารณาคำขอทำงานล่วงเวลา", nameEn: "Review overtime request", sortOrder: 34 },
  { code: "payroll_run.create", nameTh: "สร้างการคำนวณเงินเดือน", nameEn: "Create payroll run", sortOrder: 35 },
  { code: "payroll_run.calculate", nameTh: "คำนวณเงินเดือน", nameEn: "Calculate payroll run", sortOrder: 36 },
  { code: "payroll_run.approve", nameTh: "อนุมัติเงินเดือน", nameEn: "Approve payroll run", sortOrder: 37 },
  { code: "payslip.issue", nameTh: "ออกสลิปเงินเดือน", nameEn: "Issue payslip", sortOrder: 38 },
];

export const HR_MASTER_CATALOG = {
  employmentType: EMPLOYMENT_TYPES,
  employeeStatus: EMPLOYEE_STATUSES,
  shiftType: SHIFT_TYPES,
  payFrequency: PAY_FREQUENCIES,
  wageType: WAGE_TYPES,
  overtimeRateType: OVERTIME_RATE_TYPES,
  payrollPeriodStatus: PAYROLL_PERIOD_STATUSES,
  auditActionType: AUDIT_ACTION_TYPES,
} as const;

export type OperationMasterRow = {
  code: string;
  name: string;
  sortOrder?: number;
  isTaxable?: boolean;
  isTaxableReduction?: boolean;
  isRecurringAllowed?: boolean;
};

export const ATTENDANCE_STATUSES: OperationMasterRow[] = [
  { code: "PRESENT", name: "มาทำงาน", sortOrder: 1 },
  { code: "LATE", name: "มาสาย", sortOrder: 2 },
  { code: "EARLY_LEAVE", name: "กลับก่อนเวลา", sortOrder: 3 },
  { code: "ABSENT", name: "ขาดงาน", sortOrder: 4 },
  { code: "LEAVE", name: "ลา", sortOrder: 5 },
  { code: "HOLIDAY", name: "วันหยุด", sortOrder: 6 },
  { code: "REST_DAY", name: "วันหยุดประจำสัปดาห์", sortOrder: 7 },
  { code: "INCOMPLETE", name: "ลงเวลาไม่ครบ", sortOrder: 8 },
  { code: "MISSING_CLOCK_IN", name: "ไม่มีเวลาเข้างาน", sortOrder: 9 },
  { code: "MISSING_CLOCK_OUT", name: "ไม่มีเวลาออกงาน", sortOrder: 10 },
  { code: "WRONG_SHIFT", name: "ลงผิดกะ", sortOrder: 11 },
];
export const ATTENDANCE_EVENT_TYPES: OperationMasterRow[] = [
  { code: "CLOCK_IN", name: "ลงเวลาเข้า", sortOrder: 1 },
  { code: "CLOCK_OUT", name: "ลงเวลาออก", sortOrder: 2 },
  { code: "BREAK_START", name: "เริ่มพัก", sortOrder: 3 },
  { code: "BREAK_END", name: "สิ้นสุดพัก", sortOrder: 4 },
  { code: "OT_START", name: "เริ่มทำงานล่วงเวลา", sortOrder: 5 },
  { code: "OT_END", name: "สิ้นสุดทำงานล่วงเวลา", sortOrder: 6 },
];
const REQUEST_STATUSES: OperationMasterRow[] = [
  { code: "DRAFT", name: "ร่าง", sortOrder: 1 },
  { code: "SUBMITTED", name: "ส่งคำขอแล้ว", sortOrder: 2 },
  { code: "APPROVED", name: "อนุมัติแล้ว", sortOrder: 3 },
  { code: "REJECTED", name: "ไม่อนุมัติ", sortOrder: 4 },
  { code: "CANCELLED", name: "ยกเลิก", sortOrder: 5 },
];
export const LEAVE_REQUEST_STATUSES = REQUEST_STATUSES;
export const OVERTIME_REQUEST_STATUSES = REQUEST_STATUSES;
export const SCHEDULE_PERIOD_STATUSES: OperationMasterRow[] = [
  { code: "DRAFT", name: "ร่าง", sortOrder: 1 },
  { code: "PUBLISHED", name: "เผยแพร่แล้ว", sortOrder: 2 },
  { code: "LOCKED", name: "ล็อกแล้ว", sortOrder: 3 },
];
export const HOLIDAY_TYPES: OperationMasterRow[] = [
  { code: "PUBLIC", name: "วันหยุดราชการ", sortOrder: 1 },
  { code: "COMPANY", name: "วันหยุดบริษัท", sortOrder: 2 },
  { code: "BRANCH", name: "วันหยุดสาขา", sortOrder: 3 },
  { code: "SPECIAL", name: "วันหยุดพิเศษ", sortOrder: 4 },
];
export const LEAVE_UNITS: OperationMasterRow[] = [
  { code: "DAY", name: "วัน", sortOrder: 1 },
  { code: "HALF_DAY", name: "ครึ่งวัน", sortOrder: 2 },
  { code: "HOUR", name: "ชั่วโมง", sortOrder: 3 },
];
export const APPROVAL_ENTITY_TYPES: OperationMasterRow[] = [
  { code: "LEAVE", name: "การลา", sortOrder: 1 },
  { code: "OVERTIME", name: "การทำงานล่วงเวลา", sortOrder: 2 },
  { code: "ATTENDANCE_ADJUSTMENT", name: "คำขอแก้ไขเวลา", sortOrder: 3 },
  { code: "PAYROLL", name: "เงินเดือน", sortOrder: 4 },
];
export const NOTIFICATION_TYPES: OperationMasterRow[] = [
  { code: "LEAVE_SUBMITTED", name: "ส่งคำขอลา", sortOrder: 1 },
  { code: "LEAVE_APPROVED", name: "อนุมัติการลา", sortOrder: 2 },
  { code: "LEAVE_REJECTED", name: "ไม่อนุมัติการลา", sortOrder: 3 },
  { code: "OT_SUBMITTED", name: "ส่งคำขอทำงานล่วงเวลา", sortOrder: 4 },
  { code: "OT_APPROVED", name: "อนุมัติการทำงานล่วงเวลา", sortOrder: 5 },
  { code: "OT_REJECTED", name: "ไม่อนุมัติการทำงานล่วงเวลา", sortOrder: 6 },
  { code: "SCHEDULE_PUBLISHED", name: "เผยแพร่ตารางงาน", sortOrder: 7 },
  { code: "SCHEDULE_CHANGED", name: "เปลี่ยนตารางงาน", sortOrder: 8 },
  { code: "ATTENDANCE_MISSING", name: "ลงเวลาไม่ครบ", sortOrder: 9 },
  { code: "PAYROLL_APPROVED", name: "อนุมัติเงินเดือน", sortOrder: 10 },
  { code: "PAYSLIP_ISSUED", name: "ออกสลิปเงินเดือน", sortOrder: 11 },
];
export const NOTIFICATION_STATUSES: OperationMasterRow[] = [
  { code: "PENDING", name: "รอดำเนินการ", sortOrder: 1 },
  { code: "DELIVERED", name: "ส่งแล้ว", sortOrder: 2 },
  { code: "FAILED", name: "ส่งไม่สำเร็จ", sortOrder: 3 },
  { code: "CANCELLED", name: "ยกเลิก", sortOrder: 4 },
];
export const LEAVE_BALANCE_TX_TYPES: OperationMasterRow[] = [
  { code: "OPENING", name: "ยอดยกมา", sortOrder: 1 },
  { code: "ACCRUAL", name: "สะสมสิทธิ", sortOrder: 2 },
  { code: "USED", name: "ใช้สิทธิ", sortOrder: 3 },
  { code: "ADJUSTMENT", name: "ปรับปรุง", sortOrder: 4 },
  { code: "CARRY_FORWARD", name: "ยกยอด", sortOrder: 5 },
];
export const EARNING_TYPES: OperationMasterRow[] = [
  { code: "BASE_SALARY", name: "เงินเดือนพื้นฐาน" },
  { code: "OVERTIME", name: "ค่าล่วงเวลา" },
  { code: "ALLOWANCE", name: "เงินเพิ่ม", isTaxable: true },
  { code: "BONUS", name: "โบนัส" },
  { code: "COMMISSION", name: "คอมมิชชัน" },
];
export const DEDUCTION_TYPES: OperationMasterRow[] = [
  { code: "TAX", name: "ภาษี" },
  { code: "SOCIAL_SECURITY", name: "ประกันสังคม" },
  { code: "ADVANCE", name: "เบิกล่วงหน้า" },
  { code: "LOAN", name: "หักชำระเงินกู้" },
  { code: "ABSENCE", name: "หักขาดงาน" },
  { code: "OTHER", name: "รายการหักอื่น" },
];

export const HR_OPERATIONS_MASTER_CATALOG = {
  attendanceStatus: ATTENDANCE_STATUSES,
  attendanceEventType: ATTENDANCE_EVENT_TYPES,
  leaveRequestStatus: LEAVE_REQUEST_STATUSES,
  overtimeRequestStatus: OVERTIME_REQUEST_STATUSES,
  schedulePeriodStatus: SCHEDULE_PERIOD_STATUSES,
  holidayType: HOLIDAY_TYPES,
  leaveUnit: LEAVE_UNITS,
  approvalEntityType: APPROVAL_ENTITY_TYPES,
  notificationType: NOTIFICATION_TYPES,
  notificationStatus: NOTIFICATION_STATUSES,
  leaveBalanceTxType: LEAVE_BALANCE_TX_TYPES,
  earningType: EARNING_TYPES,
  deductionType: DEDUCTION_TYPES,
} as const;

export type MasterSeedCounts = Record<
  keyof typeof HR_MASTER_CATALOG | keyof typeof HR_OPERATIONS_MASTER_CATALOG,
  number
>;

/** Idempotent upsert by `code`. Never deletes and never rewrites a code. */
export async function seedHrMasters(
  prisma: PrismaClient,
): Promise<MasterSeedCounts> {
  const counts = {} as MasterSeedCounts;

  for (const key of Object.keys(HR_MASTER_CATALOG) as Array<
    keyof typeof HR_MASTER_CATALOG
  >) {
    const rows = HR_MASTER_CATALOG[key];
    // Delegate names match the Prisma model names in camelCase.
    const delegate = prisma[key] as unknown as {
      upsert(args: {
        where: { code: string };
        update: Omit<MasterRow, "code">;
        create: MasterRow & { isActive: boolean; isSystem: boolean };
      }): Promise<unknown>;
    };

    for (const row of rows) {
      await delegate.upsert({
        where: { code: row.code },
        update: {
          nameTh: row.nameTh,
          nameEn: row.nameEn,
          sortOrder: row.sortOrder,
        },
        create: { ...row, isActive: true, isSystem: true },
      });
    }
    counts[key] = rows.length;
  }

  for (const key of Object.keys(HR_OPERATIONS_MASTER_CATALOG) as Array<
    keyof typeof HR_OPERATIONS_MASTER_CATALOG
  >) {
    const rows = HR_OPERATIONS_MASTER_CATALOG[key];
    const delegate = prisma[key] as unknown as {
      upsert(args: {
        where: { code: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }): Promise<unknown>;
    };
    for (const row of rows) {
      const shared = {
        name: row.name,
        ...(row.sortOrder === undefined ? {} : { sortOrder: row.sortOrder }),
        ...(row.isTaxable === undefined ? {} : { isTaxable: row.isTaxable }),
        ...(row.isTaxableReduction === undefined
          ? {}
          : { isTaxableReduction: row.isTaxableReduction }),
        ...(row.isRecurringAllowed === undefined
          ? {}
          : { isRecurringAllowed: row.isRecurringAllowed }),
      };
      await delegate.upsert({
        where: { code: row.code },
        update: shared,
        create: {
          code: row.code,
          ...shared,
          ...(key === "earningType" || key === "deductionType"
            ? { isActive: true }
            : { isActive: true, isSystem: true }),
        },
      });
    }
    counts[key] = rows.length;
  }

  return counts;
}
