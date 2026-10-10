import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies
    .getAll()
    .find((cookie) =>
      cookie.name.includes("sb-")
    );

  const isLoggedIn = !!token;

  const isLoginPage =
    request.nextUrl.pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(
      new URL("/", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/animais/:path*",
    "/lotes/:path*",
    "/pesagens/:path*",
    "/login",
  ],
};