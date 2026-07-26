/**
 * In-memory HR database used by the domain test-suite and by local runs where
 * DATABASE_URL is absent. It mirrors the shape (and the master catalog) of the
 * real `hr` schema so services behave identically against either backend.
 */
import { createHash, randomUUID } from "node:crypto";

import { HR_MASTER_CATALOG } from "@/lib/seed/master-data";
import {
  HR_MASTER_KINDS,
  type AuditLogRecord,
  type CompensationRecord,
  type DepartmentRecord,
  type EmployeeRecord,
  type HrMasterKind,
  type MasterRecord,
  type OvertimeRuleRecord,
  type PayrollPeriodRecord,
  type PayrollScheduleRecord,
  type PositionRecord,
  type ShiftRecord,
} from "@/lib/hr/repository/types";

export type HrMemoryStore = {
  masters: Record<HrMasterKind, MasterRecord[]>;
  departments: DepartmentRecord[];
  positions: PositionRecord[];
  employees: EmployeeRecord[];
  compensations: CompensationRecord[];
  overtimeRules: OvertimeRuleRecord[];
  shifts: ShiftRecord[];
  payrollSchedules: PayrollScheduleRecord[];
  payrollPeriods: PayrollPeriodRecord[];
  auditLogs: AuditLogRecord[];
};

/**
 * Stable UUID derived from kind + code so seeded master ids stay identical
 * across store instances, which keeps test fixtures readable.
 */
export function deterministicUuid(namespace: string, value: string): string {
  const hex = createHash("sha256")
    .update(`${namespace}:${value}`)
    .digest("hex");
  const variant = ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, "0");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

export function newId(): string {
  return randomUUID();
}

function emptyMasters(): Record<HrMasterKind, MasterRecord[]> {
  return Object.fromEntries(
    HR_MASTER_KINDS.map((kind) => [kind, [] as MasterRecord[]]),
  ) as Record<HrMasterKind, MasterRecord[]>;
}

export function createEmptyHrMemoryStore(): HrMemoryStore {
  return {
    masters: emptyMasters(),
    departments: [],
    positions: [],
    employees: [],
    compensations: [],
    overtimeRules: [],
    shifts: [],
    payrollSchedules: [],
    payrollPeriods: [],
    auditLogs: [],
  };
}

export type MemoryMasterSeedCounts = Record<
  HrMasterKind,
  { total: number; created: number }
>;

/**
 * Seed the canonical master catalog. Safe to call repeatedly: existing codes
 * are refreshed in place and never duplicated or renumbered.
 */
export function seedMemoryMasters(
  store: HrMemoryStore,
): MemoryMasterSeedCounts {
  const counts = {} as MemoryMasterSeedCounts;

  for (const kind of HR_MASTER_KINDS) {
    const rows = HR_MASTER_CATALOG[kind];
    let created = 0;

    for (const row of rows) {
      const existing = store.masters[kind].find((m) => m.code === row.code);
      if (existing) {
        existing.nameTh = row.nameTh;
        existing.nameEn = row.nameEn;
        existing.sortOrder = row.sortOrder;
        continue;
      }
      store.masters[kind].push({
        id: deterministicUuid(kind, row.code),
        code: row.code,
        nameTh: row.nameTh,
        nameEn: row.nameEn,
        description: null,
        sortOrder: row.sortOrder,
        isActive: true,
        isSystem: true,
      });
      created += 1;
    }

    counts[kind] = { total: store.masters[kind].length, created };
  }

  return counts;
}

/** Store pre-populated with the master catalog — the usual test starting point. */
export function createSeededHrMemoryStore(): HrMemoryStore {
  const store = createEmptyHrMemoryStore();
  seedMemoryMasters(store);
  return store;
}

/** Resolve a seeded master id by code; throws loudly for typos in fixtures. */
export function masterIdByCode(
  store: HrMemoryStore,
  kind: HrMasterKind,
  code: string,
): string {
  const hit = store.masters[kind].find((m) => m.code === code);
  if (!hit) {
    throw new Error(`Memory store is missing master ${kind}.${code}`);
  }
  return hit.id;
}
