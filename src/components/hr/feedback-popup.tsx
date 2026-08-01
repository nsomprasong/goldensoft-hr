"use client";

import { useEffect, useId } from "react";

export type FeedbackKind = "success" | "error" | "warning" | "info";

export type FeedbackPopupState = {
  kind: FeedbackKind;
  message: string;
  title?: string;
  /** When set with onConfirm, show confirm + cancel (replaces window.confirm). */
  confirmLabel?: string;
} | null;

const TITLES: Record<FeedbackKind, string> = {
  success: "ดำเนินการสำเร็จ",
  error: "ไม่สามารถดำเนินการได้",
  warning: "โปรดตรวจสอบ",
  info: "กำลังดำเนินการ",
};

function FeedbackIcon({ kind }: { kind: FeedbackKind }) {
  if (kind === "success") {
    return (
      <span
        className="hr-feedback-popup-icon hr-feedback-popup-icon--success"
        aria-hidden="true"
      >
        <svg className="hr-feedback-check" viewBox="0 0 52 52" fill="none">
          <circle
            className="hr-feedback-check-circle"
            cx="26"
            cy="26"
            r="24"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="hr-feedback-check-mark"
            d="M14.5 27.2 22.2 34.5 37.5 18.5"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (kind === "error") {
    return (
      <span
        className="hr-feedback-popup-icon hr-feedback-popup-icon--error"
        aria-hidden="true"
      >
        <svg className="hr-feedback-glyph" viewBox="0 0 52 52" fill="none">
          <circle
            className="hr-feedback-check-circle"
            cx="26"
            cy="26"
            r="24"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="hr-feedback-glyph-lines"
            d="M18 18 34 34 M34 18 18 34"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  if (kind === "warning") {
    return (
      <span
        className="hr-feedback-popup-icon hr-feedback-popup-icon--warning"
        aria-hidden="true"
      >
        <svg className="hr-feedback-glyph" viewBox="0 0 52 52" fill="none">
          <circle
            className="hr-feedback-check-circle"
            cx="26"
            cy="26"
            r="24"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="hr-feedback-glyph-lines"
            d="M26 16v14"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="26" cy="36" r="2.2" fill="currentColor" />
        </svg>
      </span>
    );
  }

  return (
    <span
      className="hr-feedback-popup-icon hr-feedback-popup-icon--info"
      aria-hidden="true"
    >
      <svg className="hr-feedback-glyph" viewBox="0 0 52 52" fill="none">
        <circle
          className="hr-feedback-check-circle"
          cx="26"
          cy="26"
          r="24"
          stroke="currentColor"
          strokeWidth="3"
        />
        <circle cx="26" cy="17.5" r="2.2" fill="currentColor" />
        <path
          className="hr-feedback-glyph-lines"
          d="M26 24v12"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/**
 * Centered in-app feedback popup — never use window.alert / system toasts.
 * Success/info auto-dismiss; error/warning dismiss via ยกเลิก or backdrop.
 */
export default function FeedbackPopup({
  feedback,
  onClose,
  onConfirm,
  autoCloseMs = 2600,
}: {
  feedback: FeedbackPopupState;
  onClose: () => void;
  /** Paired with feedback.confirmLabel for confirm dialogs. */
  onConfirm?: () => void;
  /** Auto-dismiss for success/info; error/warning/confirm stay until dismissed. */
  autoCloseMs?: number;
}) {
  const titleId = useId();
  const isConfirm = Boolean(feedback?.confirmLabel && onConfirm);
  const needsAction =
    isConfirm ||
    feedback?.kind === "error" ||
    feedback?.kind === "warning";

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
    if (needsAction) return;
    const timer = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(timer);
  }, [feedback, onClose, autoCloseMs, needsAction]);

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
        className={`hr-feedback-popup-card hr-feedback-popup-card--${feedback.kind}${needsAction ? "" : " hr-feedback-popup-card--auto"}`}
        role={feedback.kind === "error" ? "alert" : "status"}
        aria-live={feedback.kind === "error" ? "assertive" : "polite"}
        aria-labelledby={titleId}
      >
        <FeedbackIcon kind={feedback.kind} />
        <div className="hr-feedback-popup-copy">
          <h3 id={titleId}>{feedback.title ?? TITLES[feedback.kind]}</h3>
          <p>{feedback.message}</p>
        </div>
        {needsAction ? (
          <div
            className={`hr-feedback-popup-actions${isConfirm ? " hr-feedback-popup-actions--pair" : ""}`}
          >
            {isConfirm ? (
              <>
                <button
                  type="button"
                  className="btn hr-feedback-popup-dismiss"
                  onClick={onClose}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onConfirm}
                >
                  {feedback.confirmLabel}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn hr-feedback-popup-dismiss"
                onClick={onClose}
              >
                ปิด
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
