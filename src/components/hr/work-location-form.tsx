"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import {
  compact,
  requireText,
  submitHrJson,
  type FieldErrors,
} from "@/components/hr/form-utils";

const WorkLocationMap = dynamic(
  () => import("@/components/hr/work-location-map"),
  {
    ssr: false,
    loading: () => (
      <div className="hr-location-map hr-location-map-loading">
        กำลังโหลดแผนที่…
      </div>
    ),
  },
);

export type WorkLocationFormValues = {
  name: string;
  branchId: string;
  latitude: string;
  longitude: string;
  geofenceRadiusMeters: string;
};

const DEFAULTS: WorkLocationFormValues = {
  name: "",
  branchId: "",
  latitude: "",
  longitude: "",
  geofenceRadiusMeters: "50",
};

function parseCoord(
  raw: string,
  kind: "latitude" | "longitude",
): string {
  const trimmed = raw.trim();
  if (!trimmed) return "ต้องระบุพิกัด GPS";
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return kind === "latitude" ? "ละติจูดไม่ถูกต้อง" : "ลองจิจูดไม่ถูกต้อง";
  }
  if (kind === "latitude" && (n < -90 || n > 90)) {
    return "ละติจูดต้องอยู่ระหว่าง -90 ถึง 90";
  }
  if (kind === "longitude" && (n < -180 || n > 180)) {
    return "ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180";
  }
  return "";
}

export default function WorkLocationForm({
  mode = "create",
  locationId,
  initialValues,
  branches,
  disabled = false,
  embedded = false,
  onDone,
  onCancel,
}: {
  mode?: "create" | "edit";
  locationId?: string;
  initialValues?: Partial<WorkLocationFormValues>;
  branches: Array<{ id: string; label: string }>;
  disabled?: boolean;
  /** Hide outer card chrome when rendered inside an overlay. */
  embedded?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<WorkLocationFormValues>({
    ...DEFAULTS,
    branchId: branches[0]?.id ?? "",
    ...initialValues,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapFocusKey, setMapFocusKey] = useState(0);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  function captureCurrentGps() {
    setFeedback(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setFeedback({
        kind: "error",
        text: "เบราว์เซอร์นี้ไม่รองรับการอ่านตำแหน่ง GPS",
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValues((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(7),
          longitude: position.coords.longitude.toFixed(7),
        }));
        setMapFocusKey((key) => key + 1);
        setErrors((prev) => {
          const next = { ...prev };
          delete next.latitude;
          delete next.longitude;
          return next;
        });
        const accuracy =
          position.coords.accuracy != null
            ? ` (ความแม่นยำ ±${Math.round(position.coords.accuracy)} ม.)`
            : "";
        setFeedback({
          kind: "success",
          text: `อ่านตำแหน่งปัจจุบันแล้ว${accuracy} — ตรวจแล้วกดบันทึก`,
        });
        setLocating(false);
      },
      (error) => {
        const text =
          error.code === error.PERMISSION_DENIED
            ? "ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง — เปิดสิทธิ์ตำแหน่งในเบราว์เซอร์แล้วลองใหม่"
            : error.code === error.POSITION_UNAVAILABLE
              ? "อ่านตำแหน่งไม่ได้ — ลองเปิด GPS หรือย้ายไปที่โล่งกว่านี้"
              : "หมดเวลารอตำแหน่ง GPS — ลองใหม่อีกครั้ง";
        setFeedback({ kind: "error", text });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const radius = Number(values.geofenceRadiusMeters);
    const next = compact({
      name: requireText(values.name) ?? "",
      branchId:
        mode === "create" && !values.branchId ? "เลือกสาขา" : "",
      geofenceRadiusMeters:
        !Number.isFinite(radius) || radius < 1
          ? "รัศมีต้องเป็นจำนวนเมตรตั้งแต่ 1 ขึ้นไป"
          : "",
      latitude: parseCoord(values.latitude, "latitude"),
      longitude: parseCoord(values.longitude, "longitude"),
    });
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาตรวจสอบข้อมูลที่ยังไม่ถูกต้อง" });
      return;
    }

    const payload = {
      name: values.name.trim(),
      branchId: values.branchId || undefined,
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
      geofenceRadiusMeters: Math.round(radius),
      timezone: "Asia/Bangkok",
    };

    setSaving(true);
    const result =
      mode === "create"
        ? await submitHrJson(
            "/api/hr/work-locations",
            "POST",
            payload,
            "สร้างสถานที่ทำงานเรียบร้อยแล้ว",
          )
        : await submitHrJson(
            `/api/hr/work-locations/${locationId}`,
            "PATCH",
            payload,
            "บันทึกสถานที่ทำงานเรียบร้อยแล้ว",
          );
    setSaving(false);

    if (!result.ok) {
      setFeedback({ kind: "error", text: result.message });
      return;
    }

    setFeedback({ kind: "success", text: result.message });
    if (onDone) {
      onDone();
      return;
    }
    if (mode === "create") {
      setValues({
        ...DEFAULTS,
        branchId: branches[0]?.id ?? "",
      });
    }
    router.refresh();
  }

  const busy = saving || locating || disabled;

  const mapLatitude = useMemo(() => {
    const n = Number(values.latitude);
    return values.latitude.trim() && Number.isFinite(n) ? n : null;
  }, [values.latitude]);
  const mapLongitude = useMemo(() => {
    const n = Number(values.longitude);
    return values.longitude.trim() && Number.isFinite(n) ? n : null;
  }, [values.longitude]);
  const mapRadius = useMemo(() => {
    const n = Number(values.geofenceRadiusMeters);
    return Number.isFinite(n) && n >= 1 ? n : 50;
  }, [values.geofenceRadiusMeters]);

  function applyMapPick(latitude: number, longitude: number) {
    setValues((prev) => ({
      ...prev,
      latitude: latitude.toFixed(7),
      longitude: longitude.toFixed(7),
    }));
    setMapFocusKey((key) => key + 1);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.latitude;
      delete next.longitude;
      return next;
    });
    setFeedback({
      kind: "success",
      text: "เลือกจุดบนแผนที่แล้ว — ปรับรัศมีได้แล้วกดบันทึก",
    });
  }

  return (
    <form
      className={embedded ? "hr-location-form-embedded" : "card"}
      onSubmit={handleSubmit}
      noValidate
    >
      {embedded ? null : (
        <h2>
          {mode === "create" ? "เพิ่มสถานที่ทำงาน" : "แก้ไขสถานที่ทำงาน"}
        </h2>
      )}
      <p className="muted" style={{ marginTop: 0 }}>
        ตั้งพิกัดและรัศมี GPS สำหรับลงเวลา — พนักงานต้องอยู่ในระยะนี้จึงลงเวลาได้
      </p>
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <div className="form-grid">
        <Field id="loc-name" label="ชื่อสถานที่" required error={errors.name}>
          <input
            {...fieldProps("loc-name", errors.name)}
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            placeholder="เช่น สำนักงานใหญ่"
            disabled={busy}
          />
        </Field>

        {mode === "create" ? (
          <Field id="loc-branch" label="สาขา" required error={errors.branchId}>
            {branches.length === 0 ? (
              <p className="field-error">ไม่พบสาขาในบริบทปัจจุบัน</p>
            ) : (
              <select
                {...fieldProps("loc-branch", errors.branchId)}
                value={values.branchId}
                onChange={(e) =>
                  setValues({ ...values, branchId: e.target.value })
                }
                disabled={busy}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ) : null}

        <div className="hr-gps-capture field-full">
          <button
            type="button"
            className="btn"
            onClick={captureCurrentGps}
            disabled={busy}
          >
            {locating ? "กำลังอ่านตำแหน่ง…" : "ใช้ตำแหน่งปัจจุบัน"}
          </button>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            อ่าน GPS จากอุปกรณ์ หรือคลิกเลือกจุดบนแผนที่ — แก้ค่ามือได้ก่อนบันทึก
          </p>
        </div>

        <div className="field-full">
          <WorkLocationMap
            latitude={mapLatitude}
            longitude={mapLongitude}
            radiusMeters={mapRadius}
            disabled={busy}
            focusKey={mapFocusKey}
            onPick={applyMapPick}
          />
        </div>

        <Field id="loc-lat" label="ละติจูด" required error={errors.latitude}>
          <input
            {...fieldProps("loc-lat", errors.latitude)}
            value={values.latitude}
            onChange={(e) => setValues({ ...values, latitude: e.target.value })}
            placeholder="13.7563"
            inputMode="decimal"
            disabled={busy}
          />
        </Field>

        <Field id="loc-lng" label="ลองจิจูด" required error={errors.longitude}>
          <input
            {...fieldProps("loc-lng", errors.longitude)}
            value={values.longitude}
            onChange={(e) =>
              setValues({ ...values, longitude: e.target.value })
            }
            placeholder="100.5018"
            inputMode="decimal"
            disabled={busy}
          />
        </Field>

        <Field
          id="loc-radius"
          label="รัศมี GPS (เมตร)"
          required
          hint="ระยะที่อนุญาตให้ลงเวลาได้จากจุดนี้ เช่น 50, 100, 200"
          error={errors.geofenceRadiusMeters}
        >
          <input
            {...fieldProps("loc-radius", errors.geofenceRadiusMeters)}
            type="number"
            min={1}
            step={1}
            value={values.geofenceRadiusMeters}
            onChange={(e) =>
              setValues({ ...values, geofenceRadiusMeters: e.target.value })
            }
            disabled={busy}
          />
        </Field>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || (mode === "create" && branches.length === 0)}
        >
          {saving
            ? "กำลังบันทึก…"
            : mode === "create"
              ? "เพิ่มสถานที่"
              : "บันทึก"}
        </button>
        {onCancel || mode === "edit" ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (onCancel) onCancel();
              else router.push("/hr/locations");
            }}
            disabled={saving || locating}
          >
            ยกเลิก
          </button>
        ) : null}
      </div>
    </form>
  );
}
