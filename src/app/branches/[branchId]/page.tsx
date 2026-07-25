import { requireHrPage } from "@/lib/hr/guards";

export const dynamic = "force-dynamic";

export default async function BranchPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const ctx = await requireHrPage({ branchId });

  return (
    <main style={{ padding: "1.5rem" }}>
      <h1>สาขา HR</h1>
      <p>องค์กร: {ctx.organizationName}</p>
      <p>สาขาที่ขอ: {branchId}</p>
      <p>สาขาในบริบท: {ctx.branch?.name ?? "—"}</p>
    </main>
  );
}
