"use client";

import Link from "next/link";

import DeleteSchedulePeriodButton from "@/components/hr/delete-schedule-period-button";
import type { OverlappingSchedulePeriod } from "@/lib/hr/data";
import { formatThaiDateRange } from "@/lib/hr/thai-date";

export default function ScheduleOverlapPanel({
  periods,
  canManage,
  available,
  currentScheduleId,
}: {
  periods: Array<
    OverlappingSchedulePeriod & {
      hasAttendance?: boolean;
      attendanceDayCount?: number;
    }
  >;
  canManage: boolean;
  available: boolean;
  currentScheduleId: string;
}) {
  if (periods.length === 0) return null;

  return (
    <section className="hr-schedule-overlap" aria-label="ช่วงตารางที่ทับกัน">
      <div className="hr-schedule-overlap-head">
        <h2>ช่วงตารางที่ทับกัน</h2>
        <p>
          มีช่วงเก่าทับวันที่ของตารางนี้ — ควรลบหรือแก้ช่วงเก่าก่อนจัดพนักงาน
          เพื่อไม่ให้วันชนกัน
        </p>
      </div>
      <ul className="hr-schedule-overlap-list">
        {periods.map((row) => (
          <li key={row.id}>
            <div>
              <strong>{row.name}</strong>
              <span>
                {formatThaiDateRange(row.periodStart, row.periodEnd)} ·{" "}
                {row.statusName}
              </span>
            </div>
            <div className="hr-schedule-overlap-actions">
              <Link className="btn btn-sm" href={`/hr/schedules/${row.id}`}>
                เปิด
              </Link>
              {canManage ? (
                <DeleteSchedulePeriodButton
                  scheduleId={row.id}
                  name={row.name}
                  statusCode={row.statusCode}
                  hasAttendance={Boolean(row.hasAttendance)}
                  attendanceDayCount={row.attendanceDayCount ?? 0}
                  disabled={!available}
                  redirectTo={`/hr/schedules/${currentScheduleId}`}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
