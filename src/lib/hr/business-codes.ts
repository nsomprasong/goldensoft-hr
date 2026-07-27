/** Allocate the next tenant-scoped business code (EMP- / DEPT- / POS- / …). */

import type { HrRepository } from "@/lib/hr/repository/types";
import { HrError } from "@/lib/hr/errors";

const DEFAULT_PAD = 4;
const MAX_SCAN = 50_000;

export function allocateNextCode(
  existing: readonly string[],
  prefix: string,
  pad = DEFAULT_PAD,
): string {
  let max = 0;
  for (const code of existing) {
    if (!code.startsWith(prefix)) continue;
    const suffix = code.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    const n = Number(suffix);
    if (Number.isFinite(n) && n > max) max = n;
  }
  const next = max + 1;
  if (next > 10 ** pad - 1 && pad === DEFAULT_PAD) {
    // Grow beyond 4 digits when needed (EMP-10000).
    return `${prefix}${String(next)}`;
  }
  return `${prefix}${String(next).padStart(pad, "0")}`;
}

async function assertFree(
  find: () => Promise<unknown | null>,
  code: string,
  label: string,
): Promise<string> {
  const clash = await find();
  if (clash) {
    throw new HrError("DUPLICATE_CODE", {
      message: `ไม่สามารถสร้าง${label}อัตโนมัติได้ กรุณาลองใหม่`,
      details: { code },
    });
  }
  return code;
}

export async function nextEmployeeCode(
  repository: HrRepository,
  organizationId: string,
): Promise<string> {
  const page = await repository.employees.list({
    organizationId,
    skip: 0,
    take: MAX_SCAN,
  });
  const code = allocateNextCode(
    page.rows.map((row) => row.employeeCode),
    "EMP-",
  );
  return assertFree(
    () => repository.employees.findByCode(organizationId, code),
    code,
    "รหัสพนักงาน",
  );
}

export async function nextDepartmentCode(
  repository: HrRepository,
  organizationId: string,
): Promise<string> {
  const page = await repository.departments.list({
    organizationId,
    skip: 0,
    take: MAX_SCAN,
  });
  const code = allocateNextCode(
    page.rows.map((row) => row.code),
    "DEPT-",
  );
  return assertFree(
    () => repository.departments.findByCode(organizationId, code),
    code,
    "รหัสแผนก",
  );
}

export async function nextPositionCode(
  repository: HrRepository,
  organizationId: string,
): Promise<string> {
  const page = await repository.positions.list({
    organizationId,
    skip: 0,
    take: MAX_SCAN,
  });
  const code = allocateNextCode(
    page.rows.map((row) => row.code),
    "POS-",
  );
  return assertFree(
    () => repository.positions.findByCode(organizationId, code),
    code,
    "รหัสตำแหน่ง",
  );
}

export async function nextShiftCode(
  repository: HrRepository,
  organizationId: string,
): Promise<string> {
  const page = await repository.shifts.list({
    organizationId,
    skip: 0,
    take: MAX_SCAN,
  });
  const code = allocateNextCode(
    page.rows.map((row) => row.code),
    "SHIFT-",
  );
  return assertFree(
    () => repository.shifts.findByCode(organizationId, code),
    code,
    "รหัสกะ",
  );
}

export async function nextOvertimeRuleCode(
  repository: HrRepository,
  organizationId: string,
): Promise<string> {
  const page = await repository.overtimeRules.list({
    organizationId,
    skip: 0,
    take: MAX_SCAN,
  });
  const code = allocateNextCode(
    page.rows.map((row) => row.code),
    "OTR-",
  );
  return assertFree(
    () => repository.overtimeRules.findByCode(organizationId, code),
    code,
    "รหัสกฎ OT",
  );
}

export async function nextPayrollScheduleCode(
  repository: HrRepository,
  organizationId: string,
): Promise<string> {
  const page = await repository.payrollSchedules.list({
    organizationId,
    skip: 0,
    take: MAX_SCAN,
  });
  const code = allocateNextCode(
    page.rows.map((row) => row.code),
    "PAY-",
  );
  return assertFree(
    () => repository.payrollSchedules.findByCode(organizationId, code),
    code,
    "รหัสรอบจ่าย",
  );
}

/** Used by operational services that talk to Prisma directly. */
export function nextCodeFromList(
  existing: readonly string[],
  prefix: string,
): string {
  return allocateNextCode(existing, prefix);
}
