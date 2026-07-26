export default function ForbiddenPage() {
  return (
    <main className="hr-main">
      <div className="card">
        <h1>ไม่มีสิทธิ์</h1>
        <p>คุณไม่มีสิทธิ์ดำเนินการในส่วนนี้ของ HR</p>
        <a className="btn" href="/hr">
          กลับหน้าแดชบอร์ด HR
        </a>
      </div>
    </main>
  );
}
