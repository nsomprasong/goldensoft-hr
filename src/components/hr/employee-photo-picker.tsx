"use client";

import { useEffect, useId, useRef, useState } from "react";

import EmployeeAvatar from "@/components/hr/employee-avatar";
import { compressImageForUpload } from "@/lib/hr/compress-image-client";

/** Profile avatars — keep under reverse-proxy / FormData limits. */
export const EMPLOYEE_PHOTO_MAX_BYTES = Math.floor(800 * 1024);
export const EMPLOYEE_PHOTO_MAX_EDGE = 1280;

export type EmployeePhotoPickerProps = {
  displayName: string;
  /** Existing saved photo URL (API path), if any. */
  savedPhotoUrl?: string | null;
  disabled?: boolean;
  /** Called when user picks/clears a local file before save. */
  onFileChange?: (file: File | null) => void;
};

/**
 * Capture (camera) or upload a photo — no URL typing.
 * Compresses on pick so Save does not hang on multi-MB camera files.
 * Parent uploads the File after the employee record exists.
 */
export default function EmployeePhotoPicker({
  displayName,
  savedPhotoUrl,
  disabled = false,
  onFileChange,
}: EmployeePhotoPickerProps) {
  const inputId = useId();
  const cameraId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function applyFile(file: File | null) {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPrepareError(null);
    if (!file) {
      setPreview(null);
      setFileName(null);
      setPreparing(false);
      onFileChange?.(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPrepareError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }

    setPreparing(true);
    try {
      const compressed = await compressImageForUpload(file, {
        maxBytes: EMPLOYEE_PHOTO_MAX_BYTES,
        maxEdge: EMPLOYEE_PHOTO_MAX_EDGE,
        force: true,
      });
      setPreview(compressed.previewUrl);
      setFileName(compressed.file.name || "photo.jpg");
      onFileChange?.(compressed.file);
    } catch (err) {
      setPreview(null);
      setFileName(null);
      onFileChange?.(null);
      setPrepareError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "ย่อขนาดรูปไม่สำเร็จ — ลองถ่ายใหม่",
      );
    } finally {
      setPreparing(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  const shown = preview || savedPhotoUrl || null;
  const busy = disabled || preparing;

  return (
    <div className="employee-photo-picker">
      <EmployeeAvatar
        displayName={displayName || "พนักงาน"}
        photoUrl={shown}
        size="lg"
      />
      <div className="employee-photo-picker-actions">
        <p className="muted" style={{ margin: 0 }}>
          ไอคอนประจำตัว — ถ่ายจากกล้องหรือโหลดจากเครื่อง (ไม่ใช้ URL)
        </p>
        <div className="inline-actions">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
          >
            {preparing ? "กำลังย่อรูป…" : "ถ่ายรูป"}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            โหลดรูป
          </button>
          {(preview || savedPhotoUrl) && (
            <button
              type="button"
              className="btn btn-sm btn-danger"
              disabled={busy}
              onClick={() => {
                void applyFile(null);
              }}
            >
              ลบรูป
            </button>
          )}
        </div>
        {fileName ? (
          <span className="field-hint">เลือกแล้ว: {fileName}</span>
        ) : null}
        {prepareError ? (
          <span className="field-error" role="alert">
            {prepareError}
          </span>
        ) : null}
      </div>

      <input
        id={cameraId}
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        hidden
        disabled={busy}
        onChange={(e) => void applyFile(e.target.files?.[0] ?? null)}
      />
      <input
        id={inputId}
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        disabled={busy}
        onChange={(e) => void applyFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

const UPLOAD_TIMEOUT_MS = 45_000;

export async function uploadEmployeePhoto(
  employeeId: string,
  file: File,
): Promise<{ ok: boolean; message: string; photoUrl?: string }> {
  let uploadFile = file;
  try {
    if (
      file.size > EMPLOYEE_PHOTO_MAX_BYTES ||
      file.type !== "image/jpeg"
    ) {
      const compressed = await compressImageForUpload(file, {
        maxBytes: EMPLOYEE_PHOTO_MAX_BYTES,
        maxEdge: EMPLOYEE_PHOTO_MAX_EDGE,
        force: true,
      });
      uploadFile = compressed.file;
      if (compressed.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(compressed.previewUrl);
      }
    }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "ย่อขนาดรูปไม่สำเร็จ",
    };
  }

  const body = new FormData();
  body.append("photo", uploadFile, uploadFile.name || "photo.jpg");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(`/api/hr/employees/${employeeId}/photo`, {
      method: "POST",
      body,
      credentials: "same-origin",
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as {
      photoUrl?: string;
      error?: { message?: string };
    } | null;
    if (!response.ok) {
      return {
        ok: false,
        message:
          payload?.error?.message ??
          "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่",
      };
    }
    return {
      ok: true,
      message: "บันทึกรูปพนักงานเรียบร้อยแล้ว",
      photoUrl: payload?.photoUrl,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        ok: false,
        message: "อัปโหลดรูปใช้เวลานานเกินไป — ลองถ่ายใหม่หรือลดขนาดรูป",
      };
    }
    return { ok: false, message: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" };
  } finally {
    clearTimeout(timer);
  }
}

export async function clearEmployeePhoto(
  employeeId: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(`/api/hr/employees/${employeeId}/photo`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      return {
        ok: false,
        message: payload?.error?.message ?? "ลบรูปไม่สำเร็จ",
      };
    }
    return { ok: true, message: "ลบรูปพนักงานเรียบร้อยแล้ว" };
  } catch {
    return { ok: false, message: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" };
  }
}
