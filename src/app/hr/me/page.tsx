import { redirect } from "next/navigation";

import { requireHrPage } from "@/lib/hr/guards";

export const dynamic = "force-dynamic";

/** “ของฉัน” opens attendance; other items live in the customer home + bottom bar. */
export default async function MyHrPage() {
  await requireHrPage();
  redirect("/hr/me/attendance");
}
