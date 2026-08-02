import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyProgressiveTax,
  calculateSocialSecurityEmployee,
  estimateProgressiveMonthlyTax,
  socialSecurityWageBase,
} from "../src/lib/hr/thai-tax";
import { calculatePayroll } from "../src/lib/hr/payroll-calc";

describe("thai-tax progressive", () => {
  it("applies ascending brackets", () => {
    // 440_000 taxable: 0 + 150k*5% + 140k*10% = 7_500 + 14_000 = 21_500
    assert.equal(applyProgressiveTax(440_000), 21_500);
    assert.equal(applyProgressiveTax(0), 0);
    assert.equal(applyProgressiveTax(100_000), 0);
  });

  it("estimates monthly withholding from annualize ÷ 12", () => {
    const result = estimateProgressiveMonthlyTax({
      monthlyGross: 50_000,
      personalAllowanceAnnual: 60_000,
      expenseDeductionEnabled: true,
    });
    assert.equal(result.annualIncome, 600_000);
    assert.equal(result.expenseDeduction, 100_000);
    assert.equal(result.taxableAnnual, 440_000);
    assert.equal(result.annualTax, 21_500);
    assert.equal(result.monthlyTax, 1_791.67);
  });
});

describe("thai-tax SSO wage base", () => {
  it("clamps into min/max and uses min when wage is low", () => {
    assert.equal(socialSecurityWageBase(20_000, 1_650, 15_000), 15_000);
    assert.equal(socialSecurityWageBase(10_000, 1_650, 15_000), 10_000);
    assert.equal(socialSecurityWageBase(1_000, 1_650, 15_000), 1_650);
    assert.equal(socialSecurityWageBase(0, 1_650, 15_000), 0);
  });

  it("computes employee contribution with amount cap", () => {
    const high = calculateSocialSecurityEmployee(30_000, {
      ratePercent: 5,
      wageBaseMin: 1_650,
      wageBaseMax: 15_000,
      maxAmount: 750,
    });
    assert.equal(high.base, 15_000);
    assert.equal(high.amount, 750);

    const low = calculateSocialSecurityEmployee(1_000, {
      ratePercent: 5,
      wageBaseMin: 1_650,
      wageBaseMax: 15_000,
      maxAmount: 750,
    });
    assert.equal(low.base, 1_650);
    assert.equal(low.amount, 82.5);
  });
});

describe("payroll-calc Phase 8 Track B", () => {
  it("keeps flat tax + capped SSO for 20k (compat)", () => {
    const result = calculatePayroll({
      wageType: "MONTHLY",
      wageAmount: 20_000,
      deductionRates: {
        taxEnabled: true,
        taxMethod: "FLAT",
        taxRatePercent: 3,
        socialSecurityEnabled: true,
        socialSecurityRatePercent: 5,
        socialSecurityMaxAmount: 750,
        socialSecurityWageBaseMin: 1_650,
        socialSecurityWageBaseMax: 15_000,
      },
    });
    assert.equal(result.deductions, 600 + 750);
  });

  it("uses progressive tax method", () => {
    const result = calculatePayroll({
      wageType: "MONTHLY",
      wageAmount: 50_000,
      deductionRates: {
        taxEnabled: true,
        taxMethod: "PROGRESSIVE",
        taxPersonalAllowance: 60_000,
        taxExpenseDeductionEnabled: true,
        socialSecurityEnabled: false,
      },
    });
    const tax = result.lines.find((line) => line.code === "TAX");
    assert.equal(tax?.amount, 1_791.67);
    assert.match(tax?.description ?? "", /ขั้นบันได/);
  });

  it("excludes ADVANCE_PAYOUT from progressive tax and SSO base", () => {
    const wageOnly = calculatePayroll({
      wageType: "MONTHLY",
      wageAmount: 28_000,
      deductionRates: {
        taxEnabled: true,
        taxMethod: "PROGRESSIVE",
        taxPersonalAllowance: 60_000,
        taxExpenseDeductionEnabled: true,
        socialSecurityEnabled: true,
        socialSecurityRatePercent: 5,
        socialSecurityMaxAmount: 750,
        socialSecurityWageBaseMin: 1_650,
        socialSecurityWageBaseMax: 15_000,
      },
    });
    const withAdvance = calculatePayroll({
      wageType: "MONTHLY",
      wageAmount: 28_000,
      earnings: [
        {
          code: "ADVANCE_PAYOUT",
          amount: 3_000,
          description: "โอนเบิกล่วงหน้า (พร้อมเงินเดือน)",
        },
      ],
      deductionRates: {
        taxEnabled: true,
        taxMethod: "PROGRESSIVE",
        taxPersonalAllowance: 60_000,
        taxExpenseDeductionEnabled: true,
        socialSecurityEnabled: true,
        socialSecurityRatePercent: 5,
        socialSecurityMaxAmount: 750,
        socialSecurityWageBaseMin: 1_650,
        socialSecurityWageBaseMax: 15_000,
      },
    });

    const taxOnly = wageOnly.lines.find((line) => line.code === "TAX")?.amount;
    const taxWith = withAdvance.lines.find((line) => line.code === "TAX")?.amount;
    const ssoOnly = wageOnly.lines.find(
      (line) => line.code === "SOCIAL_SECURITY",
    )?.amount;
    const ssoWith = withAdvance.lines.find(
      (line) => line.code === "SOCIAL_SECURITY",
    )?.amount;

    // 28k progressive → monthly tax 108.33 (not 258.33 from 31k)
    assert.equal(taxOnly, 108.33);
    assert.equal(taxWith, taxOnly);
    assert.equal(ssoOnly, 750);
    assert.equal(ssoWith, ssoOnly);
    // Still on slip for cash / net
    assert.equal(withAdvance.gross, 31_000);
    assert.ok(
      withAdvance.lines.some(
        (line) => line.code === "ADVANCE_PAYOUT" && line.amount === 3_000,
      ),
    );
  });

  it("excludes ADVANCE_PAYOUT from flat tax percent base", () => {
    const result = calculatePayroll({
      wageType: "MONTHLY",
      wageAmount: 28_000,
      earnings: [{ code: "ADVANCE_PAYOUT", amount: 3_000 }],
      deductionRates: {
        taxEnabled: true,
        taxMethod: "FLAT",
        taxRatePercent: 3,
        socialSecurityEnabled: false,
      },
    });
    const tax = result.lines.find((line) => line.code === "TAX");
    assert.equal(tax?.amount, 840); // 3% of 28_000, not 31_000
    assert.equal(result.gross, 31_000);
  });
});
