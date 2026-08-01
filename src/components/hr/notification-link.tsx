"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode, MouseEvent } from "react";

async function markNotificationRead(id: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/hr/notifications/${id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      credentials: "include",
      body: "{}",
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

function withNotifyParam(href: string, notificationId: string): string {
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}notify=${encodeURIComponent(notificationId)}`;
}

/** Link that marks the notification read before (or while) navigating. */
export default function NotificationLink({
  href,
  notificationId,
  unread,
  className,
  children,
  onMarkedRead,
}: {
  href: string;
  notificationId: string;
  unread: boolean;
  className?: string;
  children: ReactNode;
  onMarkedRead?: (id: string) => void;
}) {
  const router = useRouter();
  const target = withNotifyParam(href, notificationId);

  async function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      // Let the browser open in new tab; still try to mark read.
      if (unread) void markNotificationRead(notificationId);
      return;
    }
    event.preventDefault();
    if (unread) {
      onMarkedRead?.(notificationId);
      await markNotificationRead(notificationId);
    }
    router.push(target);
  }

  return (
    <Link href={target} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
