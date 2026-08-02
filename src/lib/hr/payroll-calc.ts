import {
  calculateSocialSecurityEmployee,
  estimateProgressiveMonthlyTax,
  isTaxMethod,
  type TaxMethod,
} from "@/lib/hr/thai-tax";

export type PayrollWageType = "DAILY" | "MONTHLY" | "HOURLY";
export type PayrollLine = {
  code: string;
  description: string;
  amount: number;
  kind: "EARNING" | "DEDUCTION";
  /** Zero placeholder when tax/SSO config is missing or disabled. */
  isLegalPlaceholder?: true;
};

export type PayrollCalculation = {
  gross: number;
  deductions: number;
  net: number;
  lines: PayrollLine[];
};

export type PayrollDeductionRateConfig = {
  taxEnabled?: boolean;
  /** FLAT = percent of gross; PROGRESSIVE = annualize + brackets ÷ 12. */
  taxMethod?: TaxMethod | string;
  taxRatePercent?: number;
  /** Annual personal allowance for progressive estimate (default 60,000). */
  taxPersonalAllowance?: number;
  /** When progressive: apply 50% expense cap rule. Default true. */
  taxExpenseDeductionEnabled?: boolean;
  socialSecurityEnabled?: boolean;
  socialSecurityRatePercent?: number;
  socialSecurityMaxAmount?: number | null;
  /** Insurable wage floor (Thai-style). Default 1,650. */
  socialSecurityWageBaseMin?: number;
  /** Insurable wage ceiling (Thai-style). Default 15,000. */
  socialSecurityWageBaseMax?: number;
};

export type PayrollInput = {
  wageType: PayrollWageType;
  wageAmount: number;
  workedDays?: number;
  workedHours?: number;
  periodDays?: number;
  overtimeHours?: number;
  overtimeMultiplier?: number;
  earnings?: Array<{ code: string; amount: number; description?: string }>;
  deductions?: Array<{ code: string; amount: number; description?: string }>;
  /**
   * Org-configurable rates (Phase 4 / 8B).
   * Omit → TAX/SSO stay zero placeholders.
   */
  deductionRates?: PayrollDeductionRateConfig | null;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function positive(value: number | undefined): number {
  return Math.max(0, value ?? 0);
}

/** Loan / cash-advance payout — on slip for net, not taxable or SSO wage. */
function isNonWageEarning(code: string): boolean {
  return code.toUpperCase() === "ADVANCE_PAYOUT";
}

/**
 * Deterministic payroll estimate from inputs only.
 * Tax / SSO use tenant rates when provided.
 * Progressive tax + SSO wage base are Phase 8 Track B estimates — not legal advice.
 * ADVANCE_PAYOUT stays on the slip for net pay but is excluded from tax/SSO bases.
 */
export function calculatePayroll(input: PayrollInput): PayrollCalculation {
  const rate = positive(input.wageAmount);
  const base =
    input.wageType === "DAILY"
      ? rate * positive(input.workedDays)
      : input.wageType === "HOURLY"
        ? rate * positive(input.workedHours)
        : rate * (input.periodDays == null ? 1 : positive(input.periodDays) / 30);
  const hourlyRate = input.wageType === "HOURLY" ? rate : rate / 30 / 8;
  const lines: PayrollLine[] = [
    {
      code: "BASE_PAY",
      description: "ค่าจ้าง",
      amount: roundMoney(base),
      kind: "EARNING",
    },
  ];
  if (positive(input.overtimeHours)) {
    lines.push({
      code: "OVERTIME",
      description: "ค่าล่วงเวลา",
      amount: roundMoney(
        hourlyRate *
          positive(input.overtimeHours) *
          (input.overtimeMultiplier ?? 1),
      ),
      kind: "EARNING",
    });
  }
  for (const item of input.earnings ?? []) {
    lines.push({
      code: item.code,
      description: item.description ?? item.code,
      amount: roundMoney(positive(item.amount)),
      kind: "EARNING",
    });
  }
  for (const item of input.deductions ?? []) {
    lines.push({
      code: item.code,
      description: item.description ?? item.code,
      amount: roundMoney(positive(item.amount)),
      kind: "DEDUCTION",
    });
  }

  /** Wage-like earnings only — excludes loan payout (ADVANCE_PAYOUT). */
  const taxableBase = lines
    .filter(
      (line) => line.kind === "EARNING" && !isNonWageEarning(line.code),
    )
    .reduce((total, line) => total + line.amount, 0);

  const rates = input.deductionRates;
  const taxEnabled = rates?.taxEnabled !== false;
  const taxMethod: TaxMethod = isTaxMethod(rates?.taxMethod)
    ? rates.taxMethod
    : "FLAT";
  const taxRate = positive(rates?.taxRatePercent);

  if (rates && taxEnabled) {
    if (taxMethod === "PROGRESSIVE") {
      const progressive = estimateProgressiveMonthlyTax({
        monthlyGross: taxableBase,
        personalAllowanceAnnual: positive(rates.taxPersonalAllowance) || 60_000,
        expenseDeductionEnabled: rates.taxExpenseDeductionEnabled !== false,
      });
      lines.push({
        code: "TAX",
        description: "หักภาษี (ขั้นบันได ประมาณการ)",
        amount: progressive.monthlyTax,
        kind: "DEDUCTION",
      });
    } else if (taxRate > 0) {
      lines.push({
        code: "TAX",
        description: `หักภาษี (${taxRate}%)`,
        amount: roundMoney((taxableBase * taxRate) / 100),
        kind: "DEDUCTION",
      });
    } else {
      lines.push({
        code: "TAX",
        description: "หักภาษี (ยังไม่ได้ตั้งอัตรา)",
        amount: 0,
        kind: "DEDUCTION",
        isLegalPlaceholder: true,
      });
    }
  } else {
    lines.push({
      code: "TAX",
      description: "หักภาษี (ยังไม่ได้ตั้งอัตรา)",
      amount: 0,
      kind: "DEDUCTION",
      isLegalPlaceholder: true,
    });
  }

  const ssoEnabled = rates?.socialSecurityEnabled !== false;
  const ssoRate = positive(rates?.socialSecurityRatePercent);
  if (rates && ssoEnabled && ssoRate > 0) {
    const wageBaseMin =
      rates.socialSecurityWageBaseMin == null
        ? 1_650
        : positive(rates.socialSecurityWageBaseMin);
    const wageBaseMax =
      rates.socialSecurityWageBaseMax == null
        ? 15_000
        : positive(rates.socialSecurityWageBaseMax);
    const sso = calculateSocialSecurityEmployee(taxableBase, {
      ratePercent: ssoRate,
      wageBaseMin,
      wageBaseMax,
      maxAmount: rates.socialSecurityMaxAmount,
    });
    lines.push({
      code: "SOCIAL_SECURITY",
      description: `หักประกันสังคม (${ssoRate}% · ฐาน ${sso.base.toLocaleString("th-TH")})`,
      amount: sso.amount,
      kind: "DEDUCTION",
    });
  } else {
    lines.push({
      code: "SOCIAL_SECURITY",
      description: "หักประกันสังคม (ยังไม่ได้ตั้งอัตรา)",
      amount: 0,
      kind: "DEDUCTION",
      isLegalPlaceholder: true,
    });
  }

  const gross = lines
    .filter((line) => line.kind === "EARNING")
    .reduce((total, line) => total + line.amount, 0);
  const deductions = lines
    .filter((line) => line.kind === "DEDUCTION")
    .reduce((total, line) => total + line.amount, 0);
  return {
    gross: roundMoney(gross),
    deductions: roundMoney(deductions),
    net: roundMoney(gross - deductions),
    lines,
  };
}
