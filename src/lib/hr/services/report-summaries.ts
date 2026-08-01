import { prisma } from "@/lib/prisma";
import { assertHrPermission } from "@/lib/hr/authorize";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import {
  employeeBranchWhere,
  type HrServiceContext,
} from "@/lib/hr/services/shared";
import { formatThaiDateRange } from "@/lib/hr/thai-date";

type Db = typeof prisma & Record<string, any>;
const db = prisma as Db;

function monthBounds(now = new Date()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  );
  return {
    start,
    end,
    startIso: start.toISOString().slice(0, 10),
    endIso: end.toISOString().slice(0, 10),
  };
}

export type ReportsHubSummary = {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  attendance: {
    present: number;
    late: number;
    absent: number;
    total: number;
  };
  leave: {
    submitted: number;
    approved: number;
    rejected: number;
  };
  overtime: {
    submitted: number;
    approved: number;
    approvedMinutes: number;
  };
  advances: {
    open: number;
    openAmount: number;
    deducted: number;
    deductedAmount: number;
    total: number;
  };
};

export async function loadReportsHubSummary(
  ctx: HrServiceContext,
): Promise<ReportsHubSummary> {
  assertHrPermission(ctx, HR_PERMISSIONS.reportRead);
  const { start, end, startIso, endIso } = monthBounds();
  const branchWhere = employeeBranchWhere(ctx);

  const attendanceRows = (await db.attendanceDay.findMany({
    where: {
      organizationId: ctx.organizationId,
      workDate: { gte: start, lte: end },
      ...branchWhere,
    },
    select: { status: { select: { code: true } } },
    take: 5000,
  })) as Array<{ status: { code: string } }>;

  let present = 0;
  let late = 0;
  let absent = 0;
  for (const row of attendanceRows) {
    const code = row.status?.code ?? "";
    if (code === "LATE") late += 1;
    else if (code === "ABSENT") absent += 1;
    else if (code === "PRESENT" || code === "ON_LEAVE") present += 1;
    else present += 1;
  }

  const leaveRows = (await db.leaveRequest.findMany({
    where: {
      organizationId: ctx.organizationId,
      startDate: { lte: end },
      endDate: { gte: start },
      ...branchWhere,
    },
    select: { status: { select: { code: true } } },
    take: 2000,
  })) as Array<{ status: { code: string } }>;
  let leaveSubmitted = 0;
  let leaveApproved = 0;
  let leaveRejected = 0;
  for (const row of leaveRows) {
    const code = row.status?.code ?? "";
    if (code === "SUBMITTED") leaveSubmitted += 1;
    else if (code === "APPROVED") leaveApproved += 1;
    else if (code === "REJECTED") leaveRejected += 1;
  }

  const otRows = (await db.overtimeRequest.findMany({
    where: {
      organizationId: ctx.organizationId,
      workDate: { gte: start, lte: end },
      ...branchWhere,
    },
    select: {
      approvedMinutes: true,
      requestedMinutes: true,
      status: { select: { code: true } },
    },
    take: 2000,
  })) as Array<{
    approvedMinutes: number | null;
    requestedMinutes: number;
    status: { code: string };
  }>;
  let otSubmitted = 0;
  let otApproved = 0;
  let approvedMinutes = 0;
  for (const row of otRows) {
    const code = row.status?.code ?? "";
    if (code === "SUBMITTED") otSubmitted += 1;
    else if (code === "APPROVED") {
      otApproved += 1;
      approvedMinutes += Number(row.approvedMinutes ?? row.requestedMinutes ?? 0);
    }
  }

  const { reportSalaryAdvances } = await import(
    "@/lib/hr/services/salary-advances"
  );
  const advancesReport = await reportSalaryAdvances(ctx);
  const advanceRows = (advancesReport.rows ?? []) as Array<{
    status: string;
    amount: number;
  }>;
  const openAdvances = advanceRows.filter(
    (r) =>
      r.status === "APPROVED" ||
      r.status === "RECORDED" ||
      r.status === "SUBMITTED",
  );
  const deductedAdvances = advanceRows.filter((r) => r.status === "DEDUCTED");

  return {
    periodLabel: formatThaiDateRange(startIso, endIso),
    periodStart: startIso,
    periodEnd: endIso,
    attendance: {
      present,
      late,
      absent,
      total: attendanceRows.length,
    },
    leave: {
      submitted: leaveSubmitted,
      approved: leaveApproved,
      rejected: leaveRejected,
    },
    overtime: {
      submitted: otSubmitted,
      approved: otApproved,
      approvedMinutes,
    },
    advances: {
      open: openAdvances.length,
      openAmount: openAdvances.reduce((s, r) => s + Number(r.amount || 0), 0),
      deducted: deductedAdvances.length,
      deductedAmount: deductedAdvances.reduce(
        (s, r) => s + Number(r.amount || 0),
        0,
      ),
      total: advanceRows.length,
    },
  };
}
