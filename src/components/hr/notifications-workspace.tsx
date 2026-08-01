"use client";

import { useCallback, useEffect, useState } from "react";

import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import NotificationLink from "@/components/hr/notification-link";
import { formatThaiDate } from "@/lib/hr/thai-date";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  dateLabel: string | null;
  typeCode: string;
  typeName: string;
  entityType: string | null;
  entityId: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  unread: boolean;
};

function formatWhen(iso: string): string {
  try {
    const day = iso.slice(0, 10);
    const time = new Date(iso).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Bangkok",
    });
    return `${formatThaiDate(day)} · ${time}`;
  } catch {
    return iso.slice(0, 16);
  }
}

export default function NotificationsWorkspace({
  initialItems,
  initialUnreadCount,
}: {
  initialItems: NotificationItem[];
  initialUnreadCount: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/hr/notifications?limit=60", {
        credentials: "include",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          body?.error?.message || body?.message || "โหลดแจ้งเตือนไม่สำเร็จ",
        );
      }
      setItems(body.items ?? []);
      setUnreadCount(Number(body.unreadCount ?? 0));
    } catch (error) {
      setFeedback({
        kind: "error",
        title: "โหลดไม่สำเร็จ",
        message: error instanceof Error ? error.message : "ลองใหม่อีกครั้ง",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setItems(initialItems);
    setUnreadCount(initialUnreadCount);
  }, [initialItems, initialUnreadCount]);

  function applyMarkedRead(id: string) {
    setItems((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, unread: false, readAt: new Date().toISOString() }
          : row,
      ),
    );
    setUnreadCount((n) => Math.max(0, n - 1));
  }

  async function markRead(id: string) {
    const response = await fetch(`/api/hr/notifications/${id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      credentials: "include",
      body: "{}",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFeedback({
        kind: "error",
        title: "อ่านไม่สำเร็จ",
        message: body?.error?.message || "ลองใหม่อีกครั้ง",
      });
      return;
    }
    applyMarkedRead(id);
  }

  async function markAllRead() {
    const response = await fetch("/api/hr/notifications/mark-all-read", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      credentials: "include",
      body: "{}",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFeedback({
        kind: "error",
        title: "อ่านทั้งหมดไม่สำเร็จ",
        message: body?.error?.message || "ลองใหม่อีกครั้ง",
      });
      return;
    }
    setItems((prev) =>
      prev.map((row) => ({
        ...row,
        unread: false,
        readAt: row.readAt ?? new Date().toISOString(),
      })),
    );
    setUnreadCount(0);
  }

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      <div className="hr-page-head">
        <div>
          <h1>แจ้งเตือน</h1>
          <p>
            {unreadCount > 0
              ? `ยังไม่อ่าน ${unreadCount} รายการ`
              : "อ่านครบแล้ว"}
          </p>
        </div>
        <div className="hr-page-actions">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void reload()}
            disabled={loading}
          >
            รีเฟรช
          </button>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => void markAllRead()}
            >
              อ่านทั้งหมด
            </button>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="empty">ยังไม่มีการแจ้งเตือน</p>
      ) : (
        <ul className="hr-notify-list">
          {items.map((row) => {
            const content = (
              <>
                <div className="hr-notify-main">
                  <strong>{row.title}</strong>
                  <span className="hr-notify-body">{row.body}</span>
                  {row.dateLabel ? (
                    <span className="hr-notify-date">{row.dateLabel}</span>
                  ) : null}
                  <span className="hr-notify-meta">
                    {row.typeName}
                    <span aria-hidden="true"> · </span>
                    แจ้งเมื่อ {formatWhen(row.createdAt)}
                  </span>
                </div>
                {row.unread ? (
                  <span className="hr-notify-dot" aria-label="ยังไม่อ่าน" />
                ) : null}
              </>
            );
            return (
              <li
                key={row.id}
                className={`hr-notify-item${row.unread ? " hr-notify-item--unread" : ""}`}
              >
                {row.href ? (
                  <NotificationLink
                    href={row.href}
                    notificationId={row.id}
                    unread={row.unread}
                    className="hr-notify-link"
                    onMarkedRead={applyMarkedRead}
                  >
                    {content}
                  </NotificationLink>
                ) : (
                  <button
                    type="button"
                    className="hr-notify-link"
                    onClick={() => {
                      if (row.unread) void markRead(row.id);
                    }}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
