import { redirect } from "next/navigation";

import { hrPath } from "@/lib/hr/routes";

export default function LegacyEmployeesRedirect() {
  redirect(hrPath("employees"));
}
