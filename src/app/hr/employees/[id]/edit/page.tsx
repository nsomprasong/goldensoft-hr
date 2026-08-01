import { redirect } from "next/navigation";

import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

/** Edit is in-tab on the employee detail page. */
export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireHrPage({ permission: HR_PERMISSIONS.employeeUpdate });
  const { id } = await params;
  redirect(`/hr/employees/${id}?tab=general`);
}
