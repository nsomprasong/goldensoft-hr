import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { assertHrPermission } from "@/lib/hr/authorize";
import { HrError } from "@/lib/hr/errors";
import type { PayrollDeductionRateConfig } from "@/lib/hr/payroll-calc";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { HrServiceContext } from "@/lib/hr/services/shared";
import { isTaxMethod, type TaxMethod } from "@/lib/hr/thai-tax";

export type PayrollDeductionSettingsRow = {
  id: string;
  organizationId: string;
  taxEnabled: boolean;
  taxMethod: TaxMethod;
  taxRatePercent: number;
  taxPersonalAllowance: number;
  taxExpenseDeductionEnabled: boolean;
  socialSecurityEnabled: boolean;
  socialSecurityRatePercent: number;
  socialSecurityMaxAmount: number;
  socialSecurityWageBaseMin: number;
  socialSecurityWageBaseMax: number;
  lateDeductionEnabled: boolean;
  /** 0 = derive from daily wage ÷ 8 ÷ 60 */
  lateBahtPerMinute: number;
  absenceDeductionEnabled: boolean;
  /** 0 = one day wage */
  absenceBahtPerDay: number;
  updatedAt: string;
};

export type AttendancePaySettingsInput = {
  lateDeductionEnabled: boolean;
  lateBahtPerMinute: number;
  absenceDeductionEnabled: boolean;
  absenceBahtPerDay: number;
};

const DEFAULTS = {
  taxEnabled: true,
  taxMethod: "FLAT" as TaxMethod,
  taxRatePercent: 3,
  taxPersonalAllowance: 60_000,
  taxExpenseDeductionEnabled: true,
  socialSecurityEnabled: true,
  socialSecurityRatePercent: 5,
  socialSecurityMaxAmount: 750,
  socialSecurityWageBaseMin: 1_650,
  socialSecurityWageBaseMax: 15_000,
  lateDeductionEnabled: true,
  lateBahtPerMinute: 0,
  absenceDeductionEnabled: true,
  absenceBahtPerDay: 0,
} as const;

type DbRow = {
  id: string;
  organization_id: string;
  tax_enabled: boolean;
  tax_method: string | null;
  tax_rate_percent: string | number;
  tax_personal_allowance: string | number | null;
  tax_expense_deduction_enabled: boolean | null;
  social_security_enabled: boolean;
  social_security_rate_percent: string | number;
  social_security_max_amount: string | number;
  social_security_wage_base_min: string | number | null;
  social_security_wage_base_max: string | number | null;
  late_deduction_enabled: boolean;
  late_baht_per_minute: string | number;
  absence_deduction_enabled: boolean;
  absence_baht_per_day: string | number;
  updated_at: Date;
};

function toRow(row: DbRow): PayrollDeductionSettingsRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    taxEnabled: row.tax_enabled,
    taxMethod: isTaxMethod(row.tax_method) ? row.tax_method : DEFAULTS.taxMethod,
    taxRatePercent: Number(row.tax_rate_percent),
    taxPersonalAllowance: Number(
      row.tax_personal_allowance ?? DEFAULTS.taxPersonalAllowance,
    ),
    taxExpenseDeductionEnabled:
      row.tax_expense_deduction_enabled ?? DEFAULTS.taxExpenseDeductionEnabled,
    socialSecurityEnabled: row.social_security_enabled,
    socialSecurityRatePercent: Number(row.social_security_rate_percent),
    socialSecurityMaxAmount: Number(row.social_security_max_amount),
    socialSecurityWageBaseMin: Number(
      row.social_security_wage_base_min ?? DEFAULTS.socialSecurityWageBaseMin,
    ),
    socialSecurityWageBaseMax: Number(
      row.social_security_wage_base_max ?? DEFAULTS.socialSecurityWageBaseMax,
    ),
    lateDeductionEnabled: row.late_deduction_enabled,
    lateBahtPerMinute: Number(row.late_baht_per_minute),
    absenceDeductionEnabled: row.absence_deduction_enabled,
    absenceBahtPerDay: Number(row.absence_baht_per_day),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toDeductionRateConfig(
  row: PayrollDeductionSettingsRow | null,
): PayrollDeductionRateConfig | null {
  if (!row) return null;
  return {
    taxEnabled: row.taxEnabled,
    taxMethod: row.taxMethod,
    taxRatePercent: row.taxRatePercent,
    taxPersonalAllowance: row.taxPersonalAllowance,
    taxExpenseDeductionEnabled: row.taxExpenseDeductionEnabled,
    socialSecurityEnabled: row.socialSecurityEnabled,
    socialSecurityRatePercent: row.socialSecurityRatePercent,
    socialSecurityMaxAmount: row.socialSecurityMaxAmount,
    socialSecurityWageBaseMin: row.socialSecurityWageBaseMin,
    socialSecurityWageBaseMax: row.socialSecurityWageBaseMax,
  };
}

async function findSettingsRow(
  organizationId: string,
): Promise<DbRow | null> {
  try {
    const rows = await prisma.$queryRaw<DbRow[]>`
      SELECT
        id::text AS id,
        organization_id::text AS organization_id,
        tax_enabled,
        COALESCE(tax_method, 'FLAT') AS tax_method,
        tax_rate_percent,
        COALESCE(tax_personal_allowance, 60000) AS tax_personal_allowance,
        COALESCE(tax_expense_deduction_enabled, true) AS tax_expense_deduction_enabled,
        social_security_enabled,
        social_security_rate_percent,
        social_security_max_amount,
        COALESCE(social_security_wage_base_min, 1650) AS social_security_wage_base_min,
        COALESCE(social_security_wage_base_max, 15000) AS social_security_wage_base_max,
        COALESCE(late_deduction_enabled, true) AS late_deduction_enabled,
        COALESCE(late_baht_per_minute, 0) AS late_baht_per_minute,
        COALESCE(absence_deduction_enabled, true) AS absence_deduction_enabled,
        COALESCE(absence_baht_per_day, 0) AS absence_baht_per_day,
        updated_at
      FROM hr.payroll_deduction_settings
      WHERE organization_id = ${organizationId}::uuid
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    // Pre-0016 schema fallback
    const rows = await prisma.$queryRaw<DbRow[]>`
      SELECT
        id::text AS id,
        organization_id::text AS organization_id,
        tax_enabled,
        'FLAT' AS tax_method,
        tax_rate_percent,
        60000 AS tax_personal_allowance,
        true AS tax_expense_deduction_enabled,
        social_security_enabled,
        social_security_rate_percent,
        social_security_max_amount,
        1650 AS social_security_wage_base_min,
        15000 AS social_security_wage_base_max,
        COALESCE(late_deduction_enabled, true) AS late_deduction_enabled,
        COALESCE(late_baht_per_minute, 0) AS late_baht_per_minute,
        COALESCE(absence_deduction_enabled, true) AS absence_deduction_enabled,
        COALESCE(absence_baht_per_day, 0) AS absence_baht_per_day,
        updated_at
      FROM hr.payroll_deduction_settings
      WHERE organization_id = ${organizationId}::uuid
      LIMIT 1
    `;
    return rows[0] ?? null;
  }
}

function defaultRow(organizationId: string): PayrollDeductionSettingsRow {
  return {
    id: "",
    organizationId,
    ...DEFAULTS,
    updatedAt: new Date(0).toISOString(),
  };
}

/** Returns defaults (not persisted) when the org has never saved settings. */
export async function getPayrollDeductionSettings(
  ctx: HrServiceContext,
): Promise<PayrollDeductionSettingsRow> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.payrollRead,
    HR_PERMISSIONS.payrollManage,
    HR_PERMISSIONS.settingsManage,
  ]);
  const existing = await findSettingsRow(ctx.organizationId);
  if (existing) return toRow(existing);
  return defaultRow(ctx.organizationId);
}

export async function upsertPayrollDeductionSettings(
  ctx: HrServiceContext,
  input: {
    taxEnabled: boolean;
    taxMethod?: unknown;
    taxRatePercent: number;
    taxPersonalAllowance?: number;
    taxExpenseDeductionEnabled?: boolean;
    socialSecurityEnabled: boolean;
    socialSecurityRatePercent: number;
    socialSecurityMaxAmount: number;
    socialSecurityWageBaseMin?: number;
    socialSecurityWageBaseMax?: number;
  },
): Promise<PayrollDeductionSettingsRow> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.payrollManage,
    HR_PERMISSIONS.settingsManage,
  ]);
  const taxMethod: TaxMethod = isTaxMethod(input.taxMethod)
    ? input.taxMethod
    : DEFAULTS.taxMethod;
  const taxRatePercent = Math.max(0, Number(input.taxRatePercent) || 0);
  const taxPersonalAllowance = Math.max(
    0,
    Number(input.taxPersonalAllowance ?? DEFAULTS.taxPersonalAllowance) || 0,
  );
  const taxExpenseDeductionEnabled =
    input.taxExpenseDeductionEnabled !== false;
  const socialSecurityRatePercent = Math.max(
    0,
    Number(input.socialSecurityRatePercent) || 0,
  );
  const socialSecurityMaxAmount = Math.max(
    0,
    Number(input.socialSecurityMaxAmount) || 0,
  );
  const socialSecurityWageBaseMin = Math.max(
    0,
    Number(input.socialSecurityWageBaseMin ?? DEFAULTS.socialSecurityWageBaseMin) ||
      0,
  );
  const socialSecurityWageBaseMax = Math.max(
    0,
    Number(input.socialSecurityWageBaseMax ?? DEFAULTS.socialSecurityWageBaseMax) ||
      0,
  );
  if (socialSecurityWageBaseMax < socialSecurityWageBaseMin) {
    throw new HrError("VALIDATION_ERROR", {
      message: "เพดานฐานประกันสังคมต้องไม่ต่ำกว่าฐานขั้นต่ำ",
    });
  }

  const existing = await findSettingsRow(ctx.organizationId);
  if (existing) {
    await prisma.$executeRaw`
      UPDATE hr.payroll_deduction_settings
      SET
        tax_enabled = ${Boolean(input.taxEnabled)},
        tax_method = ${taxMethod},
        tax_rate_percent = ${taxRatePercent},
        tax_personal_allowance = ${taxPersonalAllowance},
        tax_expense_deduction_enabled = ${taxExpenseDeductionEnabled},
        social_security_enabled = ${Boolean(input.socialSecurityEnabled)},
        social_security_rate_percent = ${socialSecurityRatePercent},
        social_security_max_amount = ${socialSecurityMaxAmount},
        social_security_wage_base_min = ${socialSecurityWageBaseMin},
        social_security_wage_base_max = ${socialSecurityWageBaseMax},
        updated_by_auth_user_id = ${ctx.actorAuthUserId}::uuid,
        updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = ${ctx.organizationId}::uuid
    `;
  } else {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO hr.payroll_deduction_settings (
        id, organization_id,
        tax_enabled, tax_method, tax_rate_percent,
        tax_personal_allowance, tax_expense_deduction_enabled,
        social_security_enabled, social_security_rate_percent,
        social_security_max_amount,
        social_security_wage_base_min, social_security_wage_base_max,
        updated_by_auth_user_id
      ) VALUES (
        ${id}::uuid,
        ${ctx.organizationId}::uuid,
        ${Boolean(input.taxEnabled)},
        ${taxMethod},
        ${taxRatePercent},
        ${taxPersonalAllowance},
        ${taxExpenseDeductionEnabled},
        ${Boolean(input.socialSecurityEnabled)},
        ${socialSecurityRatePercent},
        ${socialSecurityMaxAmount},
        ${socialSecurityWageBaseMin},
        ${socialSecurityWageBaseMax},
        ${ctx.actorAuthUserId}::uuid
      )
    `;
  }
  const row = await findSettingsRow(ctx.organizationId);
  return row ? toRow(row) : defaultRow(ctx.organizationId);
}

export async function upsertAttendancePaySettings(
  ctx: HrServiceContext,
  input: AttendancePaySettingsInput,
): Promise<PayrollDeductionSettingsRow> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.payrollManage,
    HR_PERMISSIONS.settingsManage,
  ]);
  const lateBahtPerMinute = Math.max(0, Number(input.lateBahtPerMinute) || 0);
  const absenceBahtPerDay = Math.max(0, Number(input.absenceBahtPerDay) || 0);
  const existing = await findSettingsRow(ctx.organizationId);
  if (existing) {
    await prisma.$executeRaw`
      UPDATE hr.payroll_deduction_settings
      SET
        late_deduction_enabled = ${Boolean(input.lateDeductionEnabled)},
        late_baht_per_minute = ${lateBahtPerMinute},
        absence_deduction_enabled = ${Boolean(input.absenceDeductionEnabled)},
        absence_baht_per_day = ${absenceBahtPerDay},
        updated_by_auth_user_id = ${ctx.actorAuthUserId}::uuid,
        updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = ${ctx.organizationId}::uuid
    `;
  } else {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO hr.payroll_deduction_settings (
        id, organization_id,
        tax_enabled, tax_method, tax_rate_percent,
        tax_personal_allowance, tax_expense_deduction_enabled,
        social_security_enabled, social_security_rate_percent,
        social_security_max_amount,
        social_security_wage_base_min, social_security_wage_base_max,
        late_deduction_enabled, late_baht_per_minute,
        absence_deduction_enabled, absence_baht_per_day,
        updated_by_auth_user_id
      ) VALUES (
        ${id}::uuid,
        ${ctx.organizationId}::uuid,
        ${DEFAULTS.taxEnabled},
        ${DEFAULTS.taxMethod},
        ${DEFAULTS.taxRatePercent},
        ${DEFAULTS.taxPersonalAllowance},
        ${DEFAULTS.taxExpenseDeductionEnabled},
        ${DEFAULTS.socialSecurityEnabled},
        ${DEFAULTS.socialSecurityRatePercent},
        ${DEFAULTS.socialSecurityMaxAmount},
        ${DEFAULTS.socialSecurityWageBaseMin},
        ${DEFAULTS.socialSecurityWageBaseMax},
        ${Boolean(input.lateDeductionEnabled)},
        ${lateBahtPerMinute},
        ${Boolean(input.absenceDeductionEnabled)},
        ${absenceBahtPerDay},
        ${ctx.actorAuthUserId}::uuid
      )
    `;
  }
  const row = await findSettingsRow(ctx.organizationId);
  return row ? toRow(row) : defaultRow(ctx.organizationId);
}

/** Internal: load rates for calculate (no permission gate). */
export async function loadDeductionRatesForOrg(
  organizationId: string,
): Promise<PayrollDeductionRateConfig | null> {
  const existing = await findSettingsRow(organizationId);
  if (!existing) return null;
  return toDeductionRateConfig(toRow(existing));
}

/** Internal: late/absence pay settings for calculate. */
export async function loadAttendancePaySettingsForOrg(
  organizationId: string,
): Promise<AttendancePaySettingsInput> {
  const existing = await findSettingsRow(organizationId);
  if (!existing) {
    return {
      lateDeductionEnabled: DEFAULTS.lateDeductionEnabled,
      lateBahtPerMinute: DEFAULTS.lateBahtPerMinute,
      absenceDeductionEnabled: DEFAULTS.absenceDeductionEnabled,
      absenceBahtPerDay: DEFAULTS.absenceBahtPerDay,
    };
  }
  const row = toRow(existing);
  return {
    lateDeductionEnabled: row.lateDeductionEnabled,
    lateBahtPerMinute: row.lateBahtPerMinute,
    absenceDeductionEnabled: row.absenceDeductionEnabled,
    absenceBahtPerDay: row.absenceBahtPerDay,
  };
}
