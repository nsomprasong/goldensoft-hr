"use client";

import { useEffect, useId } from "react";

export type FeedbackKind = "success" | "error" | "warning" | "info";

export type FeedbackPopupState = {
  kind: FeedbackKind;
  message: string;
} | null;

const TITLES: Record<FeedbackKind, string> = {
  success: "สำเร็จ",
  error: "ไม่สำเร็จ",
  warning: "โปรดตรวจสอบ",
  info: "แจ้งเตือน",
};

/**
 * Centered in-app feedback popup — never use window.alert / system toasts.
 */
export default function FeedbackPopup({
  feedback,
  onClose,
  autoCloseMs = 2800,
}: {
  feedback: FeedbackPopupState;
  onClose: () => void;
  /** Auto-dismiss for success/info; error/warning stay until dismissed. */
  autoCloseMs?: number;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!feedback) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feedback, onClose]);

  useEffect(() => {
    if (!feedback) return;
    if (feedback.kind === "error" || feedback.kind === "warning") return;
    const timer = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(timer);
  }, [feedback, onClose, autoCloseMs]);

  if (!feedback) return null;

  return (
    <div
      className="hr-feedback-popup"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`hr-feedback-popup-card hr-feedback-popup-card--${feedback.kind}`}
        role={feedback.kind === "error" ? "alert" : "status"}
        aria-live={feedback.kind === "error" ? "assertive" : "polite"}
        aria-labelledby={titleId}
      >
        <div
          className={`hr-feedback-popup-icon hr-feedback-popup-icon--${feedback.kind}`}
          aria-hidden="true"
        >
          {feedback.kind === "success"
            ? "✓"
            : feedback.kind === "error"
              ? "!"
              : feedback.kind === "warning"
                ? "!"
                : "i"}
        </div>
        <div className="hr-feedback-popup-copy">
          <h3 id={titleId}>{TITLES[feedback.kind]}</h3>
          <p>{feedback.message}</p>
        </div>
        <button
          type="button"
          className="btn btn-sm hr-feedback-popup-close"
          onClick={onClose}
        >
          ปิด
        </button>
      </div>
    </div>
  );
}
