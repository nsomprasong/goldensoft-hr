import { redirect } from "next/navigation";

import { requireHrPage } from "@/lib/hr/guards";

export const dynamic = "force-dynamic";

/** Hub removed — “ของฉัน” opens attendance first; other items live in the bottom bar. */
export default async function MyHrPage() {
  await requireHrPage();
  redirect("/hr/me/attendance");
}
