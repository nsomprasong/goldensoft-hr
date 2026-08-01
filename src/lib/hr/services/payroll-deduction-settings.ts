import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { assertHrPermission } from "@/lib/hr/authorize";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { HrServiceContext } from "@/lib/hr/services/shared";
import type { PayrollDeductionRateConfig } from "@/lib/hr/payroll-calc";

export type PayrollDeductionSettingsRow = {
  id: string;
  organizationId: string;
  taxEnabled: boolean;
  taxRatePercent: number;
  socialSecurityEnabled: boolean;
  socialSecurityRatePercent: number;
  socialSecurityMaxAmount: number;
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
  taxRatePercent: 3,
  socialSecurityEnabled: true,
  socialSecurityRatePercent: 5,
  socialSecurityMaxAmount: 750,
  lateDeductionEnabled: true,
  lateBahtPerMinute: 0,
  absenceDeductionEnabled: true,
  absenceBahtPerDay: 0,
} as const;

type DbRow = {
  id: string;
  organization_id: string;
  tax_enabled: boolean;
  tax_rate_percent: string | number;
  social_security_enabled: boolean;
  social_security_rate_percent: string | number;
  social_security_max_amount: string | number;
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
    taxRatePercent: Number(row.tax_rate_percent),
    socialSecurityEnabled: row.social_security_enabled,
    socialSecurityRatePercent: Number(row.social_security_rate_percent),
    socialSecurityMaxAmount: Number(row.social_security_max_amount),
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
    taxRatePercent: row.taxRatePercent,
    socialSecurityEnabled: row.socialSecurityEnabled,
    socialSecurityRatePercent: row.socialSecurityRatePercent,
    socialSecurityMaxAmount: row.socialSecurityMaxAmount,
  };
}

async function findSettingsRow(
  organizationId: string,
): Promise<DbRow | null> {
  const rows = await prisma.$queryRaw<DbRow[]>`
    SELECT
      id::text AS id,
      organization_id::text AS organization_id,
      tax_enabled,
      tax_rate_percent,
      social_security_enabled,
      social_security_rate_percent,
      social_security_max_amount,
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
    taxRatePercent: number;
    socialSecurityEnabled: boolean;
    socialSecurityRatePercent: number;
    socialSecurityMaxAmount: number;
  },
): Promise<PayrollDeductionSettingsRow> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.payrollManage,
    HR_PERMISSIONS.settingsManage,
  ]);
  const taxRatePercent = Math.max(0, Number(input.taxRatePercent) || 0);
  const socialSecurityRatePercent = Math.max(
    0,
    Number(input.socialSecurityRatePercent) || 0,
  );
  const socialSecurityMaxAmount = Math.max(
    0,
    Number(input.socialSecurityMaxAmount) || 0,
  );
  const existing = await findSettingsRow(ctx.organizationId);
  if (existing) {
    await prisma.$executeRaw`
      UPDATE hr.payroll_deduction_settings
      SET
        tax_enabled = ${Boolean(input.taxEnabled)},
        tax_rate_percent = ${taxRatePercent},
        social_security_enabled = ${Boolean(input.socialSecurityEnabled)},
        social_security_rate_percent = ${socialSecurityRatePercent},
        social_security_max_amount = ${socialSecurityMaxAmount},
        updated_by_auth_user_id = ${ctx.actorAuthUserId}::uuid,
        updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = ${ctx.organizationId}::uuid
    `;
  } else {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO hr.payroll_deduction_settings (
        id, organization_id, tax_enabled, tax_rate_percent,
        social_security_enabled, social_security_rate_percent,
        social_security_max_amount, updated_by_auth_user_id
      ) VALUES (
        ${id}::uuid,
        ${ctx.organizationId}::uuid,
        ${Boolean(input.taxEnabled)},
        ${taxRatePercent},
        ${Boolean(input.socialSecurityEnabled)},
        ${socialSecurityRatePercent},
        ${socialSecurityMaxAmount},
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
        tax_enabled, tax_rate_percent,
        social_security_enabled, social_security_rate_percent,
        social_security_max_amount,
        late_deduction_enabled, late_baht_per_minute,
        absence_deduction_enabled, absence_baht_per_day,
        updated_by_auth_user_id
      ) VALUES (
        ${id}::uuid,
        ${ctx.organizationId}::uuid,
        ${DEFAULTS.taxEnabled},
        ${DEFAULTS.taxRatePercent},
        ${DEFAULTS.socialSecurityEnabled},
        ${DEFAULTS.socialSecurityRatePercent},
        ${DEFAULTS.socialSecurityMaxAmount},
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
