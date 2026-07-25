import { requireHrPage } from "@/lib/hr/guards";
import { HR_ENTITLEMENTS } from "@/lib/hr/entitlements";

export const dynamic = "force-dynamic";

export default async function HrHomePage() {
  const ctx = await requireHrPage();
  const employeeLimit =
    ctx.entitlements[HR_ENTITLEMENTS.employeeLimit]?.value ?? "—";

  return (
    <main style={{ padding: "1.5rem", maxWidth: 720 }}>
      <h1>GoldenSoft HR</h1>
      <p>ยินดีต้อนรับ {ctx.profile?.displayName}</p>
      <p>
        องค์กร: {ctx.organizationName}
        {ctx.branch ? ` · สาขา ${ctx.branch.name}` : ""}
      </p>
      <p>โหมดบริบท: {ctx.contextMode}</p>
      <p>จำกัดจำนวนพนักงาน (hr.employee_limit): {employeeLimit}</p>
    </main>
  );
}
