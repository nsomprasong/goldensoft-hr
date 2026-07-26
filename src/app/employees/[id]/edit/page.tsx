import { redirect } from "next/navigation";

import { hrPath } from "@/lib/hr/routes";

export default async function LegacyEmployeeEditRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(hrPath("employeesEdit", { id }));
}
