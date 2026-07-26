/**
 * Backend-agnostic master seeding. Runs against Prisma or the memory store and
 * is idempotent by `code` — repeated runs refresh names and create nothing new.
 */
import { HR_MASTER_CATALOG } from "@/lib/seed/master-data";
import {
  HR_MASTER_KINDS,
  type HrMasterKind,
  type HrRepository,
} from "@/lib/hr/repository/types";

export type MasterSeedResult = Record<
  HrMasterKind,
  { total: number; created: number }
>;

export async function seedMastersIntoRepository(
  repository: HrRepository,
): Promise<MasterSeedResult> {
  const result = {} as MasterSeedResult;

  for (const kind of HR_MASTER_KINDS) {
    const rows = HR_MASTER_CATALOG[kind];
    let created = 0;
    for (const row of rows) {
      const outcome = await repository.masters.upsert(kind, row);
      if (outcome.created) created += 1;
    }
    result[kind] = { total: rows.length, created };
  }

  return result;
}
