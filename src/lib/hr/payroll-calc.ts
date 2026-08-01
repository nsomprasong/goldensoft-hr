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
  taxRatePercent?: number;
  socialSecurityEnabled?: boolean;
  socialSecurityRatePercent?: number;
  socialSecurityMaxAmount?: number | null;
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
  /** Org-configurable rates (Phase 4 / 2B). Omit → TAX/SSO stay zero placeholders. */
  deductionRates?: PayrollDeductionRateConfig | null;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function positive(value: number | undefined): number {
  return Math.max(0, value ?? 0);
}

/**
 * Deterministic payroll estimate from inputs only.
 * Tax / SSO use tenant rates when provided; otherwise remain zero placeholders.
 * Not a claim of full Thai statutory compliance (Phase 8).
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

  const earningsGross = lines
    .filter((line) => line.kind === "EARNING")
    .reduce((total, line) => total + line.amount, 0);

  const rates = input.deductionRates;
  const taxEnabled = rates?.taxEnabled !== false;
  const taxRate = positive(rates?.taxRatePercent);
  if (rates && taxEnabled && taxRate > 0) {
    lines.push({
      code: "TAX",
      description: `หักภาษี (${taxRate}%)`,
      amount: roundMoney((earningsGross * taxRate) / 100),
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

  const ssoEnabled = rates?.socialSecurityEnabled !== false;
  const ssoRate = positive(rates?.socialSecurityRatePercent);
  if (rates && ssoEnabled && ssoRate > 0) {
    const raw = (earningsGross * ssoRate) / 100;
    const cap =
      rates.socialSecurityMaxAmount == null
        ? raw
        : Math.min(raw, positive(rates.socialSecurityMaxAmount));
    lines.push({
      code: "SOCIAL_SECURITY",
      description: `หักประกันสังคม (${ssoRate}%)`,
      amount: roundMoney(cap),
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
