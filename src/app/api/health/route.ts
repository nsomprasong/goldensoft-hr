export const dynamic = "force-dynamic";

/** Liveness probe — no secrets, no payroll/employee data. */
export async function GET() {
  return Response.json({
    ok: true,
    service: "goldensoft-hr",
    version: process.env.IMAGE_TAG || "unknown",
    time: new Date().toISOString(),
  });
}
