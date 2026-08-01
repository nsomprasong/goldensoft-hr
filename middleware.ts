import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PREFIXES = ["/login", "/access", "/forbidden", "/select-organization"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return false;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function middleware(request: NextRequest) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_TEST_AUTH === "true"
  ) {
    return NextResponse.json(
      { code: "TEST_AUTH_IN_PRODUCTION", message: "โหมดทดสอบถูกห้ามใน Production" },
      { status: 500 },
    );
  }

  const { response: sessionResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-gs-pathname", pathname);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  for (const cookie of sessionResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }

  const testAuth =
    process.env.ALLOW_TEST_AUTH === "true" &&
    Boolean(request.headers.get("x-test-auth-user-id"));
  // Customer App already verified Platform bootstrap and forwards a signed bridge.
  const customerShellTrusted =
    request.headers.get("x-gs-customer-shell") === "1" &&
    Boolean(request.headers.get("x-gs-platform-bootstrap"));
  const signedIn = Boolean(user) || testAuth || customerShellTrusted;

  if (pathname === "/login" && signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/hr";
    return NextResponse.redirect(url);
  }

  if (!isPublicPath(pathname) && !signedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          code: "UNAUTHENTICATED",
          message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง",
        },
        { status: 401 },
      );
    }
    // Embedded under Customer App — never bounce the browser to HR's /login
    // (that Location is relative and becomes App /login → Platform loop).
    if (request.headers.get("x-gs-customer-shell") === "1") {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2)$).*)",
  ],
};
