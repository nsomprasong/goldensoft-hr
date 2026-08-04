"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import Alert from "@/components/hr/alert";
import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import {
  IconClock,
  IconClockIn,
  IconClockOut,
  IconLocate,
} from "@/components/ui/action-icons";
import HrButton from "@/components/ui/hr-button";
import { createClientId } from "@/lib/hr/client-id";
import { extractFaceDescriptor } from "@/lib/hr/client/face-descriptor";
import { compressImageForUpload } from "@/lib/hr/compress-image-client";
import { haversineMeters } from "@/lib/hr/geo";
import type { SelfFaceMatchStatus } from "@/lib/hr/services/face-matching";
import {
  formatThaiDate,
  formatThaiDateCompact,
  formatThaiDateRangeCompact,
} from "@/lib/hr/thai-date";

type ShiftHint = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight?: boolean;
};

type AttendanceDayRow = {
  id: string;
  workDate: string;
  dutyLabel?: string;
  isRestDay?: boolean;
  isLeaveDay?: boolean;
  /** Planned shift wall-clock HH:mm (Bangkok), when assigned. */
  plannedClockIn?: string | null;
  plannedClockOut?: string | null;
  crossesMidnight?: boolean;
  shiftMismatchStatus?: string | null;
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
  branchId?: string | null;
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
    timeout: 20_000,
    maximumAge: 0,
  });
  if (precise.ok || precise.reason === "denied") return precise;
  // Retry without high accuracy (some phones fail the first attempt).
  const coarse = await readCurrentPositionOnce({
    enableHighAccuracy: false,
    timeout: 20_000,
    maximumAge: 60_000,
  });
  if (coarse.ok || coarse.reason === "denied") return coarse;
  // Last try: briefly watch for a fresher fix (common when first fix is cached/stale).
  return readPositionViaWatch({
    enableHighAccuracy: true,
    timeout: 18_000,
    maximumAge: 0,
  });
}

function readPositionViaWatch(options: PositionOptions): Promise<GeoReadResult> {
  if (!navigator.geolocation?.watchPosition) {
    return Promise.resolve({ ok: false, reason: "unavailable" });
  }
  return new Promise((resolve) => {
    let settled = false;
    let best: GeolocationPosition | null = null;
    const finish = (result: GeoReadResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      navigator.geolocation.clearWatch(watchId);
      resolve(result);
    };
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        best = position;
        // Accept as soon as accuracy is usable, or after we get any fix.
        if (
          position.coords.accuracy != null &&
          position.coords.accuracy <= 80
        ) {
          finish({
            ok: true,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          });
        }
      },
      (error) => {
        if (best) {
          finish({
            ok: true,
            latitude: best.coords.latitude,
            longitude: best.coords.longitude,
            accuracyMeters: best.coords.accuracy,
          });
          return;
        }
        if (error.code === error.PERMISSION_DENIED) {
          finish({ ok: false, reason: "denied" });
          return;
        }
        if (error.code === error.TIMEOUT) {
          finish({ ok: false, reason: "timeout" });
          return;
        }
        finish({ ok: false, reason: "unavailable" });
      },
      options,
    );
    const timer = window.setTimeout(() => {
      if (best) {
        finish({
          ok: true,
          latitude: best.coords.latitude,
          longitude: best.coords.longitude,
          accuracyMeters: best.coords.accuracy,
        });
        return;
      }
      finish({ ok: false, reason: "timeout" });
    }, options.timeout ?? 18_000);
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
    return "อ่านตำแหน่งช้าเกินไป — เปิด GPS ของเครื่อง ยืนกลางแจ้งแล้วลองใหม่";
  }
  if (reason === "unsupported") {
    return "อุปกรณ์นี้ไม่รองรับการอ่านตำแหน่ง";
  }
  return "ไม่สามารถอ่านตำแหน่งจากอุปกรณ์ได้ — เปิด Location/GPS แล้วลองใหม่";
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
  const mismatchTitleId = useId();
  const [mismatchConfirm, setMismatchConfirm] = useState<{
    assigned: ShiftHint;
    suggested: ShiftHint | null;
  } | null>(null);
  const [faceMatching, setFaceMatching] = useState<SelfFaceMatchStatus | null>(
    null,
  );
  const [gpsPreview, setGpsPreview] = useState<{
    distanceMeters: number;
    accuracyMeters?: number;
    deviceLat: number;
    deviceLng: number;
  } | null>(null);
  const [gpsPreviewLoading, setGpsPreviewLoading] = useState(false);

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
        faceMatching?: SelfFaceMatchStatus | null;
      };
      setDays(Array.isArray(body.days) ? body.days : []);
      setWorkLocation(body.workLocation ?? null);
      setSchedulePeriod(body.schedulePeriod ?? null);
      setFaceMatching(body.faceMatching ?? null);
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
      const compressed = await compressImageForUpload(file, { force: true });
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
      return { ...device, ok: true as const, workLocationId: workLocation?.id };
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

  async function previewGpsDistance() {
    if (
      workLocation?.latitude == null ||
      workLocation?.longitude == null
    ) {
      setFeedback({
        kind: "error",
        message: "ยังไม่มีหมุดสถานที่ทำงาน — แจ้งแอดมินตั้งค่าก่อน",
      });
      return;
    }
    setGpsPreviewLoading(true);
    setGpsPreview(null);
    try {
      const device = await readCurrentPosition();
      if (!device.ok) {
        setFeedback({ kind: "error", message: geoErrorMessage(device.reason) });
        return;
      }
      const distanceMeters = haversineMeters(
        {
          latitude: workLocation.latitude,
          longitude: workLocation.longitude,
        },
        { latitude: device.latitude, longitude: device.longitude },
      );
      setGpsPreview({
        distanceMeters,
        accuracyMeters: device.accuracyMeters,
        deviceLat: device.latitude,
        deviceLng: device.longitude,
      });
      if (distanceMeters > Math.max(workLocation.geofenceRadiusMeters, 50) + 80) {
        setFeedback({
          kind: "warning",
          message:
            distanceMeters >= 500
              ? `ตอนนี้อยู่ห่างหมุดประมาณ ${Math.round(distanceMeters)} ม. — หมุด「${workLocation.name}」อาจปักผิดที่ หรือเครื่องอ่านตำแหน่งคนละจุด ให้แอดมินตรวจพิกัดในเมนูสถานที่ทำงาน`
              : `ตอนนี้อยู่ห่างหมุดประมาณ ${Math.round(distanceMeters)} ม. (รัศมี ${workLocation.geofenceRadiusMeters} ม.)`,
        });
      } else {
        setFeedback({
          kind: "success",
          message: `อยู่ในระยะหมุด (ห่างประมาณ ${Math.round(distanceMeters)} ม.)`,
        });
      }
    } finally {
      setGpsPreviewLoading(false);
    }
  }

  function openAdjust(row: AttendanceDayRow) {
    const plannedIn = row.plannedClockIn?.slice(0, 5) || null;
    const plannedOut = row.plannedClockOut?.slice(0, 5) || null;
    const recordedIn = row.clockInAt ? formatClockTime(row.clockInAt) : null;
    const recordedOut = row.clockOutAt ? formatClockTime(row.clockOutAt) : null;
    // Prefer actual punches; else planned shift times (night/day); else daytime fallback.
    const inHm =
      recordedIn && recordedIn !== "—"
        ? recordedIn
        : plannedIn || "08:00";
    const outHm =
      recordedOut && recordedOut !== "—"
        ? recordedOut
        : plannedOut || "17:00";
    setAdjustDay(row);
    setAdjustIn(inHm);
    setAdjustOut(outHm);
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
  const clockAction: "clockIn" | "clockOut" | null = canClockIn
    ? "clockIn"
    : canClockOut
      ? "clockOut"
      : null;
  const clockCaption =
    submitting
      ? "กำลังบันทึก…"
      : clockAction === "clockIn"
        ? "ลงเวลาเข้างาน"
        : clockAction === "clockOut"
          ? "ลงเวลาออกงาน"
          : hasClockOut
            ? "ออกงานแล้ว"
            : todayRow?.isRestDay
              ? "วันหยุด"
              : todayRow?.isLeaveDay
                ? "วันลา"
                : "เข้างานแล้ว";
  const clockButtonTitle = !clockAction
    ? hasClockOut
      ? "วันนี้ลงเวลาเข้า–ออกงานครบแล้ว"
      : todayRow?.isRestDay
        ? "วันนี้เป็นวันหยุด"
        : todayRow?.isLeaveDay
          ? "วันนี้เป็นวันลา"
          : "วันนี้ลงเวลาเข้างานแล้ว"
    : !photoBase64
      ? "ถ่ายรูปก่อน"
      : clockCaption;
  const clockButtonAction =
    submitting
      ? ("save" as const)
      : clockAction === "clockOut" || hasClockOut
        ? ("clockOut" as const)
        : ("clockIn" as const);

  async function submit(
    action: "clockIn" | "clockOut",
    options?: {
      confirmShiftMismatch?: boolean;
      requestedShiftId?: string | null;
    },
  ) {
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

      let faceDescriptor: number[] | undefined;
      if (faceMatching?.requireDescriptor) {
        if (faceMatching.mode === "REQUIRE" && !faceMatching.enrolled) {
          setFeedback({
            kind: "error",
            message:
              "ต้องลงทะเบียนใบหน้าก่อนลงเวลา — ไปที่หน้าลงทะเบียนใบหน้า",
          });
          return;
        }
        setFeedback({ kind: "info", message: "กำลังตรวจใบหน้า…" });
        const extracted = await extractFaceDescriptor(photoBase64);
        if (!extracted.ok) {
          if (faceMatching.mode === "REQUIRE") {
            setFeedback({ kind: "error", message: extracted.message });
            return;
          }
          // WARN: continue without descriptor — server records warning
        } else {
          faceDescriptor = extracted.descriptor;
        }
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
          ...(faceDescriptor ? { faceDescriptor } : {}),
          ...(options?.confirmShiftMismatch
            ? {
                confirmShiftMismatch: true,
                requestedShiftId: options.requestedShiftId ?? undefined,
              }
            : {}),
        }),
      });
      if (!response.ok) {
        let detail = "ไม่สามารถลงเวลาได้";
        try {
          const body = (await response.json()) as {
            message?: string;
            error?: {
              message?: string;
              details?: {
                code?: string;
                assignedShift?: ShiftHint | null;
                suggestedShift?: ShiftHint | null;
              };
            };
          };
          const details = body.error?.details;
          if (
            action === "clockIn" &&
            details?.code === "SHIFT_MISMATCH" &&
            details.assignedShift
          ) {
            setMismatchConfirm({
              assigned: details.assignedShift,
              suggested: details.suggestedShift ?? null,
            });
            setFeedback(null);
            return;
          }
          if (body.error?.message?.trim()) detail = body.error.message.trim();
          else if (body.message?.trim()) detail = body.message.trim();
        } catch {
          // keep fallback
        }
        setFeedback({ kind: "error", message: detail });
        return;
      }
      const successBody = (await response.json().catch(() => ({}))) as {
        occurredAt?: string;
        day?: {
          workDate?: string;
          clockInAt?: string | null;
          clockOutAt?: string | null;
        };
        shiftMismatchPending?: boolean;
        faceMatch?: { warning?: string | null };
      };
      setMismatchConfirm(null);
      const punchIso =
        typeof successBody.day?.workDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(successBody.day.workDate)
          ? successBody.day.workDate
          : todayIsoBangkok();
      const punchedIn =
        successBody.day?.clockInAt ??
        (action === "clockIn"
          ? successBody.occurredAt ?? new Date().toISOString()
          : null);
      const punchedOut =
        successBody.day?.clockOutAt ??
        (action === "clockOut"
          ? successBody.occurredAt ?? new Date().toISOString()
          : null);
      setDays((prev) => {
        const idx = prev.findIndex((row) => row.workDate === punchIso);
        const patch = {
          ...(punchedIn ? { clockInAt: punchedIn } : {}),
          ...(punchedOut ? { clockOutAt: punchedOut } : {}),
        };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx]!, ...patch };
          return next;
        }
        return [
          ...prev,
          {
            id: `today-${punchIso}`,
            workDate: punchIso,
            dutyLabel: "—",
            isRestDay: false,
            isLeaveDay: false,
            plannedClockIn: null,
            plannedClockOut: null,
            crossesMidnight: false,
            clockInAt: punchedIn,
            clockOutAt: punchedOut,
            lateLabel: "—",
            earlyLeaveLabel: "—",
          },
        ];
      });
      const faceWarning = successBody.faceMatch?.warning?.trim();
      setFeedback({
        kind: "success",
        title: successBody.shiftMismatchPending
          ? "เข้างานสำเร็จ"
          : "บันทึกสำเร็จ",
        message: [
          successBody.shiftMismatchPending
            ? "บันทึกเวลาเข้างานแล้ว และส่งคำขออนุมัติย้ายกะให้หัวหน้าพิจารณา"
            : "บันทึกเวลาเรียบร้อยแล้ว",
          faceWarning ? `คำเตือนใบหน้า: ${faceWarning}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      });
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
      {faceMatching && faceMatching.mode !== "OFF" && !faceMatching.enrolled ? (
        <Alert kind={faceMatching.mode === "REQUIRE" ? "error" : "warning"}>
          {faceMatching.mode === "REQUIRE"
            ? "องค์กรบังคับตรวจใบหน้า — "
            : "องค์กรเปิดตรวจใบหน้า — "}
          <Link href="/hr/me/face">ลงทะเบียนใบหน้า</Link>
          {faceMatching.mode === "REQUIRE" ? " ก่อนลงเวลา" : " (แนะนำ)"}
        </Alert>
      ) : faceMatching && faceMatching.mode !== "OFF" ? (
        <Alert kind="info">
          ตรวจใบหน้า: {faceMatching.mode === "REQUIRE" ? "บังคับ" : "เตือน"} ·{" "}
          <Link href="/hr/me/face">จัดการใบหน้า</Link>
        </Alert>
      ) : null}
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      <section className="hr-me-clock" aria-label="ลงเวลาวันนี้">
        <header className="hr-me-clock-status">
          <div className="hr-me-clock-meta">
            <div className="hr-me-clock-kicker-row">
              <p className="hr-me-clock-kicker">
                วันนี้ · {formatThaiDate(todayIso)}
                {workLocation
                  ? ` · ${workLocation.name} · รัศมี ${workLocation.geofenceRadiusMeters} ม.`
                  : " · ยังไม่ได้ผูกจุดลงเวลา"}
              </p>
              {workLocation?.latitude != null ? (
                <button
                  type="button"
                  className={`hr-me-clock-locate-btn${
                    gpsPreviewLoading ? " hr-me-clock-locate-btn--busy" : ""
                  }`}
                  disabled={submitting || gpsPreviewLoading}
                  onClick={() => void previewGpsDistance()}
                  aria-label={
                    gpsPreviewLoading
                      ? "กำลังอ่านตำแหน่ง"
                      : "ตรวจระยะจากหมุด"
                  }
                  title={
                    gpsPreviewLoading
                      ? "กำลังอ่านตำแหน่ง…"
                      : "ตรวจระยะจากหมุด"
                  }
                >
                  <span className="hr-me-clock-locate-orb" aria-hidden="true">
                    <span className="hr-me-clock-locate-shine" />
                    <span className="hr-me-clock-locate-glyph">
                      <IconLocate />
                    </span>
                  </span>
                </button>
              ) : null}
              {gpsPreviewLoading ? (
                <span className="hr-me-clock-gps-inline muted" aria-live="polite">
                  …
                </span>
              ) : gpsPreview ? (
                <span
                  className="hr-me-clock-gps-inline"
                  aria-live="polite"
                  title={
                    gpsPreview.accuracyMeters != null
                      ? `ความคลาดเคลื่อน ±${Math.round(gpsPreview.accuracyMeters)} ม.`
                      : undefined
                  }
                >
                  {Math.round(gpsPreview.distanceMeters)} เมตร
                </span>
              ) : null}
            </div>
            {!workLocation ? (
              <p className="hr-me-clock-location">
                แจ้งแอดมินตั้งสถานที่ทำงาน
              </p>
            ) : null}
            {workLocation && workLocation.geofenceRadiusMeters < 30 ? (
              <p className="hr-me-clock-hint muted">
                รัศมีจุดลงเวลาแคบมาก — ถ้าลงเวลาไม่ผ่าน ให้แอดมินขยายเป็นอย่างน้อย 50–100 ม.
              </p>
            ) : null}
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
        </header>

        <div className="hr-me-clock-punch">
          <div className="hr-me-clock-photo">
            <button
              type="button"
              className={
                photoPreview
                  ? "hr-me-clock-photo-frame"
                  : "hr-me-clock-photo-empty"
              }
              disabled={submitting}
              onClick={() => cameraRef.current?.click()}
              aria-label="แตะที่นี่เพื่อถ่ายรูป"
            >
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="ตัวอย่างรูปหลักฐาน" />
              ) : null}
              <span className="hr-me-clock-photo-hint">
                แตะที่นี่เพื่อถ่ายรูป
              </span>
            </button>
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
              className={`hr-me-clock-icon-btn${
                clockAction === "clockOut"
                  ? " hr-me-clock-icon-btn--out"
                  : clockAction
                    ? " hr-me-clock-icon-btn--in"
                    : " hr-me-clock-icon-btn--idle"
              }${submitting ? " hr-me-clock-icon-btn--busy" : ""}`}
              disabled={submitting || !clockAction || !photoBase64}
              onClick={() => {
                if (clockAction) void submit(clockAction);
              }}
              aria-label={clockButtonTitle}
              title={clockButtonTitle}
            >
              <span className="hr-me-clock-icon-btn-orb" aria-hidden="true">
                <span className="hr-me-clock-icon-btn-orb-shine" />
                <span className="hr-me-clock-icon-btn-glyph">
                  {clockButtonAction === "clockOut" || hasClockOut ? (
                    <IconClockOut />
                  ) : clockButtonAction === "save" ? (
                    <IconClock />
                  ) : (
                    <IconClockIn />
                  )}
                </span>
              </span>
              <span className="hr-me-clock-icon-btn-label">{clockCaption}</span>
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
        <div className="hr-me-clock-history-card">
          <div className="hr-me-clock-history-head">
            <h2>ประวัติ</h2>
            {schedulePeriod ? (
              <p>
                {formatThaiDateRangeCompact(
                  schedulePeriod.periodStart,
                  schedulePeriod.periodEnd,
                )}
              </p>
            ) : (
              <p>ยังไม่มีตารางงานที่เผยแพร่</p>
            )}
          </div>

          <div className="hr-me-clock-history-inner">
            {loading ? (
              <p className="muted">กำลังโหลด…</p>
            ) : historyDays.length === 0 ? (
              <p className="empty">ยังไม่มีวันในตารางงานปัจจุบัน</p>
            ) : (
              <div className="table-wrap table-wrap--fit hr-me-clock-history-table-wrap">
                <table className="data-table hr-me-clock-history-table">
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>กะ</th>
                      <th>เข้า</th>
                      <th>ออก</th>
                      <th>สถานะ</th>
                      <th className="col-actions">แก้ไข</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyDays.map((row) => {
                      const off = row.isRestDay || row.isLeaveDay;
                      const sameYearAsPeriod =
                        !!schedulePeriod &&
                        row.workDate.slice(0, 4) ===
                          schedulePeriod.periodStart.slice(0, 4) &&
                        schedulePeriod.periodStart.slice(0, 4) ===
                          schedulePeriod.periodEnd.slice(0, 4);
                      const hasFlags =
                        !off &&
                        (row.lateLabel !== "—" ||
                          row.earlyLeaveLabel !== "—" ||
                          row.shiftMismatchStatus);
                      return (
                        <tr
                          key={row.id}
                          className={
                            row.workDate === todayIso
                              ? "hr-me-clock-history-row--today"
                              : undefined
                          }
                        >
                          <td>
                            <strong>
                              {formatThaiDateCompact(row.workDate, "—", {
                                omitYear: sameYearAsPeriod,
                              })}
                            </strong>
                          </td>
                          <td>{row.dutyLabel ?? (off ? "หยุด" : "—")}</td>
                          <td className="hr-me-clock-history-time">
                            {off ? "—" : formatClockTime(row.clockInAt)}
                          </td>
                          <td className="hr-me-clock-history-time">
                            {off ? "—" : formatClockTime(row.clockOutAt)}
                          </td>
                          <td>
                            {hasFlags ? (
                              <div className="hr-me-clock-day-flags">
                                {row.shiftMismatchStatus === "PENDING" ? (
                                  <span className="badge">รออนุมัติย้ายกะ</span>
                                ) : null}
                                {row.shiftMismatchStatus === "REJECTED" ? (
                                  <span className="badge badge-inactive">
                                    ลงผิดกะ
                                  </span>
                                ) : null}
                                {row.shiftMismatchStatus === "APPROVED" ? (
                                  <span className="badge badge-active">
                                    ย้ายกะแล้ว
                                  </span>
                                ) : null}
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
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td className="col-actions">
                            {!off ? (
                              <HrButton
                                type="button"
                                className="btn btn-sm"
                                onClick={() => openAdjust(row)}
                                disabled={!isOnline || adjustSubmitting}
                              >
                                ขอแก้เวลา
                              </HrButton>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
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
              <HrButton
                type="button"
                className="btn btn-sm"
                onClick={() => setAdjustDay(null)}
                disabled={adjustSubmitting}
                aria-label="ปิด"
              >
                ปิด
              </HrButton>
            </div>
            <div className="hr-overlay-body">
              <form
                className="hr-ot-form"
                method="post"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitAdjust();
                }}
              >
                <p className="muted" style={{ margin: 0 }}>
                  วันที่ {formatThaiDate(adjustDay.workDate)}
                  {adjustDay.dutyLabel ? ` · ${adjustDay.dutyLabel}` : ""}
                  {adjustDay.plannedClockIn && adjustDay.plannedClockOut
                    ? ` (${adjustDay.plannedClockIn.slice(0, 5)}–${adjustDay.plannedClockOut.slice(0, 5)}${adjustDay.crossesMidnight ? " +1" : ""})`
                    : ""}
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
                  <HrButton
                    type="submit"
                    className="btn btn-primary"
                    action="send"
                    disabled={adjustSubmitting}
                  >
                    {adjustSubmitting ? "กำลังส่ง…" : "ส่งคำขอ"}
                  </HrButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {mismatchConfirm ? (
        <div className="hr-overlay" role="presentation">
          <button
            type="button"
            className="hr-overlay-backdrop"
            aria-label="ยกเลิก"
            onClick={() => !submitting && setMismatchConfirm(null)}
          />
          <div
            className="hr-overlay-panel hr-mismatch-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={mismatchTitleId}
          >
            <div className="hr-mismatch-dialog-visual" aria-hidden="true">
              <span className="hr-mismatch-dialog-ring" />
              <svg
                className="hr-mismatch-dialog-swap"
                viewBox="0 0 64 64"
                fill="none"
              >
                <path
                  className="hr-mismatch-dialog-swap-a"
                  d="M18 28h22l-7-7"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  className="hr-mismatch-dialog-swap-b"
                  d="M46 36H24l7 7"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="hr-mismatch-dialog-copy">
              <p className="hr-mismatch-dialog-kicker">ตรวจสอบกะก่อนเข้างาน</p>
              <h2 id={mismatchTitleId}>เวลาเข้าไม่ตรงกับกะที่ถูกจัด</h2>
              <p className="hr-mismatch-dialog-lead">
                ระบบตรวจพบว่าคุณกำลังลงเวลาในช่วงกะอื่น
                กรุณายืนยันหากต้องการเข้างานต่อ
              </p>
              <div className="hr-mismatch-dialog-shifts">
                <div className="hr-mismatch-dialog-shift">
                  <span>กะที่จัดไว้</span>
                  <strong>{mismatchConfirm.assigned.name}</strong>
                  <em>
                    {mismatchConfirm.assigned.startTime}–
                    {mismatchConfirm.assigned.endTime}
                    {mismatchConfirm.assigned.crossesMidnight ? " (+1)" : ""}
                  </em>
                </div>
                {mismatchConfirm.suggested ? (
                  <div className="hr-mismatch-dialog-shift hr-mismatch-dialog-shift--suggest">
                    <span>กะที่ตรงเวลานี้</span>
                    <strong>{mismatchConfirm.suggested.name}</strong>
                    <em>
                      {mismatchConfirm.suggested.startTime}–
                      {mismatchConfirm.suggested.endTime}
                      {mismatchConfirm.suggested.crossesMidnight
                        ? " (+1)"
                        : ""}
                    </em>
                  </div>
                ) : null}
              </div>
              <p className="hr-mismatch-dialog-note">
                เมื่อยืนยัน ระบบจะบันทึกเข้างานทันที
                และส่งคำขออนุมัติย้ายกะเฉพาะวันนี้ให้หัวหน้าพิจารณา
              </p>
            </div>
            <div className="hr-mismatch-dialog-actions">
              <HrButton
                type="button"
                className="btn"
                disabled={submitting}
                onClick={() => setMismatchConfirm(null)}
              >
                ยกเลิก
              </HrButton>
              <HrButton
                type="button"
                className="btn btn-primary"
                action="approve"
                disabled={submitting || !mismatchConfirm.suggested}
                onClick={() =>
                  void submit("clockIn", {
                    confirmShiftMismatch: true,
                    requestedShiftId: mismatchConfirm.suggested?.id ?? null,
                  })
                }
              >
                {submitting ? "กำลังบันทึก…" : "ยืนยันเข้างาน"}
              </HrButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
