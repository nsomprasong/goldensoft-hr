import Link from "next/link";

import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";

export const dynamic = "force-dynamic";

export default async function MyHrPage() {
  const ctx = await requireHrPage();
  const links = [
    ["/hr/me/attendance", "ลงเวลา", "เข้างาน ออกงาน และประวัติวันนี้"],
    ["/hr/me/schedule", "ตารางงาน", "ดูกะและวันทำงานของฉัน"],
    ["/hr/me/leave", "การลา", "ยื่นคำขอและติดตามสถานะ"],
    ["/hr/me/overtime", "ทำงานล่วงเวลา", "ยื่นคำขอ OT"],
    ["/hr/me/payslips", "สลิปเงินเดือน", "เปิดและพิมพ์สลิปของฉัน"],
  ];
  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head"><div><h1>บริการของฉัน</h1><p>ข้อมูลส่วนบุคคลและคำขอสำหรับพนักงาน</p></div></div>
      <div className="two-col">
        {links.map(([href, title, detail]) => (
          <Link key={href} className="card" href={href}><h2>{title}</h2><p>{detail}</p></Link>
        ))}
      </div>
    </HrShell>
  );
}
