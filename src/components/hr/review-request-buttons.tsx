"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import HrButton from "@/components/ui/hr-button";

export default function ReviewRequestButtons({
  kind,
  id,
}: {
  kind: "leave" | "overtime";
  id: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    const endpoint =
      kind === "leave" ? "/api/hr/leave/requests" : "/api/hr/overtime/requests";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action, id }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(payload?.error?.message ?? "ดำเนินการไม่สำเร็จ");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
      setBusy(null);
    }
  }

  return (
    <div className="inline-actions">
      <HrButton
        className="btn btn-sm btn-primary"
        action="approve"
        disabled={busy !== null}
        onClick={() => review("approve")}
      >
        {busy === "approve" ? "กำลังอนุมัติ…" : "อนุมัติ"}
      </HrButton>
      <HrButton
        className="btn btn-sm btn-danger"
        action="reject"
        disabled={busy !== null}
        onClick={() => review("reject")}
      >
        {busy === "reject" ? "กำลังปฏิเสธ…" : "ไม่อนุมัติ"}
      </HrButton>
      {error ? (
        <span
          className="field-hint"
          style={{ color: "var(--hr-danger, #b91c1c)" }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
