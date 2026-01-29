import { NextResponse, type NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { TURNSTILE_SECRET_KEY } from "./shared/constants/env";
import { LOCALE_REGEX_STR } from "./shared/constants/locales";
import { getCookieName } from "./shared/lib/utils";

const ONE_MB = 1024 * 1024;

let ratelimit: Ratelimit | null = null;
if (process.env.NODE_ENV !== "development") {
  const redis = Redis.fromEnv();
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "10 s"),
    analytics: false,
    prefix: "@upstash/ratelimit",
  });
}

const intlMiddleware = createMiddleware(routing);

const protectedRoutes = ["/dashboard"];
const authRoutes = ["/auth"];
const cookieName = getCookieName();

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hashBuffer).toString("hex");
}

type NextRequestWithIp = NextRequest & { ip?: string };

export async function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const { pathname } = request.nextUrl;

  const ip =
    (request as NextRequestWithIp).ip ??
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    "127.0.0.1";

  if (pathname.startsWith("/api") || pathname.startsWith("/trpc")) {
    if (!pathname.includes("/uploadthing") && !pathname.includes("/webhooks")) {
      const contentLength = request.headers.get("content-length");
      if (contentLength !== null && Number(contentLength) > ONE_MB) {
        return new NextResponse(JSON.stringify({ error: "Payload Too Large", requestId }), {
          status: 413,
          headers: { "content-type": "application/json" },
        });
      }

      let success = true;
      let limit = 0;
      let reset = 0;
      let remaining = 0;

      if (ratelimit) {
        const token = request.cookies.get(cookieName)?.value;
        let identifier = ip;
        if (token !== null && token !== undefined) identifier = await hashToken(token);

        const result = await ratelimit.limit(identifier);
        success = result.success;
        limit = result.limit;
        reset = result.reset;
        remaining = result.remaining;
      }

      if (!success) {
        return new NextResponse(
          JSON.stringify({
            error: "Too Many Requests",
            message: "You're sending requests too often. Please wait.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          }
        );
      }
    }

    if (pathname === "/api/auth/signin/email" && request.method === "POST") {
      const token = request.cookies.get("cf-turnstile-response")?.value;
      const secretKey = TURNSTILE_SECRET_KEY;

      if (token === null || token === undefined || secretKey === null || secretKey === undefined) {
        return new NextResponse(JSON.stringify({ error: "Missing captcha" }), { status: 403 });
      }

      const formData = new FormData();
      formData.append("secret", secretKey);
      formData.append("response", token);
      formData.append("remoteip", ip);

      try {
        const cfRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          body: formData,
        });

        const cfData = await cfRes.json();

        if (cfData.success === false || cfData.action !== "auth") {
          console.error("Cloudflare verification failed:", cfData["error-codes"]);
          return new NextResponse(JSON.stringify({ error: "Captcha failed" }), { status: 403 });
        }
        const response = NextResponse.next();
        response.cookies.delete("cf-turnstile-response");
        return response;
      } catch (error) {
        console.error("Cloudflare network error:", error);
        return new NextResponse(
          JSON.stringify({ error: "Security check error. Please try again." }),
          {
            status: 403,
          }
        );
      }
    }

    const response = NextResponse.next();
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const localeRegex = new RegExp(`^/(${LOCALE_REGEX_STR})`);

  const pathWithoutLocale = pathname.replace(localeRegex, "") || "/";

  const isProtectedRoute = protectedRoutes.some((route) => pathWithoutLocale.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathWithoutLocale.startsWith(route));

  const token = request.cookies.get(cookieName)?.value;

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

  // const requestHeaders = new Headers(request.headers);
  // requestHeaders.set("x-request-id", requestId);
  // requestHeaders.set("x-url", request.url);

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
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
