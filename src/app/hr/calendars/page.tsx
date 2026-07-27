import Link from "next/link";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import DeleteCalendarButton from "@/components/hr/delete-calendar-button";
import DeleteHolidayButton from "@/components/hr/delete-holiday-button";
import HolidayForm from "@/components/hr/holiday-form";
import SeedThaiHolidaysButton from "@/components/hr/seed-thai-holidays-button";
import WorkCalendarForm from "@/components/hr/work-calendar-form";
import HrShell from "@/components/hr-shell";
import {
  listHolidayTypeOptions,
  listWorkCalendars,
} from "@/lib/hr/data";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { formatThaiDate } from "@/lib/hr/thai-date";
import { formatWorkDays } from "@/lib/hr/work-days";

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
  const selected =
    calendars.data.find((row) => row.id === id) ??
    calendars.data[0] ??
    null;

  return (
    <HrShell ctx={ctx} active="calendars">
      <div className="hr-page-head">
        <div>
          <h1>ปฏิทินวันทำงาน</h1>
          <p>กำหนดวันทำงานและวันหยุดขององค์กร — ใช้งานง่าย จบในหน้าเดียว</p>
        </div>
      </div>

      <DatabaseUnavailableNotice message={unavailable} />

      {calendars.data.length === 0 ? (
        <WorkCalendarForm disabled={!calendars.available} />
      ) : (
        <>
          <section className="card">
            <h2>ปฏิทินทั้งหมด</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ชื่อ</th>
                    <th>วันทำงาน</th>
                    <th>วันหยุด</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {calendars.data.map((row) => {
                    const active = selected?.id === row.id;
                    return (
                      <tr key={row.id} className={active ? "row-active" : undefined}>
                        <td>
                          <div>{row.name}</div>
                          <div className="muted nowrap">{row.code}</div>
                        </td>
                        <td>{formatWorkDays(row.workDays)}</td>
                        <td>{row.holidays.length}</td>
                        <td>
                          <span className="inline-actions">
                            <Link
                              className={`btn btn-sm${active ? " btn-primary" : ""}`}
                              href={`/hr/calendars?id=${row.id}`}
                            >
                              {active ? "กำลังดู" : "เปิด"}
                            </Link>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {selected ? (
            <div className="calendar-detail" style={{ marginTop: "1rem" }}>
              <div className="hr-page-head" style={{ marginBottom: "0.75rem" }}>
                <div>
                  <h2 style={{ margin: 0 }}>{selected.name}</h2>
                  <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                    {selected.code} · {formatWorkDays(selected.workDays)}
                  </p>
                </div>
                <DeleteCalendarButton
                  calendarId={selected.id}
                  name={selected.name}
                  disabled={!calendars.available}
                />
              </div>

              <WorkCalendarForm
                mode="edit"
                calendarId={selected.id}
                initialName={selected.name}
                initialWorkDays={selected.workDays}
                disabled={!calendars.available}
              />

              <section className="card" style={{ marginTop: "1rem" }}>
                <h2>วันหยุด ({selected.holidays.length})</h2>
                <SeedThaiHolidaysButton
                  calendarId={selected.id}
                  disabled={!calendars.available}
                />
                {selected.holidays.length === 0 ? (
                  <p className="empty">ยังไม่มีวันหยุดในปฏิทินนี้</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>วันที่</th>
                          <th>ชื่อ</th>
                          <th>ประเภท</th>
                          <th>ค่าจ้าง</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.holidays.map((h) => (
                          <tr key={h.id}>
                            <td className="nowrap">
                              {formatThaiDate(h.holidayDate)}
                            </td>
                            <td>{h.name}</td>
                            <td>{h.holidayTypeName}</td>
                            <td>{h.isPaid ? "มี" : "ไม่มี"}</td>
                            <td>
                              <DeleteHolidayButton
                                holidayId={h.id}
                                name={h.name}
                                disabled={!calendars.available}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <div style={{ marginTop: "1rem" }}>
                <HolidayForm
                  calendarId={selected.id}
                  holidayTypes={types.data}
                  disabled={!calendars.available || !types.available}
                />
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: "1rem" }}>
            <details>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                สร้างปฏิทินเพิ่ม
              </summary>
              <div style={{ marginTop: "0.75rem" }}>
                <WorkCalendarForm disabled={!calendars.available} />
              </div>
            </details>
          </div>
        </>
      )}
    </HrShell>
  );
}
