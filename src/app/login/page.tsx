export default function LoginPage() {
  return (
    <main className="hr-main">
      <div className="hr-debug-banner" role="status">
        <strong>Debug Shell เท่านั้น</strong>
        {" — "}
        หน้า Login จริงอยู่ใน GoldenSoft Customer App (
        <code>goldensoft-app</code>) ไม่ใช่โมดูล HR
      </div>
      <div className="card">
        <h1>เข้าสู่ระบบ (Debug)</h1>
        <p>
          ใช้บัญชี GoldenSoft Platform (Supabase Auth) ร่วมกับแพลตฟอร์มกลาง —
          โมดูล HR อ่าน session / cookie <code>gs_platform_ctx</code>{" "}
          ตามสัญญา Platform เท่านั้น
        </p>
        <p>
          ใน production ลูกค้าเข้า Customer App จุดเดียว แล้วเปิดผลิตภัณฑ์ HR
          ภายใต้ prefix <code>/hr</code>
        </p>
      </div>
    </main>
  );
}
