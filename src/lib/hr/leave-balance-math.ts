export type LeaveLedgerEntry = {
  type: "OPENING" | "ACCRUAL" | "USED" | "ADJUSTMENT" | "CARRY_FORWARD";
  amount: number;
};

export type LeaveBalance = {
  opening: number;
  accrued: number;
  used: number;
  adjusted: number;
  remaining: number;
};

/** Folds signed ledger amounts. USED decreases the available balance. */
export function foldLeaveLedger(entries: LeaveLedgerEntry[], allowNegative = false): LeaveBalance {
  const balance: LeaveBalance = { opening: 0, accrued: 0, used: 0, adjusted: 0, remaining: 0 };
  for (const entry of entries) {
    if (!Number.isFinite(entry.amount)) throw new Error("Leave ledger amount must be finite");
    if (entry.type === "OPENING" || entry.type === "CARRY_FORWARD") balance.opening += entry.amount;
    if (entry.type === "ACCRUAL") balance.accrued += entry.amount;
    if (entry.type === "USED") balance.used += Math.abs(entry.amount);
    if (entry.type === "ADJUSTMENT") balance.adjusted += entry.amount;
  }
  balance.remaining = balance.opening + balance.accrued - balance.used + balance.adjusted;
  if (!allowNegative && balance.remaining < 0) throw new Error("Leave balance cannot be negative");
  return balance;
}
