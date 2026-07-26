export default function SelectOrganizationPage() {
  return (
    <main className="hr-main">
      <div className="hr-debug-banner" role="status">
        <strong>Debug Shell เท่านั้น</strong>
        {" — "}
        Organization / Branch selector เป็นของ Customer App ไม่ใช่ HR
      </div>
      <div className="card">
        <h1>เลือกองค์กร (Debug)</h1>
        <p>
          กรุณาเลือกองค์กรบน GoldenSoft Platform / Customer App ก่อนเข้าใช้งาน
          HR — ใช้คุกกี้บริบทร่วม <code>gs_platform_ctx</code> ตามสัญญา Platform
          เท่านั้น (HR ไม่สร้างชุด cookie คนละชื่อ)
        </p>
      </div>
    </main>
  );
}
