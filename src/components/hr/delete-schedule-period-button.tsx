"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import { submitHrJson } from "@/components/hr/form-utils";
import { signalNavigationPending } from "@/lib/navigation-pending";

export default function DeleteSchedulePeriodButton({
  scheduleId,
  name,
  statusCode,
  hasAttendance = false,
  attendanceDayCount = 0,
  disabled = false,
  redirectTo = "/hr/schedules",
}: {
  scheduleId: string;
  name: string;
  statusCode?: string;
  /** When true, delete is blocked (published or not). */
  hasAttendance?: boolean;
  attendanceDayCount?: number;
  disabled?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const locked = statusCode === "LOCKED";
  const blockedByAttendance = hasAttendance;

  function askDelete() {
    if (locked || blockedByAttendance) return;
    setAwaitingConfirm(true);
    setFeedback({
      kind: "warning",
      title: "ยืนยันการลบ",
      message:
        statusCode === "PUBLISHED"
          ? `ยืนยันลบช่วงตาราง “${name}” หรือไม่? ตารางนี้เผยแพร่แล้ว แต่ยังไม่มีลงเวลา — รายการกะจะถูกลบด้วย`
          : `ยืนยันลบช่วงตาราง “${name}” หรือไม่? รายการกะในตารางนี้จะถูกลบด้วย`,
      confirmLabel: "ลบ",
    });
  }

  async function confirmDelete() {
    setAwaitingConfirm(false);
    setFeedback({ kind: "info", message: "กำลังลบ…" });
    setBusy(true);
    const result = await submitHrJson(
      `/api/hr/schedules/${scheduleId}`,
      "DELETE",
      undefined,
      "ลบช่วงตารางเรียบร้อยแล้ว",
    );
    setBusy(false);

    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }
    setFeedback({ kind: "success", message: result.message });
    signalNavigationPending("กำลังกลับหน้ารายการตาราง");
    router.push(redirectTo);
    router.refresh();
  }

  if (locked) {
    return <span className="muted">ล็อกแล้ว ลบไม่ได้</span>;
  }

  if (blockedByAttendance) {
    return (
      <span
        className="muted"
        title={
          attendanceDayCount > 0
            ? `มีลงเวลาแล้ว ${attendanceDayCount} วัน`
            : "มีพนักงานลงเวลาแล้ว"
        }
      >
        มีลงเวลาแล้ว ลบไม่ได้
      </span>
    );
  }

  return (
    <span className="inline-actions">
      <FeedbackPopup
        feedback={feedback}
        onClose={() => {
          setFeedback(null);
          setAwaitingConfirm(false);
        }}
        onConfirm={awaitingConfirm ? confirmDelete : undefined}
      />
      <button
        type="button"
        className="btn btn-sm btn-danger"
        onClick={askDelete}
        disabled={busy || disabled}
      >
        {busy ? "กำลังลบ…" : "ลบ"}
      </button>
    </span>
  );
}
