import { redirect } from "next/navigation";

import { hrPath } from "@/lib/hr/routes";

export default function LegacyPayrollPeriodsRedirect() {
  redirect(hrPath("payrollPeriods"));
}
