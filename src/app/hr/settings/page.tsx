import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

import HrPageBackButton from "@/components/hr/hr-page-back-button";
import HrShell from "@/components/hr-shell";
import {
  IconCalendar,
  IconDepartment,
  IconFaceMatch,
  IconLateAbsent,
  IconLeave,
  IconMapPin,
  IconOvertime,
  IconPaySchedule,
  IconShifts,
  IconTaxInsurance,
} from "@/components/ui/icons";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

type IconComp = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const SETTINGS_LINKS: Array<{
  href: string;
  label: string;
  Icon: IconComp;
  tone: "overview" | "organization" | "services" | "violet" | "system";
}> = [
  {
    href: "/hr/settings/departments",
    label: "แผนก/ตำแหน่ง",
    Icon: IconDepartment,
    tone: "organization",
  },
  {
    href: "/hr/settings/shifts",
    label: "กะงาน",
    Icon: IconShifts,
    tone: "services",
  },
  {
    href: "/hr/settings/overtime-rules",
    label: "กฎ OT",
    Icon: IconOvertime,
    tone: "services",
  },
  {
    href: "/hr/settings/payroll-schedules",
    label: "รอบจ่าย",
    Icon: IconPaySchedule,
    tone: "overview",
  },
  {
    href: "/hr/settings/payroll-deductions",
    label: "ภาษี/ประกันสังคม",
    Icon: IconTaxInsurance,
    tone: "overview",
  },
  {
    href: "/hr/settings/attendance-pay",
    label: "หักสาย/ขาด",
    Icon: IconLateAbsent,
    tone: "system",
  },
  {
    href: "/hr/settings/face-matching",
    label: "ตรวจใบหน้า",
    Icon: IconFaceMatch,
    tone: "violet",
  },
  {
    href: "/hr/settings/leave-entitlements",
    label: "สิทธิ์วันลา",
    Icon: IconLeave,
    tone: "violet",
  },
  {
    href: "/hr/locations",
    label: "ตั้งพิกัดสาขา",
    Icon: IconMapPin,
    tone: "organization",
  },
  {
    href: "/hr/calendars",
    label: "ปฏิทินทำงาน",
    Icon: IconCalendar,
    tone: "services",
  },
];

export default async function HrSettingsPage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.settingsManage });

  return (
    <HrShell ctx={ctx} active="settings">
      <div className="hr-page-head">
        <div>
          <h1>ตั้งค่า HR</h1>
          <p>จัดการข้อมูลแม่แบบขององค์กร</p>
        </div>
        <HrPageBackButton href="/hr" />
      </div>

      <nav className="hr-settings-tile-grid" aria-label="เมนูตั้งค่า HR">
        {SETTINGS_LINKS.map(({ href, label, Icon, tone }) => (
          <Link
            key={href}
            href={href}
            className={`hr-settings-tile hr-settings-tile--${tone}`}
          >
            <span className="hr-settings-tile-icon" aria-hidden="true">
              <Icon size={22} />
            </span>
            <span className="hr-settings-tile-label">{label}</span>
          </Link>
        ))}
      </nav>
    </HrShell>
  );
}
