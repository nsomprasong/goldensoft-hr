/**
 * Optional Prisma write for assignment history.
 * Loaded only when DATABASE_URL is present (never in memory/unit tests).
 */
import "server-only";

import { prisma } from "@/lib/prisma";

export async function writeEmployeeAssignmentHistory(input: {
  employeeId: string;
  branchId: string;
  departmentId: string | null;
  positionId: string | null;
  changedByAuthUserId: string;
  reason?: string;
}): Promise<void> {
  await prisma.employeeAssignmentHistory.create({
    data: {
      employeeId: input.employeeId,
      branchId: input.branchId,
      departmentId: input.departmentId,
      positionId: input.positionId,
      effectiveFrom: new Date(),
      reason: input.reason ?? "EMPLOYEE_UPDATE",
      changedByAuthUserId: input.changedByAuthUserId,
    },
  });
}
