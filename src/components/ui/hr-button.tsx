"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import {
  ACTION_ICON,
  inferActionFromLabel,
  type ActionKey,
} from "@/components/ui/action-icons";

function labelText(children: ReactNode): string | null {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    const parts = children
      .map((part) =>
        typeof part === "string" || typeof part === "number"
          ? String(part)
          : "",
      )
      .join("");
    return parts.trim() ? parts : null;
  }
  return null;
}

export type HrButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Explicit action icon; overrides label inference. */
  action?: ActionKey;
  /** Custom icon node; overrides action + inference. */
  icon?: ReactNode;
  /** When false, render children only (no icon slot). Default true. */
  showIcon?: boolean;
};

/**
 * HR action button styled like bottom submenu tabs:
 * circular icon on top, caption label below.
 */
export default function HrButton({
  action,
  icon,
  showIcon = true,
  children,
  className = "btn",
  type = "button",
  ...props
}: HrButtonProps) {
  const text = labelText(children);
  const key = action ?? (text ? inferActionFromLabel(text) : null);
  const IconComp = key ? ACTION_ICON[key] : null;
  const resolvedIcon =
    icon ?? (IconComp ? <IconComp size={16} /> : null);
  const classes = [className, resolvedIcon && showIcon ? "btn-tab" : null]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...props}>
      {showIcon && resolvedIcon ? (
        <span className="btn-icon" aria-hidden="true">
          {resolvedIcon}
        </span>
      ) : null}
      <span className="btn-label">{children}</span>
    </button>
  );
}
