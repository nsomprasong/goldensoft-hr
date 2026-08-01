"use client";

import { useEffect, useId, useRef, useState } from "react";

import EmployeeAvatar from "@/components/hr/employee-avatar";

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

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function applyFile(file: File | null) {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    if (!file) {
      setPreview(null);
      setFileName(null);
      onFileChange?.(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      window.alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      window.alert("ไฟล์รูปต้องไม่เกิน 2.5 MB");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    setFileName(file.name || "photo.jpg");
    onFileChange?.(file);
  }

  const shown = preview || savedPhotoUrl || null;

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
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
          >
            ถ่ายรูป
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            โหลดรูป
          </button>
          {(preview || savedPhotoUrl) && (
            <button
              type="button"
              className="btn btn-sm btn-danger"
              disabled={disabled}
              onClick={() => {
                if (fileRef.current) fileRef.current.value = "";
                if (cameraRef.current) cameraRef.current.value = "";
                applyFile(null);
              }}
            >
              ลบรูป
            </button>
          )}
        </div>
        {fileName ? (
          <span className="field-hint">เลือกแล้ว: {fileName}</span>
        ) : null}
      </div>

      <input
        id={cameraId}
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        hidden
        disabled={disabled}
        onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
      />
      <input
        id={inputId}
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        disabled={disabled}
        onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

export async function uploadEmployeePhoto(
  employeeId: string,
  file: File,
): Promise<{ ok: boolean; message: string; photoUrl?: string }> {
  const body = new FormData();
  body.append("photo", file, file.name || "photo.jpg");
  try {
    const response = await fetch(`/api/hr/employees/${employeeId}/photo`, {
      method: "POST",
      body,
      credentials: "same-origin",
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
  } catch {
    return { ok: false, message: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" };
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
