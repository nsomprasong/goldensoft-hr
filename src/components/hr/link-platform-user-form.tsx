"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import {
  compact,
  submitHrJson,
  validateUuid,
  type FieldErrors,
} from "@/components/hr/form-utils";

/** Links an HR employee row to a Platform user account (soft UUID reference). */
export default function LinkPlatformUserForm({
  employeeId,
  platformUserId,
  authUserId,
  disabled = false,
}: {
  employeeId: string;
  platformUserId: string | null;
  authUserId: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState(platformUserId ?? "");
  const [authId, setAuthId] = useState(authUserId ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  async function handleLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const nextErrors = compact({
      platformUserId: validateUuid(userId) ?? "",
      authUserId: validateUuid(authId, false) ?? "",
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาตรวจสอบข้อมูลที่ยังไม่ถูกต้อง" });
      return;
    }

    setBusy(true);
    const result = await submitHrJson(
      `/api/hr/employees/${employeeId}/link-platform-user`,
      "POST",
      {
        platformUserId: userId.trim(),
        authUserId: authId.trim() || null,
      },
      "เชื่อมบัญชีผู้ใช้เรียบร้อยแล้ว",
    );
    setBusy(false);

    if (!result.ok) {
      setErrors(result.fieldErrors);
      setFeedback({ kind: "error", text: result.message });
      return;
    }
    setFeedback({ kind: "success", text: result.message });
    router.refresh();
  }

  async function handleUnlink() {
    setFeedback(null);
    setBusy(true);
    const result = await submitHrJson(
      `/api/hr/employees/${employeeId}/unlink-platform-user`,
      "POST",
      {},
      "ยกเลิกการเชื่อมบัญชีเรียบร้อยแล้ว",
    );
    setBusy(false);

    if (!result.ok) {
      setFeedback({ kind: "error", text: result.message });
      return;
    }
    setUserId("");
    setAuthId("");
    setFeedback({ kind: "success", text: result.message });
    router.refresh();
  }

  return (
    <form className="card" onSubmit={handleLink} noValidate>
      <h3>บัญชีผู้ใช้บนแพลตฟอร์ม</h3>
      <p className="muted">
        สถานะปัจจุบัน:{" "}
        {platformUserId ? <code>{platformUserId}</code> : "ยังไม่ได้เชื่อมบัญชี"}
      </p>
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <div className="form-grid">
        <Field
          id="platformUserId"
          label="รหัสผู้ใช้บนแพลตฟอร์ม (UUID)"
          required
          error={errors.platformUserId}
          hint="ผู้ใช้ต้องอยู่ในองค์กรเดียวกันเท่านั้น"
        >
          <input
            {...fieldProps("platformUserId", errors.platformUserId)}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        </Field>

        <Field
          id="authUserId"
          label="รหัสบัญชีเข้าสู่ระบบ (UUID)"
          error={errors.authUserId}
          hint="เว้นว่างได้หากพนักงานยังเข้าสู่ระบบไม่ได้"
        >
          <input
            {...fieldProps("authUserId", errors.authUserId)}
            value={authId}
            onChange={(e) => setAuthId(e.target.value)}
          />
        </Field>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy || disabled}>
          {busy ? "กำลังดำเนินการ…" : "เชื่อมบัญชี"}
        </button>
        {platformUserId ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleUnlink}
            disabled={busy || disabled}
          >
            ยกเลิกการเชื่อม
          </button>
        ) : null}
      </div>
    </form>
  );
}
