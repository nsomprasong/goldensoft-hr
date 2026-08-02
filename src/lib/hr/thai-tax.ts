/**
 * Simplified Thai PIT progressive estimate for monthly payroll withholding.
 * Not legal advice / not a full Revenue Department withholding table.
 */

export type TaxMethod = "FLAT" | "PROGRESSIVE";

export type TaxBracket = {
  /** Inclusive upper bound of the band; null = no upper limit. */
  upTo: number | null;
  /** Rate percent for income in this band. */
  ratePercent: number;
};

/** Common Thai PIT bands (structure used widely for estimates). */
export const DEFAULT_THAI_TAX_BRACKETS: readonly TaxBracket[] = [
  { upTo: 150_000, ratePercent: 0 },
  { upTo: 300_000, ratePercent: 5 },
  { upTo: 500_000, ratePercent: 10 },
  { upTo: 750_000, ratePercent: 15 },
  { upTo: 1_000_000, ratePercent: 20 },
  { upTo: 2_000_000, ratePercent: 25 },
  { upTo: 5_000_000, ratePercent: 30 },
  { upTo: null, ratePercent: 35 },
];

/** Expense deduction: 50% of income, capped (common simplified rule). */
export const DEFAULT_TAX_EXPENSE_RATE = 0.5;
export const DEFAULT_TAX_EXPENSE_CAP = 100_000;
export const DEFAULT_TAX_PERSONAL_ALLOWANCE = 60_000;

export function isTaxMethod(value: unknown): value is TaxMethod {
  return value === "FLAT" || value === "PROGRESSIVE";
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Progressive annual tax on taxable income using ascending brackets.
 */
export function applyProgressiveTax(
  taxableAnnual: number,
  brackets: readonly TaxBracket[] = DEFAULT_THAI_TAX_BRACKETS,
): number {
  const income = Math.max(0, taxableAnnual);
  if (income <= 0) return 0;

  let tax = 0;
  let lower = 0;
  for (const band of brackets) {
    const upper = band.upTo == null ? Number.POSITIVE_INFINITY : band.upTo;
    if (income <= lower) break;
    const slice = Math.min(income, upper) - lower;
    if (slice > 0) {
      tax += (slice * Math.max(0, band.ratePercent)) / 100;
    }
    lower = upper;
    if (band.upTo == null || income <= upper) break;
  }
  return roundMoney(tax);
}

export type ProgressiveMonthlyTaxInput = {
  monthlyGross: number;
  personalAllowanceAnnual?: number;
  expenseDeductionEnabled?: boolean;
  expenseRate?: number;
  expenseCap?: number;
  brackets?: readonly TaxBracket[];
};

/**
 * Estimate monthly withholding: (annualize → expense → allowance → brackets) ÷ 12.
 */
export function estimateProgressiveMonthlyTax(
  input: ProgressiveMonthlyTaxInput,
): {
  monthlyTax: number;
  annualIncome: number;
  expenseDeduction: number;
  personalAllowance: number;
  taxableAnnual: number;
  annualTax: number;
} {
  const monthlyGross = Math.max(0, input.monthlyGross);
  const annualIncome = roundMoney(monthlyGross * 12);
  const expenseEnabled = input.expenseDeductionEnabled !== false;
  const expenseRate = input.expenseRate ?? DEFAULT_TAX_EXPENSE_RATE;
  const expenseCap = input.expenseCap ?? DEFAULT_TAX_EXPENSE_CAP;
  const expenseDeduction = expenseEnabled
    ? roundMoney(Math.min(annualIncome * expenseRate, expenseCap))
    : 0;
  const personalAllowance = Math.max(
    0,
    input.personalAllowanceAnnual ?? DEFAULT_TAX_PERSONAL_ALLOWANCE,
  );
  const taxableAnnual = roundMoney(
    Math.max(0, annualIncome - expenseDeduction - personalAllowance),
  );
  const annualTax = applyProgressiveTax(taxableAnnual, input.brackets);
  return {
    monthlyTax: roundMoney(annualTax / 12),
    annualIncome,
    expenseDeduction,
    personalAllowance,
    taxableAnnual,
    annualTax,
  };
}

/**
 * SSO wage base: clamp monthly wage into [min, max] (Thai-style estimate).
 * When wage is below min, contribution uses the minimum base.
 */
export function socialSecurityWageBase(
  monthlyWage: number,
  minBase: number,
  maxBase: number,
): number {
  const wage = Math.max(0, monthlyWage);
  const min = Math.max(0, minBase);
  const max = Math.max(min, maxBase);
  if (wage <= 0) return 0;
  return Math.min(Math.max(wage, min), max);
}

export function calculateSocialSecurityEmployee(
  monthlyWage: number,
  options: {
    ratePercent: number;
    wageBaseMin: number;
    wageBaseMax: number;
    maxAmount: number | null | undefined;
  },
): { base: number; amount: number } {
  const base = socialSecurityWageBase(
    monthlyWage,
    options.wageBaseMin,
    options.wageBaseMax,
  );
  const raw = (base * Math.max(0, options.ratePercent)) / 100;
  const capped =
    options.maxAmount == null
      ? raw
      : Math.min(raw, Math.max(0, options.maxAmount));
  return { base: roundMoney(base), amount: roundMoney(capped) };
}
