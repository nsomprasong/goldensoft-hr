/**
 * Repair existing Full QA schedules so self-service / admin can use them:
 * - Publish FQA schedule periods (DRAFT → PUBLISHED)
 * - Link day/night shifts to periods
 * - Shift clock times from UTC wall-clock to Asia/Bangkok (+07)
 * - Add weekend rest-day assignments where missing
 *
 *   npx tsx scripts/repair-full-qa-schedules.ts
 */
import { loadProjectEnv } from "./load-project-env";

loadProjectEnv(process.cwd());
process.env.APP_CODE = "HR";

async function main() {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@prisma/client");
  const { Pool } = await import("pg");
  const {
    buildDatabasePoolConfig,
    buildTrustedPgSsl,
    loadSupabaseDbCaCertificate,
  } = await import("../src/lib/db/ca-certificate");
  const { assertSafeEnvironment, requireSafeEnvironment } = await import(
    "../src/lib/env/guard"
  );
  const {
    FULL_QA_ORG_CODES,
    FULL_QA_PREFIX,
    FULL_QA_PERIOD_START,
    FULL_QA_PERIOD_END,
    resolveFullQaPlatformContexts,
  } = await import("../src/lib/seed/full-qa-dataset");

  const projectRoot = process.cwd();
  const guard = assertSafeEnvironment({ projectRoot });
  if (!guard.ok) {
    console.error(`[ENV_GUARD] ${guard.code}: ${guard.reason}`);
    process.exit(1);
  }
  requireSafeEnvironment({ projectRoot });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ต้องกำหนด DATABASE_URL ใน .env.local");
    process.exit(1);
  }

  const { content } = loadSupabaseDbCaCertificate(
    process.env.SUPABASE_DB_CA_CERT_PATH ?? "",
    projectRoot,
  );
  const ssl = buildTrustedPgSsl(content);
  const pool = new Pool(buildDatabasePoolConfig(databaseUrl, ssl, { max: 1 }));
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const db = prisma as any;

  try {
    const published = await db.schedulePeriodStatus.findUnique({
      where: { code: "PUBLISHED" },
    });
    const restDayId = await db.attendanceStatus.findUnique({
      where: { code: "REST_DAY" },
    });
    if (!published || !restDayId) {
      throw new Error("Missing PUBLISHED / REST_DAY masters — run seed:hr");
    }

    const contexts = await resolveFullQaPlatformContexts(prisma);
    const summary: Array<Record<string, unknown>> = [];

    for (const ctx of contexts) {
      const periods = await db.schedulePeriod.findMany({
        where: {
          organizationId: ctx.organizationId,
          code: { startsWith: FULL_QA_PREFIX },
        },
      });
      const dayShift = await db.shift.findUnique({
        where: {
          organizationId_code: {
            organizationId: ctx.organizationId,
            code: `${FULL_QA_PREFIX}DAY`,
          },
        },
      });
      const nightShift = await db.shift.findUnique({
        where: {
          organizationId_code: {
            organizationId: ctx.organizationId,
            code: `${FULL_QA_PREFIX}NIGHT`,
          },
        },
      });
      if (!dayShift || !nightShift) {
        throw new Error(`Shifts missing for ${ctx.orgCode}`);
      }

      const ownerEmail =
        ctx.orgCode === "TEST-ALPHA" ? "a.owner@ex.com" : "b.owner@ex.com";
      const owner = await prisma.$queryRaw<Array<{ auth_user_id: string }>>`
        SELECT up.auth_user_id::text AS auth_user_id
        FROM platform.user_profiles up
        INNER JOIN platform.organization_memberships om ON om.user_profile_id = up.id
        WHERE om.organization_id = ${ctx.organizationId}::uuid
          AND lower(up.email) = ${ownerEmail}
        LIMIT 1
      `;
      const actorId = owner[0]?.auth_user_id ?? null;

      for (const period of periods) {
        await db.schedulePeriod.update({
          where: { id: period.id },
          data: {
            statusId: published.id,
            publishedAt: period.publishedAt ?? new Date(),
            publishedByAuthUserId: period.publishedByAuthUserId ?? actorId,
          },
        });

        const isB2 = String(period.code).includes("B2");
        const shiftIds = isB2 ? [dayShift.id, nightShift.id] : [dayShift.id];
        for (const shiftId of shiftIds) {
          await db.schedulePeriodShift.upsert({
            where: {
              schedulePeriodId_shiftId: {
                schedulePeriodId: period.id,
                shiftId,
              },
            },
            update: {},
            create: { schedulePeriodId: period.id, shiftId },
          });
        }
      }

      // Convert seeded UTC wall-clock (08:00Z shown as 15:00 BKK) → Bangkok wall-clock.
      // Skip rows already converted (UTC hour would be 1/10/13/22 after -7h).
      const timeFix = await prisma.$executeRaw`
        UPDATE hr.attendance_days ad
        SET
          clock_in_at = CASE
            WHEN ad.clock_in_at IS NULL THEN NULL
            ELSE ad.clock_in_at - INTERVAL '7 hours'
          END,
          clock_out_at = CASE
            WHEN ad.clock_out_at IS NULL THEN NULL
            ELSE ad.clock_out_at - INTERVAL '7 hours'
          END,
          updated_at = CURRENT_TIMESTAMP
        FROM hr.employees e
        WHERE e.id = ad.employee_id
          AND e.organization_id = ${ctx.organizationId}::uuid
          AND e.employee_code ~ '^[AB][0-9]{2}$'
          AND ad.work_date BETWEEN ${FULL_QA_PERIOD_START}::date AND ${FULL_QA_PERIOD_END}::date
          AND (
            EXTRACT(HOUR FROM ad.clock_in_at AT TIME ZONE 'UTC') IN (8, 20)
            OR EXTRACT(HOUR FROM ad.clock_out_at AT TIME ZONE 'UTC') IN (5, 17)
          )
      `;

      await prisma.$executeRaw`
        UPDATE hr.attendance_events ae
        SET occurred_at = ae.occurred_at - INTERVAL '7 hours'
        FROM hr.employees e
        WHERE e.id = ae.employee_id
          AND e.organization_id = ${ctx.organizationId}::uuid
          AND e.employee_code ~ '^[AB][0-9]{2}$'
          AND ae.source = 'FULL_QA'
          AND EXTRACT(HOUR FROM ae.occurred_at AT TIME ZONE 'UTC') IN (5, 8, 17, 20)
          AND ae.occurred_at >= ${FULL_QA_PERIOD_START}::timestamptz
          AND ae.occurred_at < (${FULL_QA_PERIOD_END}::date + INTERVAL '2 days')
      `;

      // Weekend rest assignments + attendance days for full calendar coverage.
      const employees = await db.employee.findMany({
        where: {
          organizationId: ctx.organizationId,
          employeeCode: { startsWith: ctx.orgCode === "TEST-ALPHA" ? "A" : "B" },
        },
        select: { id: true, branchId: true, employeeCode: true },
      });
      const periodByBranch = new Map<string, string>();
      for (const p of periods) {
        if (p.branchId) periodByBranch.set(p.branchId, p.id);
      }

      let restCreated = 0;
      const cur = new Date(`${FULL_QA_PERIOD_START}T00:00:00Z`);
      const end = new Date(`${FULL_QA_PERIOD_END}T00:00:00Z`);
      while (cur <= end) {
        const dow = cur.getUTCDay();
        if (dow === 0 || dow === 6) {
          const workDate = new Date(cur);
          for (const emp of employees) {
            const schedulePeriodId = periodByBranch.get(emp.branchId);
            if (!schedulePeriodId) continue;
            await db.shiftAssignment.upsert({
              where: {
                employeeId_workDate_sequenceNo: {
                  employeeId: emp.id,
                  workDate,
                  sequenceNo: 1,
                },
              },
              update: {
                schedulePeriodId,
                shiftId: null,
                workLocationId: null,
                isRestDay: true,
                isLeaveDay: false,
              },
              create: {
                schedulePeriodId,
                employeeId: emp.id,
                shiftId: null,
                workDate,
                sequenceNo: 1,
                isRestDay: true,
                createdByAuthUserId: actorId,
              },
            });
            const assignment = await db.shiftAssignment.findUnique({
              where: {
                employeeId_workDate_sequenceNo: {
                  employeeId: emp.id,
                  workDate,
                  sequenceNo: 1,
                },
              },
            });
            await db.attendanceDay.upsert({
              where: {
                employeeId_workDate: { employeeId: emp.id, workDate },
              },
              update: {
                statusId: restDayId.id,
                clockInAt: null,
                clockOutAt: null,
                scheduledMinutes: 0,
                workedMinutes: 0,
                lateMinutes: 0,
                notes: "วันหยุดประจำสัปดาห์",
                schedulePeriodId,
                shiftAssignmentId: assignment?.id ?? null,
              },
              create: {
                organizationId: ctx.organizationId,
                branchId: emp.branchId,
                employeeId: emp.id,
                workDate,
                statusId: restDayId.id,
                schedulePeriodId,
                shiftAssignmentId: assignment?.id ?? null,
                scheduledMinutes: 0,
                workedMinutes: 0,
                notes: "วันหยุดประจำสัปดาห์",
              },
            });
            restCreated += 1;
          }
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      // Mark leave assignments.
      await prisma.$executeRaw`
        UPDATE hr.shift_assignments sa
        SET is_leave_day = true
        FROM hr.attendance_days ad
        JOIN hr.attendance_statuses st ON st.id = ad.status_id
        WHERE sa.employee_id = ad.employee_id
          AND sa.work_date = ad.work_date
          AND st.code = 'LEAVE'
          AND ad.organization_id = ${ctx.organizationId}::uuid
      `;

      summary.push({
        orgCode: ctx.orgCode,
        periodsPublished: periods.length,
        timeFixRows: timeFix,
        restCreated,
        orgCodes: FULL_QA_ORG_CODES,
      });
    }

    console.log(JSON.stringify({ ok: true, summary }, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
