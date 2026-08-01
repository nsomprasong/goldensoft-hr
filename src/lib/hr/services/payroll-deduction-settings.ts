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
  updatedAt: string;
};

const DEFAULTS = {
  taxEnabled: true,
  taxRatePercent: 3,
  socialSecurityEnabled: true,
  socialSecurityRatePercent: 5,
  socialSecurityMaxAmount: 750,
} as const;

type DbRow = {
  id: string;
  organization_id: string;
  tax_enabled: boolean;
  tax_rate_percent: string | number;
  social_security_enabled: boolean;
  social_security_rate_percent: string | number;
  social_security_max_amount: string | number;
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
      updated_at
    FROM hr.payroll_deduction_settings
    WHERE organization_id = ${organizationId}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
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
  return {
    id: "",
    organizationId: ctx.organizationId,
    ...DEFAULTS,
    updatedAt: new Date(0).toISOString(),
  };
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
  if (!row) {
    return {
      id: "",
      organizationId: ctx.organizationId,
      taxEnabled: Boolean(input.taxEnabled),
      taxRatePercent,
      socialSecurityEnabled: Boolean(input.socialSecurityEnabled),
      socialSecurityRatePercent,
      socialSecurityMaxAmount,
      updatedAt: new Date().toISOString(),
    };
  }
  return toRow(row);
}

/** Internal: load rates for calculate (no permission gate). */
export async function loadDeductionRatesForOrg(
  organizationId: string,
): Promise<PayrollDeductionRateConfig | null> {
  const existing = await findSettingsRow(organizationId);
  if (!existing) return null;
  return toDeductionRateConfig(toRow(existing));
}
