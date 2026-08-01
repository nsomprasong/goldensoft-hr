"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  formatThaiDate,
  toIsoDate,
} from "@/lib/hr/thai-date";

/**
 * Date field that shows/accepts Thai พ.ศ. (`DD/MM/BBBB`) while emitting ISO
 * (`YYYY-MM-DD`) to the parent — same contract as `<input type="date">`.
 */
export default function ThaiDateInput({
  id,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  required = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string;
  name?: string;
  /** ISO `YYYY-MM-DD` (or empty). */
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
}) {
  const autoId = useId();
  const textId = id ?? autoId;
  const pickerId = `${textId}-picker`;
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() =>
    value ? formatThaiDate(value, "") : "",
  );

  useEffect(() => {
    setText(value ? formatThaiDate(value, "") : "");
  }, [value]);

  function commitText(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setText("");
      onChange("");
      return;
    }
    const iso = toIsoDate(trimmed);
    if (!iso) {
      // Keep what the user typed so they can fix it; parent keeps last valid ISO.
      setText(raw);
      return;
    }
    setText(formatThaiDate(iso, ""));
    onChange(iso);
  }

  function openPicker() {
    const el = pickerRef.current;
    if (!el || disabled) return;
    try {
      if (typeof el.showPicker === "function") {
        el.showPicker();
        return;
      }
    } catch {
      // showPicker can throw if not triggered by a user gesture in some browsers.
    }
    el.click();
  }

  return (
    <div className="thai-date-input">
      <input
        id={textId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="วว/ดด/ปปปป"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commitText(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitText(text);
          }
        }}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />
      {!readOnly ? (
        <>
          <button
            type="button"
            className="thai-date-picker-btn"
            onClick={openPicker}
            disabled={disabled}
            aria-label="เลือกวันที่จากปฏิทิน"
            title="เลือกวันที่จากปฏิทิน"
          >
            <svg
              className="thai-date-picker-icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="currentColor"
                d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm12 8H5v10h14V10ZM6 8h12V6H6v2Z"
              />
            </svg>
          </button>
          <input
            ref={pickerRef}
            id={pickerId}
            className="thai-date-picker-native"
            type="date"
            value={value}
            tabIndex={-1}
            aria-hidden="true"
            disabled={disabled}
            onChange={(e) => {
              const iso = e.target.value;
              setText(iso ? formatThaiDate(iso, "") : "");
              onChange(iso);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
