"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { submitHrJson } from "@/components/hr/form-utils";

export default function DeleteSchedulePeriodButton({
  scheduleId,
  name,
  statusCode,
  disabled = false,
  redirectTo = "/hr/schedules",
}: {
  scheduleId: string;
  name: string;
  statusCode?: string;
  disabled?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = statusCode === "LOCKED";

  async function run() {
    if (locked) return;
    if (
      !window.confirm(
        `ยืนยันลบช่วงตาราง “${name}” หรือไม่?\nรายการกะในตารางนี้จะถูกลบด้วย`,
      )
    ) {
      return;
    }

    setError(null);
    setBusy(true);
    const result = await submitHrJson(
      `/api/hr/schedules/${scheduleId}`,
      "DELETE",
      undefined,
      "ลบช่วงตารางเรียบร้อยแล้ว",
    );
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  if (locked) {
    return <span className="muted">ล็อกแล้ว ลบไม่ได้</span>;
  }

  return (
    <span className="inline-actions">
      <button
        type="button"
        className="btn btn-sm btn-danger"
        onClick={run}
        disabled={busy || disabled}
      >
        {busy ? "กำลังลบ…" : "ลบ"}
      </button>
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
