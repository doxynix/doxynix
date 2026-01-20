import { NextResponse, type NextRequest } from "next/server";

const ONE_MB = 1024 * 1024;

export function proxy(request: NextRequest) {
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

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-url", request.url);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images).*)"],
};
