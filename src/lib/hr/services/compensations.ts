/**
 * Employee compensation history.
 *
 * The table is append-only: adding a new effective record closes the previous
 * one rather than editing it, so the wage history behind any past payroll run
 * stays reconstructable. Nothing here ever hard-deletes a row.
 */
import { assertBranchInScope, assertHrPermission } from "@/lib/hr/authorize";
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
  assertHrPermission(ctx, HR_PERMISSIONS.compensationManage);
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

  // The open-ended current record is closed the day before the new one starts;
  // anything else that would straddle the new range is a genuine conflict.
  const current = history.find((row) => row.effectiveTo === null);
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
    currency: (data.currency ?? "THB").toUpperCase(),
    effectiveFrom,
    effectiveTo,
    standardHoursPerDay: data.standardHoursPerDay ?? null,
    standardDaysPerMonth: data.standardDaysPerMonth ?? null,
    overtimeEligible: data.overtimeEligible ?? true,
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
