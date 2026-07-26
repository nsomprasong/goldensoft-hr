import { thaiMessageForCode } from "@/lib/platform/errors";
import type { PlatformErrorCode } from "@/lib/platform/types";

const KNOWN: PlatformErrorCode[] = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "TENANT_CONTEXT_REQUIRED",
  "PRODUCT_NOT_ENTITLED",
  "SUBSCRIPTION_INACTIVE",
  "BRANCH_OUT_OF_SCOPE",
  "CLIENT_ORG_MISMATCH",
  "PROFILE_NOT_FOUND",
  "PROFILE_SUSPENDED",
];

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const reason = params.reason;
  const code = KNOWN.includes(reason as PlatformErrorCode)
    ? (reason as PlatformErrorCode)
    : "FORBIDDEN";

  return (
    <main className="hr-main">
      <div className="card">
        <h1>ไม่สามารถเข้าถึง HR</h1>
        <p>{thaiMessageForCode(code)}</p>
        <p className="muted">รหัส: {code}</p>
        <p className="muted">
          ใน production ให้เลือกองค์กรและผลิตภัณฑ์จาก Customer App แล้วเปิดเส้นทาง{" "}
          <code>/hr</code>
        </p>
      </div>
    </main>
  );
}
