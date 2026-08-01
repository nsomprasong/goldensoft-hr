"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import Alert from "@/components/hr/alert";
import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import { createClientId } from "@/lib/hr/client-id";
import { compressImageForUpload } from "@/lib/hr/compress-image-client";
import { formatThaiDate, formatThaiDateRange } from "@/lib/hr/thai-date";

type AttendanceDayRow = {
  id: string;
  workDate: string;
  dutyLabel?: string;
  isRestDay?: boolean;
  isLeaveDay?: boolean;
  clockInAt: string | null;
  clockOutAt: string | null;
  lateLabel: string;
  earlyLeaveLabel: string;
};

type SchedulePeriodInfo = {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  statusCode: string;
  statusName: string;
};

type WorkLocationInfo = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
};

type GpsMode = "device" | "inside" | "outside";

const isDev =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

/** Phone browsers block GPS on http://LAN-IP (not a secure context). */
function isInsecureHttpOrigin(): boolean {
  return typeof window !== "undefined" && !window.isSecureContext;
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

function todayIsoBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type GeoReadResult =
  | {
      ok: true;
      latitude: number;
      longitude: number;
      accuracyMeters?: number;
    }
  | { ok: false; reason: "unsupported" | "denied" | "unavailable" | "timeout" };

function readCurrentPositionOnce(options: PositionOptions): Promise<GeoReadResult> {
  if (!navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: "unsupported" });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ ok: false, reason: "denied" });
          return;
        }
        if (error.code === error.TIMEOUT) {
          resolve({ ok: false, reason: "timeout" });
          return;
        }
        resolve({ ok: false, reason: "unavailable" });
      },
      options,
    );
  });
}

async function readCurrentPosition(): Promise<GeoReadResult> {
  if (isInsecureHttpOrigin()) {
    return { ok: false, reason: "unavailable" };
  }
  const precise = await readCurrentPositionOnce({
    enableHighAccuracy: true,
    timeout: 12_000,
    maximumAge: 0,
  });
  if (precise.ok || precise.reason === "denied") return precise;
  // Retry without high accuracy (some phones fail the first attempt).
  return readCurrentPositionOnce({
    enableHighAccuracy: false,
    timeout: 12_000,
    maximumAge: 60_000,
  });
}

function geoErrorMessage(
  reason: "unsupported" | "denied" | "unavailable" | "timeout",
): string {
  if (isInsecureHttpOrigin()) {
    return isDev
      ? "เบราว์เซอร์ไม่ให้ใช้ GPS บน HTTP (มือถือผ่าน IP) — เลือก «จำลอง: อยู่ในรัศมี» ในแผงทดสอบด้านล่าง แล้วกดลงเวลาอีกครั้ง"
      : "เบราว์เซอร์ไม่ให้ใช้ GPS บน HTTP — ต้องเปิดระบบผ่าน HTTPS จึงจะอ่านตำแหน่งได้";
  }
  if (reason === "denied") {
    return "ไม่อนุญาตการเข้าถึงตำแหน่ง — เปิด Location ในเบราว์เซอร์แล้วลองใหม่";
  }
  if (reason === "timeout") {
    return "อ่านตำแหน่งช้าเกินไป — เปิด GPS ของเครื่องแล้วลองใหม่";
  }
  if (reason === "unsupported") {
    return "อุปกรณ์นี้ไม่รองรับการอ่านตำแหน่ง";
  }
  return "ไม่สามารถอ่านตำแหน่งได้ จึงยังไม่บันทึกลงเวลา";
}

export default function MeAttendanceWorkspace() {
  const cameraId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [days, setDays] = useState<AttendanceDayRow[]>([]);
  const [schedulePeriod, setSchedulePeriod] =
    useState<SchedulePeriodInfo | null>(null);
  const [workLocation, setWorkLocation] = useState<WorkLocationInfo | null>(
    null,
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [gpsMode, setGpsMode] = useState<GpsMode>("device");
  const [insecureHttp, setInsecureHttp] = useState(false);
  const [adjustDay, setAdjustDay] = useState<AttendanceDayRow | null>(null);
  const [adjustIn, setAdjustIn] = useState("08:00");
  const [adjustOut, setAdjustOut] = useState("17:00");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const adjustTitleId = useId();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/hr/attendance/clock", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return;
      const body = (await response.json()) as {
        days?: AttendanceDayRow[];
        workLocation?: WorkLocationInfo | null;
        schedulePeriod?: SchedulePeriodInfo | null;
      };
      setDays(Array.isArray(body.days) ? body.days : []);
      setWorkLocation(body.workLocation ?? null);
      setSchedulePeriod(body.schedulePeriod ?? null);
    } catch {
      // keep prior
    } finally {
      setLoading(false);
    }
  }, []);

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
    const insecure = isInsecureHttpOrigin();
    setInsecureHttp(insecure);
    // LAN phone testing over http://192.168.x.x cannot use device GPS.
    if (isDev && insecure) {
      setGpsMode("inside");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  async function applyPhoto(file: File | null) {
    if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    if (!file) {
      setPhotoPreview(null);
      setPhotoBase64(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setFeedback({ kind: "error", message: "กรุณาเลือกไฟล์รูปภาพเท่านั้น" });
      return;
    }
    setFeedback({ kind: "info", message: "กำลังย่อขนาดรูป…" });
    try {
      const compressed = await compressImageForUpload(file);
      setPhotoPreview(compressed.previewUrl);
      setPhotoBase64(compressed.dataUrl);
      setFeedback(null);
    } catch (error) {
      setPhotoPreview(null);
      setPhotoBase64(null);
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "ย่อขนาดรูปไม่สำเร็จ กรุณาถ่ายใหม่",
      });
    }
  }

  function mockCoordinates(mode: Exclude<GpsMode, "device">): {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    workLocationId?: string;
  } | null {
    if (workLocation?.latitude == null || workLocation?.longitude == null) {
      return null;
    }
    const lat = workLocation.latitude;
    const lng = workLocation.longitude;
    return {
      latitude: mode === "inside" ? lat : lat - 0.01,
      longitude: lng,
      accuracyMeters: 10,
      workLocationId: workLocation.id,
    };
  }

  async function resolveCoordinates(): Promise<
    | {
        ok: true;
        latitude: number;
        longitude: number;
        accuracyMeters?: number;
        workLocationId?: string;
      }
    | { ok: false; message: string }
  > {
    if (isDev && gpsMode !== "device") {
      const mocked = mockCoordinates(gpsMode);
      if (!mocked) {
        return {
          ok: false,
          message:
            "ยังไม่ผูกจุดลงเวลาให้พนักงานนี้ — ตั้งสถานที่ทำงานก่อน จึงจะจำลอง GPS ได้",
        };
      }
      return { ok: true, ...mocked };
    }

    const device = await readCurrentPosition();
    if (device.ok) {
      return { ok: true, ...device, workLocationId: workLocation?.id };
    }

    // Dev on HTTP LAN: device GPS is blocked — use work-location mock automatically.
    if (isDev && isInsecureHttpOrigin()) {
      const mocked = mockCoordinates("inside");
      if (mocked) {
        return { ok: true, ...mocked };
      }
    }

    return { ok: false, message: geoErrorMessage(device.reason) };
  }

  function openAdjust(row: AttendanceDayRow) {
    const inHm = row.clockInAt
      ? formatClockTime(row.clockInAt)
      : "08:00";
    const outHm = row.clockOutAt
      ? formatClockTime(row.clockOutAt)
      : "17:00";
    setAdjustDay(row);
    setAdjustIn(inHm === "—" ? "08:00" : inHm);
    setAdjustOut(outHm === "—" ? "17:00" : outHm);
    setAdjustReason("");
  }

  async function submitAdjust() {
    if (!adjustDay) return;
    if (!navigator.onLine) {
      setFeedback({
        kind: "error",
        message: "อุปกรณ์ออฟไลน์ จึงยังไม่ส่งคำขอ",
      });
      return;
    }
    const reason = adjustReason.trim();
    if (reason.length < 2) {
      setFeedback({
        kind: "error",
        message: "กรุณาระบุเหตุผลอย่างน้อย 2 ตัวอักษร",
      });
      return;
    }
    setAdjustSubmitting(true);
    setFeedback({ kind: "info", message: "กำลังส่งคำขอปรับปรุงเวลา…" });
    try {
      const outDate =
        adjustOut <= adjustIn
          ? (() => {
              const d = new Date(`${adjustDay.workDate}T12:00:00+07:00`);
              d.setDate(d.getDate() + 1);
              return d.toISOString().slice(0, 10);
            })()
          : adjustDay.workDate;
      const response = await fetch("/api/hr/attendance/adjustments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          workDate: adjustDay.workDate,
          requestedClockInAt: `${adjustDay.workDate}T${adjustIn}:00+07:00`,
          requestedClockOutAt: `${outDate}T${adjustOut}:00+07:00`,
          reason,
          idempotencyKey: createClientId(),
        }),
      });
      if (!response.ok) {
        let detail = "ส่งคำขอไม่สำเร็จ";
        try {
          const payload = (await response.json()) as {
            error?: { message?: string };
          };
          if (payload.error?.message?.trim()) {
            detail = payload.error.message.trim();
          }
        } catch {
          // keep fallback
        }
        throw new Error(detail);
      }
      setAdjustDay(null);
      setFeedback({
        kind: "success",
        message: "ส่งคำขอปรับปรุงเวลาแล้ว รออนุมัติ",
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error ? error.message : "ส่งคำขอไม่สำเร็จ",
      });
    } finally {
      setAdjustSubmitting(false);
    }
  }

  const todayIso = todayIsoBangkok();
  const todayRow =
    days.find((row) => row.workDate === todayIso) ?? null;
  const hasClockIn = Boolean(todayRow?.clockInAt);
  const hasClockOut = Boolean(todayRow?.clockOutAt);
  const canClockIn = !hasClockIn && !todayRow?.isRestDay && !todayRow?.isLeaveDay;
  const canClockOut =
    hasClockIn && !hasClockOut && !todayRow?.isRestDay && !todayRow?.isLeaveDay;

  async function submit(action: "clockIn" | "clockOut") {
    if (!navigator.onLine) {
      setFeedback({
        kind: "error",
        message: "อุปกรณ์ออฟไลน์ จึงยังไม่บันทึกเวลา",
      });
      return;
    }
    if (action === "clockIn" && hasClockIn) {
      setFeedback({
        kind: "error",
        message: "วันนี้ลงเวลาเข้างานแล้ว ไม่สามารถลงซ้ำได้",
      });
      return;
    }
    if (action === "clockOut" && !hasClockIn) {
      setFeedback({
        kind: "error",
        message: "ยังไม่ได้ลงเวลาเข้างาน จึงยังออกงานไม่ได้",
      });
      return;
    }
    if (action === "clockOut" && hasClockOut) {
      setFeedback({
        kind: "error",
        message: "วันนี้ลงเวลาออกงานแล้ว ไม่สามารถลงซ้ำได้",
      });
      return;
    }
    if (!photoBase64) {
      setFeedback({
        kind: "error",
        message: "ต้องถ่ายรูปหลักฐานก่อนลงเวลา",
      });
      return;
    }

    setSubmitting(true);
    setFeedback({ kind: "info", message: "กำลังอ่านตำแหน่ง…" });
    try {
      const location = await resolveCoordinates();
      if (!location.ok) {
        setFeedback({
          kind: "error",
          message: location.message,
        });
        return;
      }
      setFeedback({ kind: "info", message: "กำลังส่งข้อมูล…" });

      const response = await fetch("/api/hr/attendance/clock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          idempotencyKey: createClientId(),
          photoBase64,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracyMeters: location.accuracyMeters,
          workLocationId: location.workLocationId,
        }),
      });
      if (!response.ok) {
        let detail = "ไม่สามารถลงเวลาได้";
        try {
          const body = (await response.json()) as {
            message?: string;
            error?: { message?: string };
          };
          if (body.error?.message?.trim()) detail = body.error.message.trim();
          else if (body.message?.trim()) detail = body.message.trim();
        } catch {
          // keep fallback
        }
        setFeedback({ kind: "error", message: detail });
        return;
      }
      setFeedback({ kind: "success", message: "บันทึกลงเวลาเรียบร้อยแล้ว" });
      if (cameraRef.current) cameraRef.current.value = "";
      await applyPhoto(null);
      await load();
    } catch (error) {
      const detail =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "เชื่อมต่อบริการไม่ได้ ยังไม่มีการบันทึกข้อมูล";
      setFeedback({
        kind: "error",
        message: detail.includes("UUID") || detail.includes("randomUUID")
          ? "อุปกรณ์นี้สร้างรหัสรายการไม่ได้ — รีเฟรชหน้าแล้วลองใหม่"
          : detail.startsWith("Failed to fetch") ||
              detail.includes("NetworkError")
            ? "เชื่อมต่อบริการไม่ได้ ยังไม่มีการบันทึกข้อมูล"
            : detail,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const historyDays = [...days].reverse();

  return (
    <>
      {!isOnline ? (
        <Alert kind="warning">
          คุณกำลังออฟไลน์ — ระบบจะไม่สร้างเวลาเข้างานหรือออกงานแทนคุณ
        </Alert>
      ) : null}
      {isDev && insecureHttp ? (
        <Alert kind="warning">
          เปิดผ่าน HTTP บนมือถือ — ใช้ตำแหน่งจำลองเพื่อทดสอบลงเวลา
        </Alert>
      ) : null}
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      <section className="hr-me-clock" aria-label="ลงเวลาวันนี้">
        <div className="hr-me-clock-status">
          <div>
            <p className="hr-me-clock-kicker">วันนี้ · {formatThaiDate(todayIso)}</p>
            <p className="hr-me-clock-location">
              {workLocation
                ? `${workLocation.name} · รัศมี ${workLocation.geofenceRadiusMeters} ม.`
                : "ยังไม่ได้ผูกจุดลงเวลา — แจ้งแอดมินตั้งสถานที่ทำงาน"}
            </p>
          </div>
          <div className="hr-me-clock-times" aria-label="สถานะวันนี้">
            <div>
              <span>เข้า</span>
              <strong>{formatClockTime(todayRow?.clockInAt ?? null)}</strong>
            </div>
            <div>
              <span>ออก</span>
              <strong>{formatClockTime(todayRow?.clockOutAt ?? null)}</strong>
            </div>
          </div>
        </div>

        <div className="hr-me-clock-punch">
          <div className="hr-me-clock-photo">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="ตัวอย่างรูปหลักฐาน" />
            ) : (
              <button
                type="button"
                className="hr-me-clock-photo-empty"
                disabled={submitting}
                onClick={() => cameraRef.current?.click()}
              >
                ถ่ายรูปหลักฐาน
              </button>
            )}
            <div className="hr-me-clock-photo-actions">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={submitting}
                onClick={() => cameraRef.current?.click()}
              >
                {photoPreview ? "ถ่ายใหม่" : "ถ่ายรูป"}
              </button>
              {photoPreview ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={submitting}
                  onClick={() => {
                    if (cameraRef.current) cameraRef.current.value = "";
                    void applyPhoto(null);
                  }}
                >
                  ล้าง
                </button>
              ) : null}
            </div>
            <input
              id={cameraId}
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="user"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void applyPhoto(file);
              }}
            />
          </div>

          <div className="hr-me-clock-actions">
            <button
              type="button"
              className="btn btn-primary hr-me-clock-btn"
              disabled={submitting || !photoBase64 || !canClockIn}
              onClick={() => void submit("clockIn")}
              title={
                hasClockIn
                  ? "วันนี้ลงเวลาเข้างานแล้ว"
                  : !photoBase64
                    ? "ถ่ายรูปก่อน"
                    : "เข้างาน"
              }
            >
              {submitting ? "กำลังบันทึก…" : hasClockIn ? "เข้างานแล้ว" : "เข้างาน"}
            </button>
            <button
              type="button"
              className="btn hr-me-clock-btn"
              disabled={submitting || !photoBase64 || !canClockOut}
              onClick={() => void submit("clockOut")}
              title={
                hasClockOut
                  ? "วันนี้ลงเวลาออกงานแล้ว"
                  : !hasClockIn
                    ? "ต้องเข้างานก่อน"
                    : !photoBase64
                      ? "ถ่ายรูปก่อน"
                      : "ออกงาน"
              }
            >
              {hasClockOut ? "ออกงานแล้ว" : "ออกงาน"}
            </button>
          </div>
        </div>

        {isDev ? (
          <details className="hr-gps-dev-panel">
            <summary>ทดสอบ GPS (dev)</summary>
            <div className="inline-actions" style={{ marginTop: "0.5rem" }}>
              {(
                [
                  ["device", "GPS จริง"],
                  ["inside", "ในรัศมี"],
                  ["outside", "นอกรัศมี"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={
                    gpsMode === mode ? "btn btn-sm btn-primary" : "btn btn-sm"
                  }
                  onClick={() => setGpsMode(mode)}
                  disabled={
                    submitting ||
                    !workLocation ||
                    (mode === "device" && insecureHttp)
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </details>
        ) : null}
      </section>

      <section className="hr-me-clock-history" aria-label="ประวัติลงเวลา">
        <div className="hr-me-clock-history-head">
          <h2>ประวัติ</h2>
          {schedulePeriod ? (
            <p>
              {schedulePeriod.name} ·{" "}
              {formatThaiDateRange(
                schedulePeriod.periodStart,
                schedulePeriod.periodEnd,
              )}
            </p>
          ) : (
            <p>ยังไม่มีตารางงานที่เผยแพร่</p>
          )}
        </div>

        {loading ? (
          <p className="muted">กำลังโหลด…</p>
        ) : historyDays.length === 0 ? (
          <p className="empty">ยังไม่มีวันในตารางงานปัจจุบัน</p>
        ) : (
          <ul className="hr-me-clock-day-list">
            {historyDays.map((row) => {
              const off = row.isRestDay || row.isLeaveDay;
              return (
                <li
                  key={row.id}
                  className={
                    row.workDate === todayIso
                      ? "hr-me-clock-day hr-me-clock-day--today"
                      : "hr-me-clock-day"
                  }
                >
                  <div className="hr-me-clock-day-main">
                    <strong>{formatThaiDate(row.workDate)}</strong>
                    <span>{row.dutyLabel ?? (off ? "หยุด" : "—")}</span>
                  </div>
                  <div className="hr-me-clock-day-times">
                    <span>
                      เข้า {off ? "—" : formatClockTime(row.clockInAt)}
                    </span>
                    <span>
                      ออก {off ? "—" : formatClockTime(row.clockOutAt)}
                    </span>
                  </div>
                  {!off &&
                  (row.lateLabel !== "—" || row.earlyLeaveLabel !== "—") ? (
                    <div className="hr-me-clock-day-flags">
                      {row.lateLabel !== "—" ? (
                        <span className="badge badge-inactive">
                          สาย {row.lateLabel}
                        </span>
                      ) : null}
                      {row.earlyLeaveLabel !== "—" ? (
                        <span className="badge badge-inactive">
                          ออกก่อน {row.earlyLeaveLabel}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {!off ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => openAdjust(row)}
                      disabled={!isOnline || adjustSubmitting}
                    >
                      ขอแก้เวลา
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {adjustDay ? (
        <div className="hr-overlay" role="presentation">
          <button
            type="button"
            className="hr-overlay-backdrop"
            aria-label="ปิด"
            onClick={() => !adjustSubmitting && setAdjustDay(null)}
          />
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={adjustTitleId}
          >
            <div className="hr-overlay-head hr-period-create-overlay-head">
              <div>
                <p className="hr-period-create-overlay-kicker">ลงเวลาของฉัน</p>
                <h2 id={adjustTitleId}>ขอแก้ไขเวลา</h2>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setAdjustDay(null)}
                disabled={adjustSubmitting}
                aria-label="ปิด"
              >
                ปิด
              </button>
            </div>
            <div className="hr-overlay-body">
              <form
                className="hr-ot-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitAdjust();
                }}
              >
                <p className="muted" style={{ margin: 0 }}>
                  วันที่ {formatThaiDate(adjustDay.workDate)}
                </p>
                <div className="hr-ot-form-times">
                  <label className="hr-shift-field">
                    <span>เวลาเข้าที่ขอ</span>
                    <input
                      type="time"
                      value={adjustIn}
                      onChange={(event) => setAdjustIn(event.target.value)}
                      required
                      disabled={adjustSubmitting}
                    />
                  </label>
                  <div className="hr-ot-form-times-sep" aria-hidden="true">
                    →
                  </div>
                  <label className="hr-shift-field">
                    <span>เวลาออกที่ขอ</span>
                    <input
                      type="time"
                      value={adjustOut}
                      onChange={(event) => setAdjustOut(event.target.value)}
                      required
                      disabled={adjustSubmitting}
                    />
                  </label>
                </div>
                <label className="hr-shift-field">
                  <span>เหตุผล</span>
                  <textarea
                    value={adjustReason}
                    onChange={(event) => setAdjustReason(event.target.value)}
                    rows={2}
                    required
                    disabled={adjustSubmitting}
                    placeholder="เช่น ลืมลงออก / ลงผิดเวลา"
                  />
                </label>
                <div className="form-actions hr-ot-form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={adjustSubmitting}
                  >
                    {adjustSubmitting ? "กำลังส่ง…" : "ส่งคำขอ"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
