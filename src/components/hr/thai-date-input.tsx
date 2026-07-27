"use client";

import { useEffect, useId, useState } from "react";

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
        <input
          id={pickerId}
          className="thai-date-picker"
          type="date"
          value={value}
          tabIndex={-1}
          aria-label="เลือกวันที่จากปฏิทิน"
          disabled={disabled}
          onChange={(e) => {
            const iso = e.target.value;
            setText(iso ? formatThaiDate(iso, "") : "");
            onChange(iso);
          }}
        />
      ) : null}
    </div>
  );
}
