"use client";

import type { ReactNode } from "react";

/** Label + control + inline Thai validation message. */
export default function Field({
  id,
  label,
  error,
  hint,
  required,
  full,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={full ? "field field-full" : "field"}>
      <label htmlFor={id}>
        {label}
        {required ? <span className="required"> *</span> : null}
      </label>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? (
        <span className="field-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function fieldProps(id: string, error?: string | null) {
  return {
    id,
    name: id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const;
}
