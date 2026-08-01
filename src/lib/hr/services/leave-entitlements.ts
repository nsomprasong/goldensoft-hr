/**
 * Org / branch leave entitlements and employee balance resolution.
 */
import { assertHrPermission, hrCan } from "@/lib/hr/authorize";
import { HrError } from "@/lib/hr/errors";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { prisma } from "@/lib/prisma";
import type { HrServiceContext } from "@/lib/hr/services/shared";

type Db = typeof prisma & Record<string, any>;
const db = prisma as Db;

function bangkokYear(at = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(at);
  return Number(parts.find((p) => p.type === "year")?.value ?? at.getFullYear());
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function masterTxType(code: string) {
  const row = await db.leaveBalanceTxType.findFirst({
    where: { code, isActive: true },
  });
  if (!row) {
    throw new HrError("NOT_FOUND", {
      message: `ไม่พบประเภทธุรกรรมวันลา ${code}`,
    });
  }
  return row;
}

function policyCode(
  leaveTypeCode: string,
  branchId: string | null,
): string {
  if (!branchId) return `ENT_${leaveTypeCode}`.slice(0, 40);
  return `ENT_${leaveTypeCode}_${branchId.replace(/-/g, "").slice(0, 8)}`.slice(
    0,
    40,
  );
}

export type ResolvedEntitlement = {
  leaveTypeId: string;
  annualEntitlement: number;
  source: "branch" | "org" | "none";
  policyId: string | null;
  branchId: string | null;
};

/** Branch override if present, else org default. */
export async function resolveAnnualEntitlement(
  organizationId: string,
  leaveTypeId: string,
  branchId: string | null | undefined,
): Promise<ResolvedEntitlement> {
  const today = new Date();
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
  }).format(today);
  const asOf = new Date(`${todayIso}T00:00:00.000Z`);

  const activeFilter = {
    organizationId,
    leaveTypeId,
    isActive: true,
    effectiveFrom: { lte: asOf },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
  };

  if (branchId) {
    const branchPolicy = await db.leavePolicy.findFirst({
      where: { ...activeFilter, branchId },
      orderBy: { effectiveFrom: "desc" },
    });
    if (branchPolicy) {
      return {
        leaveTypeId,
        annualEntitlement: num(branchPolicy.annualEntitlement),
        source: "branch",
        policyId: branchPolicy.id,
        branchId,
      };
    }
  }

  const orgPolicy = await db.leavePolicy.findFirst({
    where: { ...activeFilter, branchId: null },
    orderBy: { effectiveFrom: "desc" },
  });
  if (orgPolicy) {
    return {
      leaveTypeId,
      annualEntitlement: num(orgPolicy.annualEntitlement),
      source: "org",
      policyId: orgPolicy.id,
      branchId: null,
    };
  }

  return {
    leaveTypeId,
    annualEntitlement: 0,
    source: "none",
    policyId: null,
    branchId: branchId ?? null,
  };
}

export async function listLeaveEntitlementSettings(ctx: HrServiceContext) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.leaveManage,
    HR_PERMISSIONS.settingsManage,
  ]);

  const [types, policies] = await Promise.all([
    db.leaveType.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      include: { unit: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    db.leavePolicy.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      orderBy: [{ leaveTypeId: "asc" }, { branchId: "asc" }],
    }),
  ]);

  return {
    leaveTypes: types.map(
      (type: {
        id: string;
        code: string;
        name: string;
        unit: { code: string; name: string } | null;
      }) => ({
        id: type.id,
        code: type.code,
        name: type.name,
        unitName: type.unit?.name ?? "วัน",
      }),
    ),
    policies: policies.map(
      (policy: {
        id: string;
        leaveTypeId: string;
        branchId: string | null;
        annualEntitlement: unknown;
        code: string;
        name: string;
      }) => ({
        id: policy.id,
        leaveTypeId: policy.leaveTypeId,
        branchId: policy.branchId,
        annualEntitlement: num(policy.annualEntitlement),
        code: policy.code,
        name: policy.name,
      }),
    ),
  };
}

export async function upsertLeaveEntitlement(
  ctx: HrServiceContext,
  input: {
    leaveTypeId: string;
    branchId?: string | null;
    annualEntitlement: number;
    /** When true for a branch, delete override so branch inherits org. */
    inheritFromOrg?: boolean;
  },
) {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.leaveManage,
    HR_PERMISSIONS.settingsManage,
  ]);

  const leaveTypeId = String(input.leaveTypeId ?? "").trim();
  const branchId =
    typeof input.branchId === "string" && input.branchId.trim()
      ? input.branchId.trim()
      : null;
  const leaveType = await db.leaveType.findFirst({
    where: {
      id: leaveTypeId,
      organizationId: ctx.organizationId,
      isActive: true,
    },
  });
  if (!leaveType) {
    throw new HrError("VALIDATION_ERROR", { message: "ไม่พบประเภทการลา" });
  }

  if (branchId && input.inheritFromOrg) {
    await db.leavePolicy.updateMany({
      where: {
        organizationId: ctx.organizationId,
        leaveTypeId,
        branchId,
        isActive: true,
      },
      data: { isActive: false, effectiveTo: new Date() },
    });
    return { ok: true, inherited: true, leaveTypeId, branchId };
  }

  const entitlement = Number(input.annualEntitlement);
  if (!Number.isFinite(entitlement) || entitlement < 0) {
    throw new HrError("VALIDATION_ERROR", {
      message: "จำนวนวันลาต้องเป็นตัวเลขไม่ติดลบ",
    });
  }

  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
  }).format(new Date());
  const effectiveFrom = new Date(`${todayIso}T00:00:00.000Z`);
  const code = policyCode(leaveType.code, branchId);
  const name = branchId
    ? `${leaveType.name} (สาขา)`
    : `${leaveType.name} (องค์กร)`;

  const existing = await db.leavePolicy.findFirst({
    where: {
      organizationId: ctx.organizationId,
      leaveTypeId,
      branchId,
      isActive: true,
    },
  });

  if (existing) {
    return db.leavePolicy.update({
      where: { id: existing.id },
      data: {
        annualEntitlement: entitlement,
        name,
        code: existing.code || code,
      },
    });
  }

  return db.leavePolicy.create({
    data: {
      organizationId: ctx.organizationId,
      leaveTypeId,
      branchId,
      code,
      name,
      annualEntitlement: entitlement,
      effectiveFrom,
      isActive: true,
    },
  });
}

async function pendingSubmittedAmount(
  employeeId: string,
  leaveTypeId: string,
  year: number,
  excludeRequestId?: string,
): Promise<number> {
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${year}-12-31T00:00:00.000Z`);
  const rows = await db.leaveRequest.findMany({
    where: {
      employeeId,
      leaveTypeId,
      status: { code: "SUBMITTED" },
      startDate: { lte: yearEnd },
      endDate: { gte: yearStart },
      ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
    },
    select: { requestedAmount: true },
  });
  return rows.reduce(
    (sum: number, row: { requestedAmount: unknown }) =>
      sum + num(row.requestedAmount),
    0,
  );
}

/** Ensure balance row exists and opening matches current entitlement. */
export async function syncEmployeeLeaveBalance(input: {
  employeeId: string;
  leaveTypeId: string;
  balanceYear: number;
  annualEntitlement: number;
}) {
  const entitled = Math.max(0, input.annualEntitlement);
  const existing = await db.employeeLeaveBalance.findUnique({
    where: {
      employeeId_leaveTypeId_balanceYear: {
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        balanceYear: input.balanceYear,
      },
    },
  });

  if (!existing) {
    return db.employeeLeaveBalance.create({
      data: {
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        balanceYear: input.balanceYear,
        openingBalance: entitled,
        accruedBalance: 0,
        usedBalance: 0,
        adjustedBalance: 0,
        availableBalance: entitled,
      },
    });
  }

  const used = num(existing.usedBalance);
  const adjusted = num(existing.adjustedBalance);
  const accrued = num(existing.accruedBalance);
  const available = entitled + accrued - used + adjusted;
  return db.employeeLeaveBalance.update({
    where: { id: existing.id },
    data: {
      openingBalance: entitled,
      availableBalance: available,
    },
  });
}

async function resolveSelfEmployeeRow(ctx: HrServiceContext) {
  const employee = await db.employee.findFirst({
    where: {
      organizationId: ctx.organizationId,
      authUserId: ctx.actorAuthUserId,
    },
  });
  if (!employee) {
    throw new HrError("NOT_FOUND", {
      message: "บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลพนักงาน",
    });
  }
  return employee;
}

export async function listSelfLeaveBalances(ctx: HrServiceContext) {
  assertHrPermission(ctx, HR_PERMISSIONS.leaveSelf);
  const employee = await resolveSelfEmployeeRow(ctx);
  const year = bangkokYear();
  const types = await db.leaveType.findMany({
    where: { organizationId: ctx.organizationId, isActive: true },
    orderBy: { name: "asc" },
  });

  const rows = [];
  for (const type of types as Array<{ id: string; code: string; name: string }>) {
    const resolved = await resolveAnnualEntitlement(
      ctx.organizationId,
      type.id,
      employee.branchId,
    );
    const balance = await syncEmployeeLeaveBalance({
      employeeId: employee.id,
      leaveTypeId: type.id,
      balanceYear: year,
      annualEntitlement: resolved.annualEntitlement,
    });
    const used = num(balance.usedBalance);
    const pending = await pendingSubmittedAmount(employee.id, type.id, year);
    const entitled = resolved.annualEntitlement;
    const remaining = Math.max(0, entitled - used - pending);
    rows.push({
      leaveTypeId: type.id,
      leaveTypeCode: type.code,
      leaveTypeName: type.name,
      balanceYear: year,
      entitled,
      used,
      pending,
      remaining,
      source: resolved.source,
    });
  }
  return { employeeId: employee.id, branchId: employee.branchId, year, rows };
}

export async function assertLeaveBalanceAvailable(
  ctx: HrServiceContext,
  input: {
    employeeId: string;
    leaveTypeId: string;
    requestedAmount: number;
    branchId: string;
    excludeRequestId?: string;
  },
) {
  const year = bangkokYear();
  const resolved = await resolveAnnualEntitlement(
    ctx.organizationId,
    input.leaveTypeId,
    input.branchId,
  );
  const balance = await syncEmployeeLeaveBalance({
    employeeId: input.employeeId,
    leaveTypeId: input.leaveTypeId,
    balanceYear: year,
    annualEntitlement: resolved.annualEntitlement,
  });
  const pending = await pendingSubmittedAmount(
    input.employeeId,
    input.leaveTypeId,
    year,
    input.excludeRequestId,
  );
  const remaining =
    resolved.annualEntitlement -
    num(balance.usedBalance) -
    pending;
  if (input.requestedAmount > remaining + 1e-9) {
    throw new HrError("VALIDATION_ERROR", {
      message: `วันลาคงเหลือไม่พอ (เหลือ ${Math.max(0, remaining)} วัน)`,
    });
  }
}

export async function applyApprovedLeaveUsage(
  ctx: HrServiceContext,
  input: {
    leaveRequestId: string;
    employeeId: string;
    leaveTypeId: string;
    branchId: string;
    requestedAmount: number;
    workDate: Date;
  },
) {
  const year = bangkokYear(input.workDate);
  const resolved = await resolveAnnualEntitlement(
    ctx.organizationId,
    input.leaveTypeId,
    input.branchId,
  );
  const balance = await syncEmployeeLeaveBalance({
    employeeId: input.employeeId,
    leaveTypeId: input.leaveTypeId,
    balanceYear: year,
    annualEntitlement: resolved.annualEntitlement,
  });

  const existingTx = await db.leaveBalanceTransaction.findFirst({
    where: { leaveRequestId: input.leaveRequestId },
  });
  if (existingTx) return balance;

  const amount = Math.abs(input.requestedAmount);
  const used = num(balance.usedBalance) + amount;
  const available =
    resolved.annualEntitlement +
    num(balance.accruedBalance) -
    used +
    num(balance.adjustedBalance);
  const usedType = await masterTxType("USED");

  await db.$transaction([
    db.employeeLeaveBalance.update({
      where: { id: balance.id },
      data: { usedBalance: used, availableBalance: available },
    }),
    db.leaveBalanceTransaction.create({
      data: {
        employeeLeaveBalanceId: balance.id,
        transactionTypeId: usedType.id,
        leaveRequestId: input.leaveRequestId,
        occurredOn: input.workDate,
        amount: -amount,
        balanceAfter: available,
        notes: "หักจากการอนุมัติลา",
        createdByAuthUserId: ctx.actorAuthUserId,
      },
    }),
  ]);
}

export async function reverseLeaveUsageIfAny(leaveRequestId: string) {
  const tx = await db.leaveBalanceTransaction.findFirst({
    where: { leaveRequestId },
    include: { employeeLeaveBalance: true },
  });
  if (!tx) return;
  const balance = tx.employeeLeaveBalance;
  const amount = Math.abs(num(tx.amount));
  const used = Math.max(0, num(balance.usedBalance) - amount);
  const available =
    num(balance.openingBalance) +
    num(balance.accruedBalance) -
    used +
    num(balance.adjustedBalance);
  await db.$transaction([
    db.employeeLeaveBalance.update({
      where: { id: balance.id },
      data: { usedBalance: used, availableBalance: available },
    }),
    db.leaveBalanceTransaction.delete({ where: { id: tx.id } }),
  ]);
}

/** Ensure at least one org default policy exists for each active leave type. */
export async function ensureDefaultLeavePolicies(
  ctx: HrServiceContext,
  defaults: Array<{ leaveTypeId: string; annualEntitlement: number }>,
) {
  if (!hrCan(ctx, HR_PERMISSIONS.leaveManage) && !hrCan(ctx, HR_PERMISSIONS.settingsManage)) {
    return;
  }
  for (const row of defaults) {
    const existing = await db.leavePolicy.findFirst({
      where: {
        organizationId: ctx.organizationId,
        leaveTypeId: row.leaveTypeId,
        branchId: null,
        isActive: true,
      },
    });
    if (existing) continue;
    await upsertLeaveEntitlement(ctx, {
      leaveTypeId: row.leaveTypeId,
      branchId: null,
      annualEntitlement: row.annualEntitlement,
    });
  }
}
