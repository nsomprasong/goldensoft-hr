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

export type MasterSeedCounts = Record<keyof typeof HR_MASTER_CATALOG, number>;

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

  return counts;
}
