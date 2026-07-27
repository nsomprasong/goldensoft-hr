"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { submitHrJson } from "@/components/hr/form-utils";

export default function PublishScheduleButton({
  scheduleId,
  statusCode,
  disabled = false,
}: {
  scheduleId: string;
  statusCode?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (statusCode === "PUBLISHED" || statusCode === "LOCKED") {
    return null;
  }

  async function run() {
    if (!window.confirm("เปิดใช้ตารางนี้ให้พนักงานเห็นหรือไม่?")) return;
    setError(null);
    setBusy(true);
    const result = await submitHrJson(
      `/api/hr/schedules/${scheduleId}`,
      "POST",
      { action: "publish", confirm: true },
      "เปิดใช้ตารางเรียบร้อยแล้ว",
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-actions">
      <button
        type="button"
        className="btn btn-sm btn-primary"
        onClick={run}
        disabled={busy || disabled}
      >
        {busy ? "กำลังเปิดใช้…" : "เปิดใช้"}
      </button>
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
