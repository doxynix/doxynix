import { NextResponse, type NextRequest } from "next/server";

const ONE_MB = 1024 * 1024;

export function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/trpc")) {
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null && Number(contentLength) > ONE_MB) {
      return new NextResponse(
        JSON.stringify({
          error: "Payload Too Large",
          message: "Запрос слишком большой",
          requestId,
        }),
        {
          status: 413,
          headers: { "content-type": "application/json" },
        }
      );
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const cspHeader = `
    default-src 'self';
    script-src 'self' https://vercel.live;
    style-src 'self';
    img-src 'self' blob: data:
      https://ufs.sh
      https://avatars.githubusercontent.com
      https://lh3.googleusercontent.com
      https://avatars.yandex.net;
    font-src 'self' data:;
    connect-src 'self'
      https://ufs.sh
      https://vitals.vercel-insights.com;
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("x-request-id", requestId);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
