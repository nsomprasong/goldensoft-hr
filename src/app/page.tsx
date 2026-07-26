import { redirect } from "next/navigation";

import { hrPath } from "@/lib/hr/routes";

/** Legacy root → canonical HR product home under Unified Shell prefix. */
export default function RootRedirectPage() {
  redirect(hrPath("dashboard"));
}
