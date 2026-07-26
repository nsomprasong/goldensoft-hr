import { redirect } from "next/navigation";

import { hrPath } from "@/lib/hr/routes";

export default async function LegacyBranchRedirect({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  redirect(hrPath("branchEmployees", { branchId }));
}
