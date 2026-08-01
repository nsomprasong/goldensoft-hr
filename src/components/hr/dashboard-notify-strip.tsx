"use client";

import Link from "next/link";

import NotificationLink from "@/components/hr/notification-link";

export type DashboardNotifyItem = {
  id: string;
  title: string;
  body: string;
  dateLabel: string | null;
  href: string | null;
  unread: boolean;
};

export default function DashboardNotifyStrip({
  unreadCount,
  items,
}: {
  unreadCount: number;
  items: DashboardNotifyItem[];
}) {
  if (unreadCount <= 0) return null;

  return (
    <section className="hr-dash-notify" aria-label="แจ้งเตือนยังไม่อ่าน">
      <div className="hr-dash-notify-head">
        <div>
          <h2>แจ้งเตือน</h2>
          <p>ยังไม่อ่าน {unreadCount} รายการ</p>
        </div>
        <Link className="btn btn-sm" href="/hr/notifications">
          เปิดกล่องแจ้งเตือน
        </Link>
      </div>
      <ul className="hr-dash-notify-list">
        {items.map((row) => {
          const inner = (
            <>
              <strong>{row.title}</strong>
              <span>{row.body}</span>
              {row.dateLabel ? (
                <span className="hr-notify-date">{row.dateLabel}</span>
              ) : null}
            </>
          );
          return (
            <li key={row.id}>
              {row.href ? (
                <NotificationLink
                  href={row.href}
                  notificationId={row.id}
                  unread={row.unread}
                >
                  {inner}
                </NotificationLink>
              ) : (
                <Link href="/hr/notifications">{inner}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
