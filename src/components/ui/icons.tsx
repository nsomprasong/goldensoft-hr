import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg(props: IconProps & { children: ReactNode }) {
  const { size = 18, children, className, ...rest } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconDashboard(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </Svg>
  );
}

export function IconHr(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16 19v-1.2A3.8 3.8 0 0 0 12.2 14H7.8A3.8 3.8 0 0 0 4 17.8V19" />
      <circle cx="10" cy="8" r="3" />
      <path d="M19 8v6M16 11h6" />
    </Svg>
  );
}

export function IconDepartment(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 6h11M8 12h11M8 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </Svg>
  );
}

export function IconRoles(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 4.5 6.5v4.7c0 4.4 3.1 7.6 7.5 8.8 4.4-1.2 7.5-4.4 7.5-8.8V6.5L12 3Z" />
      <path d="m9.5 12 1.7 1.7 3.5-3.6" />
    </Svg>
  );
}

export function IconShifts(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function IconPayroll(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </Svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.7 1.7 0 0 0 3.4 0" />
    </Svg>
  );
}

export type HrNavIconKey =
  | "dashboard"
  | "hr"
  | "department"
  | "roles"
  | "shifts"
  | "payroll";

const COMPONENT: Record<HrNavIconKey, (p: IconProps) => ReactNode> = {
  dashboard: IconDashboard,
  hr: IconHr,
  department: IconDepartment,
  roles: IconRoles,
  shifts: IconShifts,
  payroll: IconPayroll,
};

export function hrNavIconForPath(path: string): HrNavIconKey {
  if (path === "/hr") return "dashboard";
  if (path.startsWith("/hr/employees")) return "hr";
  if (path.startsWith("/hr/settings/departments")) return "department";
  if (path.startsWith("/hr/settings/positions")) return "roles";
  if (path.startsWith("/hr/settings/shifts")) return "shifts";
  if (path.startsWith("/hr/settings/overtime")) return "shifts";
  if (path.startsWith("/hr/settings/payroll")) return "payroll";
  if (path.startsWith("/hr/payroll")) return "payroll";
  return "hr";
}

export function HrNavIcon(props: {
  name: HrNavIconKey;
  size?: number;
  className?: string;
}) {
  const Comp = COMPONENT[props.name];
  return <>{Comp({ size: props.size, className: props.className })}</>;
}
