"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import {
  compact,
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
  geofenceRadiusMeters: "100",
};

function parseCoord(
  raw: string,
  kind: "latitude" | "longitude",
): string {
  const trimmed = raw.trim();
  if (!trimmed) return "ต้องระบุพิกัด";
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

function branchName(
  branches: Array<{ id: string; label: string }>,
  branchId: string,
): string {
  return branches.find((b) => b.id === branchId)?.label?.trim() ?? "";
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
  const initialBranchId =
    initialValues?.branchId ||
    (branches.length === 1 ? branches[0].id : "") ||
    "";
  const [values, setValues] = useState<WorkLocationFormValues>(() => ({
    ...DEFAULTS,
    ...initialValues,
    branchId: initialBranchId,
    name:
      branchName(branches, initialBranchId) ||
      initialValues?.name?.trim() ||
      "",
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapFocusKey, setMapFocusKey] = useState(0);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  /** Header already scoped to one branch — no picker needed. */
  const branchLocked = branches.length === 1;
  const resolvedBranchLabel =
    branchName(branches, values.branchId) || values.name.trim();

  function selectBranch(branchId: string) {
    setValues((prev) => ({
      ...prev,
      branchId,
      name: branchName(branches, branchId) || prev.name,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.branchId;
      delete next.name;
      return next;
    });
  }

  function captureCurrentGps() {
    setFeedback(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setFeedback({
        kind: "error",
        text: "เบราว์เซอร์นี้ไม่รองรับ GPS",
      });
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setFeedback({
        kind: "error",
        text: "ใช้ GPS ได้บน HTTPS เท่านั้น — หรือคลิกเลือกบนแผนที่",
      });
      return;
    }
    setLocating(true);
    const apply = (position: GeolocationPosition) => {
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
          ? ` (±${Math.round(position.coords.accuracy)} ม.)`
          : "";
      setFeedback({
        kind: "success",
        text: `อ่านตำแหน่งแล้ว${accuracy}`,
      });
      setLocating(false);
    };
    navigator.geolocation.getCurrentPosition(
      apply,
      () => {
        navigator.geolocation.getCurrentPosition(
          apply,
          (error) => {
            const text =
              error.code === error.PERMISSION_DENIED
                ? "ไม่ได้รับอนุญาตใช้ตำแหน่ง — เปิดสิทธิ์ในเบราว์เซอร์"
                : error.code === error.POSITION_UNAVAILABLE
                  ? "อ่านตำแหน่งไม่ได้ — ลองเปิด GPS หรือคลิกบนแผนที่"
                  : "หมดเวลารอ GPS — ลองใหม่หรือคลิกบนแผนที่";
            setFeedback({ kind: "error", text });
            setLocating(false);
          },
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const resolvedName =
      branchName(branches, values.branchId) || values.name.trim();
    const radius = Number(values.geofenceRadiusMeters);
    const next = compact({
      branchId: !values.branchId ? "เลือกสาขาที่จะปักหมุด" : "",
      name: !resolvedName ? "ไม่พบชื่อสาขา" : "",
      geofenceRadiusMeters:
        !Number.isFinite(radius) || radius < 1
          ? "รัศมีต้องเป็นจำนวนเมตรตั้งแต่ 1 ขึ้นไป"
          : "",
      latitude: parseCoord(values.latitude, "latitude"),
      longitude: parseCoord(values.longitude, "longitude"),
    });
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาตรวจสอบข้อมูล" });
      return;
    }

    const payload = {
      name: resolvedName,
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
            "บันทึกพิกัดสาขาแล้ว",
          )
        : await submitHrJson(
            `/api/hr/work-locations/${locationId}`,
            "PATCH",
            payload,
            "บันทึกพิกัดสาขาแล้ว",
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
      const nextBranchId = branches.length === 1 ? branches[0].id : "";
      setValues({
        ...DEFAULTS,
        branchId: nextBranchId,
        name: branchName(branches, nextBranchId),
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
    setFeedback({ kind: "success", text: "เลือกจุดบนแผนที่แล้ว" });
  }

  return (
    <form
      className={
        embedded ? "hr-settings-form hr-location-form-embedded" : "hr-settings-form"
      }
      onSubmit={handleSubmit}
      noValidate
    >
      {embedded ? null : (
        <h2>{mode === "create" ? "ตั้งพิกัดสาขา" : "แก้ไขพิกัดสาขา"}</h2>
      )}
      <p className="hr-settings-form-lead">
        ปักหมุดและรัศมีสำหรับลงเวลา
      </p>
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <section className="hr-settings-panel">
        <header className="hr-leave-panel-head">
          <h2>สาขา</h2>
          <p>ชื่อพิกัดใช้ตามสาขา</p>
        </header>
        <div className="hr-settings-inner-card">
          {branchLocked ? (
            <div className="field">
              <label>สาขา</label>
              <p className="hr-location-branch-locked">{resolvedBranchLabel}</p>
            </div>
          ) : (
            <Field
              id="loc-branch"
              label="สาขาที่จะปักหมุด"
              required
              error={errors.branchId || errors.name}
            >
              {branches.length === 0 ? (
                <p className="field-error">
                  ไม่พบสาขา — เลือกสาขาจากแถบบน หรือเพิ่มสาขาก่อน
                </p>
              ) : (
                <select
                  {...fieldProps("loc-branch", errors.branchId || errors.name)}
                  value={values.branchId}
                  onChange={(e) => selectBranch(e.target.value)}
                  disabled={busy || mode === "edit"}
                >
                  <option value="">เลือกสาขา</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
        </div>
      </section>

      <section className="hr-settings-panel">
        <header className="hr-leave-panel-head">
          <h2>แผนที่</h2>
          <p>คลิกแผนที่หรือใช้ตำแหน่งปัจจุบัน</p>
        </header>
        <div className="hr-settings-inner-card">
          <div className="hr-gps-capture">
            <button
              type="button"
              className="btn"
              onClick={captureCurrentGps}
              disabled={busy}
            >
              {locating ? "กำลังอ่านตำแหน่ง…" : "ใช้ตำแหน่งปัจจุบัน"}
            </button>
          </div>
          <WorkLocationMap
            latitude={mapLatitude}
            longitude={mapLongitude}
            radiusMeters={mapRadius}
            disabled={busy}
            focusKey={mapFocusKey}
            onPick={applyMapPick}
          />
        </div>
      </section>

      <section className="hr-settings-panel">
        <header className="hr-leave-panel-head">
          <h2>พิกัดและรัศมี</h2>
          <p>ปรับค่ามือได้ก่อนบันทึก</p>
        </header>
        <div className="hr-settings-inner-card">
          <div className="form-grid">
            <Field id="loc-lat" label="ละติจูด" required error={errors.latitude}>
              <input
                {...fieldProps("loc-lat", errors.latitude)}
                value={values.latitude}
                onChange={(e) =>
                  setValues({ ...values, latitude: e.target.value })
                }
                placeholder="13.7563"
                inputMode="decimal"
                disabled={busy}
              />
            </Field>

            <Field
              id="loc-lng"
              label="ลองจิจูด"
              required
              error={errors.longitude}
            >
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
              label="รัศมี (เมตร)"
              required
              hint="แนะนำ 50–100 ม."
              error={errors.geofenceRadiusMeters}
            >
              <input
                {...fieldProps("loc-radius", errors.geofenceRadiusMeters)}
                type="number"
                min={1}
                step={1}
                value={values.geofenceRadiusMeters}
                onChange={(e) =>
                  setValues({
                    ...values,
                    geofenceRadiusMeters: e.target.value,
                  })
                }
                disabled={busy}
              />
            </Field>
          </div>
        </div>
      </section>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || (mode === "create" && branches.length === 0)}
        >
          {saving ? "กำลังบันทึก…" : "บันทึกพิกัด"}
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
