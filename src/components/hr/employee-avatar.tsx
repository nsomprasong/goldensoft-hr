/** Circular employee photo / initials icon used in every employee list. */

export function employeeInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

export default function EmployeeAvatar({
  displayName,
  photoUrl,
  size = "md",
  className = "",
}: {
  displayName: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const initials = employeeInitials(displayName);
  const classes = `employee-avatar employee-avatar-${size}${className ? ` ${className}` : ""}`;

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote/org photo URLs; not a fixed next/image domain set
      <img
        className={classes}
        src={photoUrl}
        alt=""
        title={displayName}
        loading="lazy"
      />
    );
  }

  return (
    <span className={`${classes} employee-avatar-fallback`} title={displayName} aria-hidden>
      {initials}
    </span>
  );
}
