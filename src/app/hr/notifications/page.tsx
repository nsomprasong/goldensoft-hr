import { redirect } from "next/navigation";

/** Notifications moved to the header bell — keep URL as a soft redirect. */
export default function NotificationsPage() {
  redirect("/hr");
}
