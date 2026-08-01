"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import Alert from "@/components/hr/alert";
import { createClientId } from "@/lib/hr/client-id";

export type OperationAction = {
  label: string;
  action: string;
  confirm?: boolean;
};

export type OperationWorkspaceProps = {
  title: string;
  description: string;
  emptyMessage: string;
  endpoint: string;
  actions?: OperationAction[];
  children?: ReactNode;
};

type Status = { kind: "success" | "error" | "info"; message: string } | null;

type AttendanceDayRow = {
  id: string;
  workDate: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  lateLabel: string;
  earlyLeaveLabel: string;
};

type WorkLocationInfo = {
  id: string;
  code: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
};

function messageFromResponse(response: Response): string {
  if (response.status === 404) {
    return "ไม่พบบริการนี้ในระบบ กรุณาลองใหม่หรือติดต่อผู้ดูแล";
  }
  if (response.status >= 500) {
    return "ไม่สามารถบันทึกข้อมูลได้ในขณะนี้ กรุณาลองใหม่ภายหลัง";
  }
  return "ไม่สามารถดำเนินการได้ กรุณาตรวจสอบข้อมูลแล้วลองใหม่";
}

function readCurrentPosition(): Promise<{
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
} | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

function formatClockTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function formatWorkDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const year = Number(match[1]) + 543;
  return `${match[3]}/${match[2]}/${year}`;
}

function parseAttendancePayload(body: unknown): {
  days: AttendanceDayRow[];
  workLocation: WorkLocationInfo | null;
} {
  if (!body || typeof body !== "object") {
    return { days: [], workLocation: null };
  }
  const raw = body as {
    days?: unknown;
    workLocation?: WorkLocationInfo | null;
  };
  const days = Array.isArray(raw.days)
    ? raw.days
        .filter(
          (row): row is AttendanceDayRow =>
            !!row &&
            typeof row === "object" &&
            typeof (row as AttendanceDayRow).id === "string" &&
            typeof (row as AttendanceDayRow).workDate === "string",
        )
        .map((row) => ({
          id: row.id,
          workDate: row.workDate,
          clockInAt: typeof row.clockInAt === "string" ? row.clockInAt : null,
          clockOutAt: typeof row.clockOutAt === "string" ? row.clockOutAt : null,
          lateMinutes:
            typeof row.lateMinutes === "number" ? row.lateMinutes : 0,
          earlyLeaveMinutes:
            typeof row.earlyLeaveMinutes === "number"
              ? row.earlyLeaveMinutes
              : 0,
          lateLabel:
            typeof row.lateLabel === "string"
              ? row.lateLabel
              : row.lateMinutes > 0
                ? `${row.lateMinutes} นาที`
                : "—",
          earlyLeaveLabel:
            typeof row.earlyLeaveLabel === "string"
              ? row.earlyLeaveLabel
              : row.earlyLeaveMinutes > 0
                ? `${row.earlyLeaveMinutes} นาที`
                : "—",
        }))
    : [];
  return {
    days,
    workLocation: raw.workLocation ?? null,
  };
}

export default function OperationsWorkspace({
  title,
  description,
  emptyMessage,
  endpoint,
  actions = [],
  children,
}: OperationWorkspaceProps) {
  const [status, setStatus] = useState<Status>(null);
  const [confirming, setConfirming] = useState<OperationAction | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [attendanceDays, setAttendanceDays] = useState<AttendanceDayRow[]>([]);
  const [workLocation, setWorkLocation] = useState<WorkLocationInfo | null>(
    null,
  );

  const attendance = endpoint === "/api/hr/attendance/clock";

  const loadAttendance = useCallback(async () => {
    if (!attendance) return;
    setLoadingList(true);
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return;
      const body = (await response.json()) as unknown;
      const parsed = parseAttendancePayload(body);
      setAttendanceDays(parsed.days);
      setWorkLocation(parsed.workLocation);
    } catch {
      // Keep prior list; submit path surfaces errors.
    } finally {
      setLoadingList(false);
    }
  }, [attendance, endpoint]);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  async function resolveClockCoordinates(): Promise<{
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    workLocationId?: string;
  } | null> {
    const device = await readCurrentPosition();
    if (!device) return null;
    return {
      ...device,
      workLocationId: workLocation?.id,
    };
  }

  async function submit(action: string, confirmed = false) {
    if (!navigator.onLine) {
      setStatus({
        kind: "error",
        message: "อุปกรณ์ออฟไลน์ จึงยังไม่บันทึกเวลาหรือคำขอใด ๆ",
      });
      return;
    }

    setStatus({ kind: "info", message: "กำลังส่งข้อมูล…" });
    try {
      const location = attendance ? await resolveClockCoordinates() : null;
      if (attendance && !location) {
        setStatus({
          kind: "error",
          message: "ไม่สามารถอ่านตำแหน่งได้ จึงยังไม่บันทึกลงเวลา",
        });
        return;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          idempotencyKey: createClientId(),
          ...(confirmed ? { confirm: true } : {}),
          ...(location ?? {}),
        }),
      });
      if (!response.ok) {
        let detail = messageFromResponse(response);
        try {
          const body = (await response.json()) as {
            message?: string;
            error?: { message?: string };
          };
          if (body.error?.message?.trim()) detail = body.error.message.trim();
          else if (body.message?.trim()) detail = body.message.trim();
        } catch {
          // keep status-based fallback
        }
        setStatus({ kind: "error", message: detail });
        return;
      }
      setStatus({ kind: "success", message: "บันทึกข้อมูลเรียบร้อยแล้ว" });
      setConfirming(null);
      await loadAttendance();
    } catch {
      setStatus({
        kind: "error",
        message: "เชื่อมต่อบริการไม่ได้ ยังไม่มีการบันทึกข้อมูล",
      });
    }
  }

  return (
    <>
      <div className="hr-page-head">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {!isOnline ? (
        <Alert kind="warning">
          คุณกำลังออฟไลน์ — ระบบจะไม่สร้างเวลาเข้างานหรือออกงานแทนคุณ
        </Alert>
      ) : null}
      {status ? <Alert kind={status.kind}>{status.message}</Alert> : null}

      {attendance ? (
        <section className="card">
          <h2>ลงเวลาวันนี้</h2>
          {workLocation ? (
            <p className="hr-clock-location">
              จุดลงเวลา: <strong>{workLocation.name}</strong>
              {workLocation.latitude != null && workLocation.longitude != null
                ? ` (${workLocation.latitude.toFixed(5)}, ${workLocation.longitude.toFixed(5)})`
                : ""}
              {" · "}
              รัศมี {workLocation.geofenceRadiusMeters} ม.
            </p>
          ) : (
            <p className="muted hr-clock-location">
              ยังไม่มีสถานที่ลงเวลาที่ผูกกับพนักงาน — ให้แอดมินตั้งที่เมนูสถานที่ทำงาน
            </p>
          )}

          <p>ระบบจะอ่านตำแหน่งจริงจากเครื่อง ณ เวลาที่กดเข้างานหรือออกงาน</p>

          <div className="inline-actions hr-clock-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => submit("clockIn")}
            >
              เข้างาน
            </button>
            <button type="button" className="btn" onClick={() => submit("clockOut")}>
              ออกงาน
            </button>
          </div>
        </section>
      ) : null}

      {actions.length > 0 ? (
        <section className="card">
          <h2>การดำเนินการ</h2>
          <div className="inline-actions">
            {actions.map((item) => (
              <button
                key={item.action}
                type="button"
                className="btn"
                onClick={() =>
                  item.confirm ? setConfirming(item) : submit(item.action)
                }
              >
                {item.label}
              </button>
            ))}
          </div>
          {confirming ? (
            <div className="alert alert-warning" role="alert">
              <p>
                ยืนยันการ{confirming.label}หรือไม่? การดำเนินการนี้จะส่งคำสั่งไปยังระบบ
              </p>
              <span className="inline-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => submit(confirming.action, true)}
                >
                  ยืนยัน
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setConfirming(null)}
                >
                  ยกเลิก
                </button>
              </span>
            </div>
          ) : null}
        </section>
      ) : null}

      {children ?? (
        <section className="card">
          {attendance ? (
            <>
              <h2>ประวัติวันนี้</h2>
              {loadingList ? (
                <p className="muted">กำลังโหลดประวัติ…</p>
              ) : attendanceDays.length === 0 ? (
                <p className="empty">{emptyMessage}</p>
              ) : (
                <div className="table-wrap table-wrap--fit">
                  <table className="attendance-day-table">
                    <thead>
                      <tr>
                        <th>วันที่</th>
                        <th>เวลาเข้า</th>
                        <th>เวลาออก</th>
                        <th>มาสาย</th>
                        <th>ออกก่อน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceDays.map((row) => (
                        <tr key={row.id}>
                          <td data-label="วันที่">{formatWorkDate(row.workDate)}</td>
                          <td data-label="เวลาเข้า">{formatClockTime(row.clockInAt)}</td>
                          <td data-label="เวลาออก">{formatClockTime(row.clockOutAt)}</td>
                          <td data-label="มาสาย">{row.lateLabel}</td>
                          <td data-label="ออกก่อน">{row.earlyLeaveLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <p className="empty">{emptyMessage}</p>
          )}
        </section>
      )}
    </>
  );
}
