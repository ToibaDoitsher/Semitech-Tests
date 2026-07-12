import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const USER_COOKIE = "app_user_id";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/login") ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/auto-enter" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const uid = request.cookies.get(USER_COOKIE)?.value?.trim();
  const ok = Boolean(uid && /^[0-9a-f-]{36}$/i.test(uid));

  if (!ok) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
