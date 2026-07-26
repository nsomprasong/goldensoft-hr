import { redirect } from "next/navigation";

import { hrPath } from "@/lib/hr/routes";

export default async function LegacyPayrollPeriodDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(hrPath("payrollPeriodDetail", { id }));
}
