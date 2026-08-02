import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Employee display name with optional small branch name underneath.
 * Pass showBranch only when the viewer can manage multiple branches.
 */
export default function EmployeeNameLabel({
  name,
  branchName,
  showBranch = false,
  href,
  as = "strong",
  className,
  children,
}: {
  name: string;
  branchName?: string | null;
  showBranch?: boolean;
  href?: string;
  as?: "strong" | "h1" | "h2" | "span";
  className?: string;
  /** Extra lines under the name (e.g. date / code) — after branch when shown. */
  children?: ReactNode;
}) {
  const Tag = as;
  const branch =
    showBranch && branchName?.trim() ? branchName.trim() : null;

  return (
    <span className="hr-employee-name-label">
      <Tag className={className || undefined}>
        {href ? (
          <Link className="hr-employee-name-link" href={href}>
            {name}
          </Link>
        ) : (
          name
        )}
      </Tag>
      {branch ? (
        <span className="hr-employee-name-branch">{branch}</span>
      ) : null}
      {children}
    </span>
  );
}
