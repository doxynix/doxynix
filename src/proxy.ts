import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

const ONE_MB = 1024 * 1024;

const intlMiddleware = createMiddleware(routing);

const protectedRoutes = ["/dashboard"];
const authRoutes = ["/auth"];

export async function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const { pathname } = request.nextUrl;

  if (
    (pathname.startsWith("/api") || pathname.startsWith("/trpc")) &&
    !pathname.includes("/uploadthing")
  ) {
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null && Number(contentLength) > ONE_MB) {
      return new NextResponse(
        JSON.stringify({
          error: "Payload Too Large",
          message: "Request entity too large",
          requestId,
        }),
        { status: 413, headers: { "content-type": "application/json" } }
      );
    }
  }

  const pathWithoutLocale = pathname.replace(/^\/(ru|en|de|es|zh-CN|pt-BR|fr)/, "") || "/";

  const isProtectedRoute = protectedRoutes.some((route) => pathWithoutLocale.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathWithoutLocale.startsWith(route));

  const cookieName =
    process.env.NODE_ENV === "production"
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;

  if (isProtectedRoute && token == null) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && token != null) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-url", request.url);

  const response = intlMiddleware(request);

  response.headers.set("x-request-id", requestId);
  response.cookies.set("last_request_id", requestId, {
    path: "/",
    maxAge: 60,
    httpOnly: false,
    sameSite: "lax",
  });

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
