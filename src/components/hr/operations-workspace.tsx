"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import Alert from "@/components/hr/alert";

export type OperationAction = {
  label: string;
  action: string;
  confirm?: boolean;
};

export type OperationWorkspaceProps = {
  title: string;
  description: string;
  emptyMessage: string;
  endpoint: string;
  actions?: OperationAction[];
  children?: ReactNode;
};

type Status = { kind: "success" | "error" | "info"; message: string } | null;

function messageFromResponse(response: Response): string {
  if (response.status === 404) {
    return "ไม่พบบริการนี้ในระบบ กรุณาลองใหม่หรือติดต่อผู้ดูแล";
  }
  if (response.status >= 500) {
    return "ไม่สามารถบันทึกข้อมูลได้ในขณะนี้ กรุณาลองใหม่ภายหลัง";
  }
  return "ไม่สามารถดำเนินการได้ กรุณาตรวจสอบข้อมูลแล้วลองใหม่";
}

export default function OperationsWorkspace({
  title,
  description,
  emptyMessage,
  endpoint,
  actions = [],
  children,
}: OperationWorkspaceProps) {
  const [status, setStatus] = useState<Status>(null);
  const [confirming, setConfirming] = useState<OperationAction | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  async function submit(action: string, confirmed = false) {
    if (!navigator.onLine) {
      setStatus({
        kind: "error",
        message: "อุปกรณ์ออฟไลน์ จึงยังไม่บันทึกเวลาหรือคำขอใด ๆ",
      });
      return;
    }

    setStatus({ kind: "info", message: "กำลังส่งข้อมูล…" });
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...(confirmed ? { confirm: true } : {}) }),
      });
      if (!response.ok) {
        setStatus({ kind: "error", message: messageFromResponse(response) });
        return;
      }
      setStatus({ kind: "success", message: "บันทึกข้อมูลเรียบร้อยแล้ว" });
      setConfirming(null);
    } catch {
      setStatus({
        kind: "error",
        message: "เชื่อมต่อบริการไม่ได้ ยังไม่มีการบันทึกข้อมูล",
      });
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setLocationStatus("กำลังขออนุญาตเข้าถึงตำแหน่ง…");
    navigator.geolocation.getCurrentPosition(
      () => setLocationStatus("อนุญาตตำแหน่งแล้ว จะใช้เฉพาะเมื่อส่งรายการลงเวลา"),
      () => setLocationStatus("ไม่ได้รับอนุญาตตำแหน่ง จึงยังไม่สามารถลงเวลาได้"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  const attendance = endpoint === "/api/hr/attendance/clock";

  return (
    <>
      <div className="hr-page-head">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {!isOnline ? (
        <Alert kind="warning">
          คุณกำลังออฟไลน์ — ระบบจะไม่สร้างเวลาเข้างานหรือออกงานแทนคุณ
        </Alert>
      ) : null}
      {status ? <Alert kind={status.kind}>{status.message}</Alert> : null}

      {attendance ? (
        <section className="card">
          <h2>ลงเวลาวันนี้</h2>
          <p>โปรดอนุญาตตำแหน่งก่อนลงเวลา ระบบจะไม่บันทึกรายการหากตรวจสอบไม่ได้</p>
          <div className="inline-actions">
            <button type="button" className="btn" onClick={requestLocation}>
              อนุญาตตำแหน่ง
            </button>
            <button type="button" className="btn btn-primary" onClick={() => submit("clockIn")}>
              เข้างาน
            </button>
            <button type="button" className="btn" onClick={() => submit("clockOut")}>
              ออกงาน
            </button>
          </div>
          {locationStatus ? <p className="muted">{locationStatus}</p> : null}
        </section>
      ) : null}

      {actions.length > 0 ? (
        <section className="card">
          <h2>การดำเนินการ</h2>
          <div className="inline-actions">
            {actions.map((item) => (
              <button
                key={item.action}
                type="button"
                className="btn"
                onClick={() => (item.confirm ? setConfirming(item) : submit(item.action))}
              >
                {item.label}
              </button>
            ))}
          </div>
          {confirming ? (
            <div className="alert alert-warning" role="alert">
              <p>ยืนยันการ{confirming.label}หรือไม่? การดำเนินการนี้จะส่งคำสั่งไปยังระบบ</p>
              <span className="inline-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => submit(confirming.action, true)}
                >
                  ยืนยัน
                </button>
                <button type="button" className="btn" onClick={() => setConfirming(null)}>
                  ยกเลิก
                </button>
              </span>
            </div>
          ) : null}
        </section>
      ) : null}

      {children ?? (
        <section className="card">
          <p className="empty">{emptyMessage}</p>
        </section>
      )}
      <p className="muted">
        หากข้อมูลยังไม่แสดง ให้ลองรีเฟรชหน้า หรือตรวจสอบสิทธิ์การเข้าถึง
      </p>
      <Link className="btn btn-sm" href="/hr">
        กลับแดชบอร์ด
      </Link>
    </>
  );
}
