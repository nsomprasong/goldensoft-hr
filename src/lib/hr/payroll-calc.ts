export type PayrollWageType = "DAILY" | "MONTHLY" | "HOURLY";
export type PayrollLine = {
  code: string;
  description: string;
  amount: number;
  kind: "EARNING" | "DEDUCTION";
  isLegalPlaceholder?: true;
};

export type PayrollCalculation = {
  gross: number;
  deductions: number;
  net: number;
  lines: PayrollLine[];
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
};

/** Deterministic estimate only; Thai tax and social-security lines remain zero placeholders. */
export function calculatePayroll(input: PayrollInput): PayrollCalculation {
  const positive = (value: number | undefined) => Math.max(0, value ?? 0);
  const rate = positive(input.wageAmount);
  const base = input.wageType === "DAILY" ? rate * positive(input.workedDays)
    : input.wageType === "HOURLY" ? rate * positive(input.workedHours)
    : rate * (input.periodDays == null ? 1 : positive(input.periodDays) / 30);
  const hourlyRate = input.wageType === "HOURLY" ? rate : rate / 30 / 8;
  const lines: PayrollLine[] = [{ code: "BASE_PAY", description: "Base pay", amount: base, kind: "EARNING" }];
  if (positive(input.overtimeHours)) lines.push({ code: "OVERTIME", description: "Overtime", amount: hourlyRate * positive(input.overtimeHours) * (input.overtimeMultiplier ?? 1), kind: "EARNING" });
  for (const item of input.earnings ?? []) lines.push({ code: item.code, description: item.description ?? item.code, amount: positive(item.amount), kind: "EARNING" });
  for (const item of input.deductions ?? []) lines.push({ code: item.code, description: item.description ?? item.code, amount: positive(item.amount), kind: "DEDUCTION" });
  lines.push({ code: "TAX", description: "Tax calculation requires legal configuration", amount: 0, kind: "DEDUCTION", isLegalPlaceholder: true });
  lines.push({ code: "SOCIAL_SECURITY", description: "Social security requires legal configuration", amount: 0, kind: "DEDUCTION", isLegalPlaceholder: true });
  const gross = lines.filter((line) => line.kind === "EARNING").reduce((total, line) => total + line.amount, 0);
  const deductions = lines.filter((line) => line.kind === "DEDUCTION").reduce((total, line) => total + line.amount, 0);
  return { gross, deductions, net: gross - deductions, lines };
}
