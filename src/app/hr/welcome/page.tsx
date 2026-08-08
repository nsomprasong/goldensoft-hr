import Image from "next/image";
import Link from "next/link";

import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";

export const dynamic = "force-dynamic";

export default async function HrWelcomePage() {
  const ctx = await requireHrPage();
  const rawDisplayName = ctx.profile?.displayName?.trim() || "ผู้ใช้งาน";
  const displayName =
    rawDisplayName.replace(/^(?:คุณ|นาย|นางสาว|นาง)\s*/u, "") ||
    "ผู้ใช้งาน";

  return (
    <HrShell ctx={ctx}>
      <main className="hr-welcome">
        <div className="hr-welcome-glow" aria-hidden="true" />
        <section className="hr-welcome-card" aria-labelledby="hr-welcome-title">
          <div className="hr-welcome-logo-wrap" aria-hidden="true">
            <Image
              src="/goldensoft-logo.png"
              alt=""
              width={1024}
              height={1024}
              className="hr-welcome-logo"
              priority
            />
          </div>

          <div className="hr-welcome-copy">
            <p className="hr-welcome-kicker">GOLDENSOFT HR</p>
            <p className="hr-welcome-title">ยินดีต้อนรับ</p>
            <h1 id="hr-welcome-title">{displayName}</h1>
            <p>
              เริ่มต้นวันทำงานกับ GoldenSoft HR
              <span> จัดการงานบุคคล เวลา และการเงินขององค์กรในที่เดียว</span>
            </p>
            <p className="hr-welcome-context">
              {ctx.organizationName}
              {ctx.branch ? ` · สาขา ${ctx.branch.name}` : " · ทุกสาขาที่มีสิทธิ์"}
            </p>
            <Link className="btn btn-primary hr-welcome-action" href="/hr">
              เปิดแดชบอร์ด
            </Link>
          </div>
        </section>
      </main>
    </HrShell>
  );
}
