"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import { extractFaceDescriptor } from "@/lib/hr/client/face-descriptor";
import { compressImageForUpload } from "@/lib/hr/compress-image-client";
import { formatThaiDate } from "@/lib/hr/thai-date";
import type { SelfFaceMatchStatus } from "@/lib/hr/services/face-matching";

export default function MeFaceEnrollWorkspace({
  initial,
}: {
  initial: SelfFaceMatchStatus;
}) {
  const cameraId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(initial);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/hr/me/face", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return;
      const body = (await response.json()) as SelfFaceMatchStatus;
      setStatus(body);
    } catch {
      // keep prior
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function applyPhoto(file: File | null) {
    if (!file) return;
    try {
      const compressed = await compressImageForUpload(file);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(compressed.previewUrl);
      setPhotoBase64(compressed.dataUrl);
      setFeedback(null);
    } catch {
      setFeedback({ kind: "error", message: "อ่านรูปไม่สำเร็จ" });
    }
  }

  async function handleEnroll() {
    if (!photoBase64) {
      setFeedback({ kind: "error", message: "ต้องถ่ายรูปใบหน้าก่อน" });
      return;
    }

    setSubmitting(true);
    setFeedback({ kind: "info", message: "กำลังตรวจใบหน้า…" });
    try {
      const extracted = await extractFaceDescriptor(photoBase64);
      if (!extracted.ok) {
        setFeedback({ kind: "error", message: extracted.message });
        return;
      }

      setFeedback({ kind: "info", message: "กำลังบันทึก…" });
      const response = await fetch("/api/hr/me/face", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          photoBase64,
          faceDescriptor: extracted.descriptor,
        }),
      });
      if (!response.ok) {
        let detail = "ลงทะเบียนใบหน้าไม่สำเร็จ";
        try {
          const body = (await response.json()) as {
            error?: { message?: string };
            message?: string;
          };
          detail = body.error?.message?.trim() || body.message?.trim() || detail;
        } catch {
          // keep fallback
        }
        setFeedback({ kind: "error", message: detail });
        return;
      }

      setFeedback({
        kind: "success",
        message: "ลงทะเบียนใบหน้าเรียบร้อยแล้ว",
      });
      setPhotoBase64(null);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClear() {
    if (!status.enrolled) return;
    if (!window.confirm("ลบใบหน้าที่ลงทะเบียนไว้?")) return;

    setSubmitting(true);
    setFeedback({ kind: "info", message: "กำลังลบ…" });
    try {
      const response = await fetch("/api/hr/me/face", { method: "DELETE" });
      if (!response.ok) {
        setFeedback({ kind: "error", message: "ลบไม่สำเร็จ" });
        return;
      }
      setFeedback({ kind: "success", message: "ลบใบหน้าแล้ว" });
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const modeLabel =
    status.mode === "REQUIRE"
      ? "บังคับ"
      : status.mode === "WARN"
        ? "เตือน"
        : "ปิด";

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      <div className="card" style={{ marginBottom: "1rem" }}>
        <p>
          โหมดองค์กร: <strong>{modeLabel}</strong>
          {status.mode === "OFF"
            ? " — องค์กรยังไม่เปิดตรวจใบหน้าตอนลงเวลา"
            : status.mode === "REQUIRE"
              ? " — ต้องลงทะเบียนและจับคู่ผ่านก่อนลงเวลา"
              : " — ลงเวลาได้แม้ใบหน้าไม่ตรง แต่จะมีคำเตือน"}
        </p>
        {status.enrolled ? (
          <p className="field-hint">
            ลงทะเบียนแล้ว
            {status.enrolledAt
              ? ` (${formatThaiDate(status.enrolledAt)})`
              : ""}
          </p>
        ) : (
          <p className="field-hint">ยังไม่ได้ลงทะเบียนใบหน้า</p>
        )}
        <p style={{ marginTop: "0.75rem" }}>
          <Link href="/hr/me/attendance">← กลับไปลงเวลา</Link>
        </p>
      </div>

      {status.enrolled && status.photoUrl ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2>ใบหน้าที่ลงทะเบียน</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${status.photoUrl}?t=${status.enrolledAt ?? ""}`}
            alt="ใบหน้าที่ลงทะเบียน"
            style={{
              width: "100%",
              maxWidth: 240,
              borderRadius: "var(--radius-md, 8px)",
              marginTop: "0.75rem",
            }}
          />
          <div className="inline-actions" style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn"
              disabled={submitting}
              onClick={() => void handleClear()}
            >
              ลบแล้วลงทะเบียนใหม่
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2>{status.enrolled ? "อัปเดตใบหน้า" : "ลงทะเบียนใบหน้า"}</h2>
        <p className="field-hint">
          ถ่ายรูปใบหน้าตรงๆ ในที่สว่าง — ไม่ใส่หมวก/แว่นดำถ้าเป็นไปได้
        </p>

        <div className="hr-me-clock-photo" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className={
              photoPreview ? "hr-me-clock-photo-frame" : "hr-me-clock-photo-empty"
            }
            disabled={submitting}
            onClick={() => cameraRef.current?.click()}
            aria-label="แตะเพื่อถ่ายรูปใบหน้า"
          >
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="ตัวอย่างใบหน้า" />
            ) : null}
            <span className="hr-me-clock-photo-hint">แตะเพื่อถ่ายรูป</span>
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

        <div className="inline-actions" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={submitting || !photoBase64}
            onClick={() => void handleEnroll()}
          >
            {submitting ? "กำลังบันทึก…" : "บันทึกใบหน้า"}
          </button>
        </div>
      </div>
    </>
  );
}
