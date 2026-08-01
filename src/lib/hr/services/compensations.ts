/**
 * Employee compensation history.
 *
 * The table is append-only: adding a new effective record closes the previous
 * one rather than editing it, so the wage history behind any past payroll run
 * stays reconstructable. Nothing here ever hard-deletes a row.
 */
import {
  assertBranchInScope,
  assertHrPermission,
  hrCan,
} from "@/lib/hr/authorize";
import { HR_AUDIT_ACTIONS, writeHrAudit } from "@/lib/hr/audit";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { addDays, toDateOnly } from "@/lib/hr/payroll-rules";
import type {
  CompensationRecord,
  HrRepository,
} from "@/lib/hr/repository/types";
import {
  requireActiveMaster,
  type HrServiceContext,
} from "@/lib/hr/services/shared";

export type CompensationCreateData = {
  wageTypeId: string;
  amount: number;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null;
  currency?: string;
  standardHoursPerDay?: number | null;
  standardDaysPerMonth?: number | null;
  overtimeEligible?: boolean;
};

async function requireEmployeeInScope(
  repository: HrRepository,
  ctx: HrServiceContext,
  employeeId: string,
) {
  const employee = await repository.employees.findById(
    ctx.organizationId,
    employeeId,
  );
  if (!employee) throw new HrError("NOT_FOUND", { details: { employeeId } });
  assertBranchInScope(ctx, employee.branchId);
  return employee;
}

export async function listCompensations(
  repository: HrRepository,
  ctx: HrServiceContext,
  employeeId: string,
): Promise<CompensationRecord[]> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.compensationRead,
    HR_PERMISSIONS.compensationManage,
  ]);
  await requireEmployeeInScope(repository, ctx, employeeId);
  return repository.compensations.listByEmployee(employeeId);
}

export async function getCurrentCompensation(
  repository: HrRepository,
  ctx: HrServiceContext,
  employeeId: string,
): Promise<CompensationRecord | null> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.compensationRead,
    HR_PERMISSIONS.compensationManage,
  ]);
  await requireEmployeeInScope(repository, ctx, employeeId);
  return repository.compensations.findCurrent(employeeId);
}

function overlaps(
  existing: CompensationRecord,
  newFrom: Date,
  newTo: Date | null,
): boolean {
  const existingFrom = existing.effectiveFrom.getTime();
  const existingTo = existing.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const from = newFrom.getTime();
  const to = newTo?.getTime() ?? Number.POSITIVE_INFINITY;
  return from <= existingTo && existingFrom <= to;
}

export async function addCompensation(
  repository: HrRepository,
  ctx: HrServiceContext,
  employeeId: string,
  data: CompensationCreateData,
): Promise<CompensationRecord> {
  const canManagePay = hrCan(ctx, HR_PERMISSIONS.compensationManage);
  const canHireWage = hrCan(ctx, HR_PERMISSIONS.employeeCreate);
  if (!canManagePay && !canHireWage) {
    assertHrPermission(ctx, HR_PERMISSIONS.compensationManage);
  }
  await requireEmployeeInScope(repository, ctx, employeeId);

  if (!Number.isFinite(data.amount) || data.amount < 0) {
    throw new HrError("NEGATIVE_AMOUNT", { details: { amount: data.amount } });
  }

  await requireActiveMaster(repository, "wageType", data.wageTypeId);

  const effectiveFrom = toDateOnly(data.effectiveFrom);
  const effectiveTo = data.effectiveTo ? toDateOnly(data.effectiveTo) : null;
  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    throw new HrError("VALIDATION_ERROR", {
      message: "วันสิ้นสุดค่าจ้างต้องไม่ก่อนวันเริ่มมีผล",
    });
  }

  const history = await repository.compensations.listByEmployee(employeeId);
  // Hiring flow may set the first wage without full compensation.manage.
  if (!canManagePay && history.length > 0) {
    throw new HrError("FORBIDDEN", {
      message: "การปรับค่าจ้างครั้งถัดไปต้องมีสิทธิ์จัดการค่าตอบแทน",
    });
  }

  // Prefer the open current row; fall back to latest isCurrent flag.
  const current =
    history.find((row) => row.effectiveTo === null) ??
    history.find((row) => row.isCurrent) ??
    null;

  const currency = (data.currency ?? "THB").toUpperCase();
  const standardHoursPerDay = data.standardHoursPerDay ?? null;
  const standardDaysPerMonth = data.standardDaysPerMonth ?? null;
  const overtimeEligible = data.overtimeEligible ?? true;

  // Same effective start as current → correct/edit in place (not a new history row).
  if (
    current &&
    effectiveFrom.getTime() === current.effectiveFrom.getTime() &&
    (effectiveTo?.getTime() ?? null) ===
      (current.effectiveTo?.getTime() ?? null)
  ) {
    if (!canManagePay) {
      throw new HrError("FORBIDDEN", {
        message: "การแก้ค่าจ้างต้องมีสิทธิ์จัดการค่าตอบแทน",
      });
    }
    const updated = await repository.compensations.update(current.id, {
      wageTypeId: data.wageTypeId,
      amount: data.amount,
      currency,
      standardHoursPerDay,
      standardDaysPerMonth,
      overtimeEligible,
      isCurrent: effectiveTo === null,
    });
    await writeHrAudit(repository, {
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      actorAuthUserId: ctx.actorAuthUserId,
      actionCode: HR_AUDIT_ACTIONS.compensationAdd,
      entityType: "employee_compensation",
      entityId: updated.id,
      after: {
        employeeId,
        wageTypeId: updated.wageTypeId,
        currency: updated.currency,
        amount: updated.amount,
        effectiveFrom: updated.effectiveFrom,
        effectiveTo: updated.effectiveTo,
      },
    });
    return updated;
  }

  // The open-ended current record is closed the day before the new one starts;
  // anything else that would straddle the new range is a genuine conflict.
  for (const row of history) {
    if (row === current) continue;
    if (overlaps(row, effectiveFrom, effectiveTo)) {
      throw new HrError("OVERLAP_COMPENSATION", {
        details: { conflictingId: row.id },
      });
    }
  }

  if (current) {
    if (effectiveFrom.getTime() <= current.effectiveFrom.getTime()) {
      throw new HrError("OVERLAP_COMPENSATION", {
        message:
          "วันมีผลต้องหลังค่าจ้างปัจจุบัน หรือใช้วันเดิมเพื่อแก้ไขรายการปัจจุบัน",
        details: { conflictingId: current.id },
      });
    }
    await repository.compensations.update(current.id, {
      effectiveTo: addDays(effectiveFrom, -1),
      isCurrent: false,
    });
  }

  const created = await repository.compensations.create({
    employeeId,
    wageTypeId: data.wageTypeId,
    amount: data.amount,
    currency,
    effectiveFrom,
    effectiveTo,
    standardHoursPerDay,
    standardDaysPerMonth,
    overtimeEligible,
    isCurrent: effectiveTo === null,
    createdBy: ctx.actorAuthUserId,
  });

  // Amount is masked inside writeHrAudit — the trail records the change, not the pay.
  await writeHrAudit(repository, {
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    actorAuthUserId: ctx.actorAuthUserId,
    actionCode: HR_AUDIT_ACTIONS.compensationAdd,
    entityType: "employee_compensation",
    entityId: created.id,
    after: {
      employeeId,
      wageTypeId: created.wageTypeId,
      currency: created.currency,
      amount: created.amount,
      effectiveFrom: created.effectiveFrom,
      effectiveTo: created.effectiveTo,
    },
  });

  return created;
}
