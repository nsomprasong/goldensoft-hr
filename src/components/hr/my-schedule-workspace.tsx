import { formatThaiDate, formatThaiDateRange } from "@/lib/hr/thai-date";

export type MyScheduleAssignment = {
  id: string;
  workDate: string;
  isRestDay: boolean;
  isLeaveDay: boolean;
  coversForName?: string | null;
  previousShiftName?: string | null;
  isCoverDuty?: boolean;
  shiftName: string | null;
  startTime: string | null;
  endTime: string | null;
  timeLabel: string | null;
  periodId: string;
  periodName: string;
  periodStart: string;
  periodEnd: string;
  statusCode: string;
  statusName: string;
};

type ScheduleSegment = {
  key: string;
  startDate: string;
  endDate: string;
  dayCount: number;
  dutyLabel: string;
  timeLabel: string | null;
  note: string | null;
  isCoverDuty: boolean;
  statusCode: string;
  statusName: string;
  periodId: string;
};

function dutyKey(day: MyScheduleAssignment): string {
  if (day.isRestDay) return "rest";
  if (day.isLeaveDay) return "leave";
  return `shift:${day.shiftName ?? ""}|${day.timeLabel ?? ""}|cover:${day.coversForName ?? ""}`;
}

function dutyLabel(day: MyScheduleAssignment): string {
  if (day.isRestDay) return "วันหยุด";
  if (day.isLeaveDay) return "ลา";
  if (day.coversForName) {
    return `${day.shiftName ?? "กะ"} (แทน ${day.coversForName})`;
  }
  return day.shiftName ?? "—";
}

function dutyNote(day: MyScheduleAssignment): string | null {
  if (day.isRestDay) return "วันหยุดประจำ";
  if (day.isLeaveDay) return "วันลา";
  if (day.coversForName) {
    if (day.previousShiftName) {
      return `เปลี่ยนกะจาก「${day.previousShiftName}」→「${day.shiftName ?? "กะ"}」เพื่อทำงานแทน ${day.coversForName}`;
    }
    return `เปลี่ยนกะเพื่อทำงานแทน ${day.coversForName}`;
  }
  return null;
}

function parseUtcDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function isNextCalendarDay(prevIso: string, nextIso: string): boolean {
  return parseUtcDay(nextIso) - parseUtcDay(prevIso) === 86_400_000;
}

/** Collapse consecutive same-duty days into range cards. */
export function groupScheduleSegments(
  assignments: MyScheduleAssignment[],
): ScheduleSegment[] {
  if (assignments.length === 0) return [];

  const sorted = [...assignments].sort((a, b) =>
    a.workDate.localeCompare(b.workDate),
  );

  const segments: ScheduleSegment[] = [];
  let current: {
    start: MyScheduleAssignment;
    end: MyScheduleAssignment;
    count: number;
    key: string;
  } | null = null;

  for (const day of sorted) {
    const key = dutyKey(day);
    if (
      current &&
      current.key === key &&
      isNextCalendarDay(current.end.workDate, day.workDate)
    ) {
      current.end = day;
      current.count += 1;
      continue;
    }
    if (current) {
      segments.push(toSegment(current));
    }
    current = { start: day, end: day, count: 1, key };
  }
  if (current) segments.push(toSegment(current));
  return segments;
}

function toSegment(block: {
  start: MyScheduleAssignment;
  end: MyScheduleAssignment;
  count: number;
  key: string;
}): ScheduleSegment {
  const { start, end, count } = block;
  return {
    key: `${start.periodId}:${start.workDate}:${end.workDate}:${block.key}`,
    startDate: start.workDate,
    endDate: end.workDate,
    dayCount: count,
    dutyLabel: dutyLabel(start),
    timeLabel:
      start.isRestDay || start.isLeaveDay ? null : (start.timeLabel ?? null),
    note: dutyNote(start),
    isCoverDuty: Boolean(start.isCoverDuty || start.coversForName),
    statusCode: start.statusCode,
    statusName: start.statusName,
    periodId: start.periodId,
  };
}

function statusBadgeClass(statusCode: string): string {
  if (statusCode === "PUBLISHED") return "badge hr-schedule-badge hr-schedule-badge--published";
  if (statusCode === "LOCKED") return "badge hr-schedule-badge hr-schedule-badge--locked";
  return "badge hr-schedule-badge";
}

function statusBadgeLabel(statusCode: string, fallback: string): string {
  if (statusCode === "PUBLISHED") return "เผยแพร่แล้ว";
  if (statusCode === "LOCKED") return "ล็อกแล้ว";
  return fallback;
}

export default function MyScheduleWorkspace({
  assignments,
  pendingPublish,
}: {
  assignments: MyScheduleAssignment[];
  pendingPublish: boolean;
}) {
  if (assignments.length === 0) {
    return (
      <section className="card">
        <p className="empty">
          {pendingPublish
            ? "มีตารางกะที่จัดให้แล้ว แต่ยังไม่ถูกเปิดใช้ — รอแอดมินกดเปิดใช้ตารางกะ"
            : "ยังไม่มีตารางงานที่เผยแพร่สำหรับช่วงเวลานี้"}
        </p>
      </section>
    );
  }

  const segments = groupScheduleSegments(assignments);

  return (
    <div className="hr-card-grid">
      {segments.map((segment) => (
        <article
          key={segment.key}
          className={
            segment.isCoverDuty
              ? "card hr-entity-card hr-schedule-card--cover"
              : "card hr-entity-card"
          }
        >
          <div className="hr-entity-card-top">
            <div className="hr-entity-card-title-wrap">
              <h2 className="hr-entity-card-title">
                ตารางงาน{" "}
                {segment.startDate === segment.endDate
                  ? formatThaiDate(segment.startDate)
                  : formatThaiDateRange(segment.startDate, segment.endDate)}
              </h2>
              <p className="hr-entity-card-subtitle">
                {segment.isCoverDuty
                  ? segment.dayCount === 1
                    ? "ทำงานแทน · 1 วัน"
                    : `ทำงานแทน · ${segment.dayCount} วัน`
                  : segment.dayCount === 1
                    ? "1 วัน"
                    : `${segment.dayCount} วันติดกัน`}
              </p>
            </div>
            {segment.isCoverDuty ? (
              <span className="badge hr-schedule-badge hr-schedule-badge--cover">
                ทำงานแทน
              </span>
            ) : (
              <span className={statusBadgeClass(segment.statusCode)}>
                {statusBadgeLabel(segment.statusCode, segment.statusName)}
              </span>
            )}
          </div>

          <dl className="hr-entity-card-meta">
            <div>
              <dt>กะที่รับผิดชอบ</dt>
              <dd>{segment.dutyLabel}</dd>
            </div>
            <div>
              <dt>เวลา</dt>
              <dd>{segment.timeLabel ?? "—"}</dd>
            </div>
            {segment.note ? (
              <div>
                <dt>หมายเหตุ</dt>
                <dd>{segment.note}</dd>
              </div>
            ) : null}
          </dl>
        </article>
      ))}
    </div>
  );
}
