/** Shared fixtures for the Phase 8B domain suite. No database is involved. */
import assert from "node:assert/strict";

import { HrError } from "../../src/lib/hr/errors";
import { hrPermissionsForOrganizationRoles } from "../../src/lib/hr/permissions";
import { createMemoryHrRepository } from "../../src/lib/hr/repository/memory-repository";
import {
  createSeededHrMemoryStore,
  masterIdByCode,
  type HrMemoryStore,
} from "../../src/lib/hr/repository/memory-store";
import type {
  HrMasterKind,
  HrRepository,
} from "../../src/lib/hr/repository/types";
import type { EmployeeCreateData } from "../../src/lib/hr/services/employees";
import type { HrServiceContext } from "../../src/lib/hr/services/shared";

export const ORG_A = "11111111-1111-4111-8111-111111111111";
export const ORG_B = "99999999-9999-4999-8999-999999999999";
export const BRANCH_MAIN = "22222222-2222-4222-8222-222222222222";
export const BRANCH_OTHER = "33333333-3333-4333-8333-333333333333";
export const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const PLATFORM_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

export type TestHarness = {
  store: HrMemoryStore;
  repository: HrRepository;
};

export function createHarness(): TestHarness {
  const store = createSeededHrMemoryStore();
  return { store, repository: createMemoryHrRepository(store) };
}

export function masterId(
  store: HrMemoryStore,
  kind: HrMasterKind,
  code: string,
): string {
  return masterIdByCode(store, kind, code);
}

/** OWNER/ADMIN context — note this deliberately excludes compensation access. */
export function adminContext(
  overrides: Partial<HrServiceContext> = {},
): HrServiceContext {
  return {
    organizationId: ORG_A,
    branchId: BRANCH_MAIN,
    permissions: hrPermissionsForOrganizationRoles(["ADMIN"]),
    platformRoles: [],
    contextMode: "membership",
    allowedBranchIds: null,
    actorAuthUserId: ACTOR_ID,
    ...overrides,
  };
}

/** Plain member: read-only, pinned to a single branch. */
export function memberContext(
  overrides: Partial<HrServiceContext> = {},
): HrServiceContext {
  return {
    organizationId: ORG_A,
    branchId: BRANCH_MAIN,
    permissions: hrPermissionsForOrganizationRoles(["MEMBER"]),
    platformRoles: [],
    contextMode: "membership",
    allowedBranchIds: [BRANCH_MAIN],
    actorAuthUserId: ACTOR_ID,
    ...overrides,
  };
}

/** Admin plus the explicitly-granted compensation permissions. */
export function payrollOfficerContext(
  overrides: Partial<HrServiceContext> = {},
): HrServiceContext {
  const base = adminContext(overrides);
  return {
    ...base,
    permissions: [
      ...base.permissions,
      "hr.compensation.read",
      "hr.compensation.manage",
    ],
  };
}

export function employeeData(
  store: HrMemoryStore,
  overrides: Partial<EmployeeCreateData> = {},
): EmployeeCreateData {
  return {
    employeeCode: "EMP-0001",
    branchId: BRANCH_MAIN,
    employmentTypeId: masterId(store, "employmentType", "MONTHLY"),
    employeeStatusId: masterId(store, "employeeStatus", "ACTIVE"),
    firstNameTh: "สมชาย",
    lastNameTh: "ใจดี",
    phone: "0800000001",
    hireDate: "2026-01-01",
    ...overrides,
  };
}

/** Assert that an operation fails with a specific HR error code. */
export async function expectHrError(
  code: string,
  run: () => Promise<unknown>,
): Promise<HrError> {
  let captured: unknown;
  try {
    await run();
  } catch (error) {
    captured = error;
  }
  assert.ok(
    captured instanceof HrError,
    `expected HrError ${code}, received ${String(captured)}`,
  );
  assert.equal(captured.code, code);
  return captured;
}
