"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { submitHrJson } from "@/components/hr/form-utils";

export default function DeleteCalendarButton({
  calendarId,
  name,
  disabled = false,
}: {
  calendarId: string;
  name: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (
      !window.confirm(
        `ลบปฏิทิน “${name}” หรือไม่?\nวันหยุดในปฏิทินนี้จะถูกลบด้วย`,
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    const result = await submitHrJson(
      `/api/hr/calendars/${calendarId}`,
      "DELETE",
      undefined,
      "ลบปฏิทินเรียบร้อยแล้ว",
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push("/hr/calendars");
    router.refresh();
  }

  return (
    <span className="inline-actions">
      <button
        type="button"
        className="btn btn-sm btn-danger"
        onClick={run}
        disabled={busy || disabled}
      >
        {busy ? "กำลังลบ…" : "ลบปฏิทิน"}
      </button>
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
