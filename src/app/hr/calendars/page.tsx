import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import CalendarsWorkspace from "@/components/hr/calendars-workspace";
import HrShell from "@/components/hr-shell";
import {
  listHolidayTypeOptions,
  listWorkCalendars,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function CalendarsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.calendarManage });
  const { id } = await searchParams;
  const [calendars, types] = await Promise.all([
    listWorkCalendars(ctx),
    listHolidayTypeOptions(ctx),
  ]);
  const unavailable = calendars.message || types.message;
  const selected = id
    ? (calendars.data.find((row) => row.id === id) ?? null)
    : null;

  return (
    <HrShell ctx={ctx} active="calendars">
      <div className="hr-page-head">
        <div>
          <h1>ปฏิทินวันทำงาน</h1>
          <p>กำหนดวันทำงานและวันหยุดขององค์กร</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={unavailable} />

      <CalendarsWorkspace
        calendars={calendars.data}
        holidayTypes={types.data}
        selected={selected}
        available={calendars.available && types.available}
      />
    </HrShell>
  );
}
