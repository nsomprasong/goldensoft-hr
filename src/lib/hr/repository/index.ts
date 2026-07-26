/**
 * Repository selection.
 *
 * Tests and DB-less local runs get the in-memory implementation; anything with
 * a DATABASE_URL gets Prisma. The Prisma module is imported lazily because it
 * pulls in `server-only`, which cannot be loaded from a plain Node test run.
 */
import { createMemoryHrRepository } from "@/lib/hr/repository/memory-repository";
import { createSeededHrMemoryStore } from "@/lib/hr/repository/memory-store";
import type { HrRepository } from "@/lib/hr/repository/types";

type HrRepositoryGlobal = {
  __hrRepositoryOverride?: HrRepository | null;
  __hrMemoryRepository?: HrRepository | null;
};

const globalForHr = globalThis as unknown as HrRepositoryGlobal;

/** Test hook: force every API route onto a caller-supplied repository. */
export function setHrRepositoryOverride(
  repository: HrRepository | null,
): void {
  globalForHr.__hrRepositoryOverride = repository;
}

export function getHrRepositoryOverride(): HrRepository | null {
  return globalForHr.__hrRepositoryOverride ?? null;
}

export function shouldUseMemoryRepository(): boolean {
  if (process.env.HR_USE_MEMORY_REPO === "true") return true;
  if (process.env.NODE_ENV === "test") return true;
  return !process.env.DATABASE_URL;
}

/** Process-wide memory repository so requests share state between calls. */
export function getMemoryHrRepository(): HrRepository {
  if (!globalForHr.__hrMemoryRepository) {
    globalForHr.__hrMemoryRepository = createMemoryHrRepository(
      createSeededHrMemoryStore(),
    );
  }
  return globalForHr.__hrMemoryRepository;
}

export function resetMemoryHrRepository(): void {
  globalForHr.__hrMemoryRepository = null;
}

export async function getHrRepository(): Promise<HrRepository> {
  const override = getHrRepositoryOverride();
  if (override) return override;

  if (shouldUseMemoryRepository()) {
    return getMemoryHrRepository();
  }

  const { createPrismaHrRepository } = await import(
    "@/lib/hr/repository/prisma-repository"
  );
  return createPrismaHrRepository();
}
