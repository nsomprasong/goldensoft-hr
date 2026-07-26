import type { ReactNode } from "react";

export type AlertKind = "success" | "error" | "warning" | "info";

/** Inline Thai feedback used by both server pages and client forms. */
export default function Alert({
  kind = "info",
  children,
}: {
  kind?: AlertKind;
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <div
      className={`alert alert-${kind}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}

/** Shown whenever a read degraded because the hr schema is not migrated yet. */
export function DatabaseUnavailableNotice({
  message,
}: {
  message: string | null;
}) {
  if (!message) return null;
  return <Alert kind="warning">{message}</Alert>;
}
