import Link from "next/link";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
export const dynamic = "force-dynamic";
export default async function HrSettingsPage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.settingsManage });
  const links = [["/hr/settings/departments","แผนก"],["/hr/settings/positions","ตำแหน่ง"],["/hr/settings/shifts","กะงาน"],["/hr/settings/overtime-rules","กฎ OT"],["/hr/settings/payroll-schedules","รอบจ่าย"],["/hr/locations","สถานที่ทำงาน"],["/hr/calendars","ปฏิทินทำงาน"]];
  return <HrShell ctx={ctx}><div className="hr-page-head"><div><h1>ตั้งค่า HR</h1><p>จัดการข้อมูลแม่แบบที่ใช้ในงาน HR</p></div></div><div className="two-col">{links.map(([href,label]) => <Link key={href} className="card" href={href}><h2>{label}</h2><p>เปิดหน้าตั้งค่า</p></Link>)}</div></HrShell>;
}
