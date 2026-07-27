import Link from "next/link";

const TABS = [
  { href: "/hr/settings/departments", label: "แผนก" },
  { href: "/hr/settings/positions", label: "ตำแหน่ง" },
] as const;

export default function DepartmentPositionTabs({
  active,
}: {
  active: "departments" | "positions";
}) {
  return (
    <nav className="hr-subtabs" aria-label="แผนกและตำแหน่ง">
      {TABS.map((tab) => {
        const isActive =
          (active === "departments" && tab.href.includes("departments")) ||
          (active === "positions" && tab.href.includes("positions"));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={isActive ? "hr-subtab active" : "hr-subtab"}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
