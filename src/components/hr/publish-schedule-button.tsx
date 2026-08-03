"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import { submitHrJson } from "@/components/hr/form-utils";
import HrButton from "@/components/ui/hr-button";

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
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  if (statusCode === "PUBLISHED" || statusCode === "LOCKED") {
    return null;
  }

  function askPublish() {
    setAwaitingConfirm(true);
    setFeedback({
      kind: "warning",
      title: "ยืนยันการเปิดใช้",
      message: "เปิดใช้ตารางนี้ให้พนักงานเห็นหรือไม่?",
      confirmLabel: "เปิดใช้",
    });
  }

  async function confirmPublish() {
    setAwaitingConfirm(false);
    setFeedback({ kind: "info", message: "กำลังเปิดใช้ตาราง…" });
    setBusy(true);
    const result = await submitHrJson(
      `/api/hr/schedules/${scheduleId}`,
      "POST",
      { action: "publish", confirm: true },
      "เปิดใช้ตารางเรียบร้อยแล้ว",
    );
    setBusy(false);
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }
    setFeedback({ kind: "success", message: result.message });
    router.refresh();
  }

  return (
    <span className="inline-actions">
      <FeedbackPopup
        feedback={feedback}
        onClose={() => {
          setFeedback(null);
          setAwaitingConfirm(false);
        }}
        onConfirm={awaitingConfirm ? confirmPublish : undefined}
      />
      <HrButton
        type="button"
        className="btn btn-sm btn-primary"
        action="publish"
        onClick={askPublish}
        disabled={busy || disabled}
      >
        {busy ? "กำลังเปิดใช้…" : "เปิดใช้ตารางกะ"}
      </HrButton>
    </span>
  );
}
