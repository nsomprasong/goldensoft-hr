import NotificationsWorkspace from "@/components/hr/notifications-workspace";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { listNotifications } from "@/lib/hr/services/notify";
import { toHrServiceContext } from "@/lib/hr/services/shared";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const ctx = await requireHrPage();
  const { items, unreadCount } = await listNotifications(
    toHrServiceContext(ctx),
    { limit: 60 },
  );

  return (
    <HrShell ctx={ctx}>
      <NotificationsWorkspace
        initialItems={items}
        initialUnreadCount={unreadCount}
      />
    </HrShell>
  );
}
