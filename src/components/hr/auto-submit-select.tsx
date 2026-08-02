"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";

/**
 * Select that submits its parent GET form as soon as the value changes.
 */
export default function AutoSubmitSelect({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      {...props}
      onChange={(event) => {
        props.onChange?.(event);
        if (!event.defaultPrevented) {
          event.currentTarget.form?.requestSubmit();
        }
      }}
    >
      {children}
    </select>
  );
}
